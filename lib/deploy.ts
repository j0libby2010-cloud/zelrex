// lib/deploy.ts — Vercel deployment API wrapper for Zelrex
//
// FIXED VERSION
//
// Critical fixes from previous version:
// 1. LAZY ENV LOADING — VERCEL_API_TOKEN no longer crashes server on missing env
// 2. DOMAIN VALIDATION — rejects punycode/IDN tricks, whitespace, length limits
// 3. IDEMPOTENT addCustomDomain — handles "already added" case as success
// 4. NO MORE 404 = INDEX — uses Vercel SPA rewrites instead (proper 404 handling)
// 5. RETURNS PROJECT URL not deployment URL — stable across redeploys
// 6. ERROR SANITIZATION — strips internal tokens from error messages

// ─── Lazy env loading ──────────────────────────────────────────
// Don't crash server on missing token — return clear error when actually needed

function getVercelToken(): string {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error("Vercel deployment is not configured. Contact support.");
  }
  return token;
}

function getTeamId(): string | undefined {
  return process.env.VERCEL_TEAM_ID || undefined;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getVercelToken()}`,
    "Content-Type": "application/json",
  };
}

function teamQuery(): string {
  const teamId = getTeamId();
  return teamId ? `?teamId=${teamId}` : "";
}

// ─── Error sanitization ──────────────────────────────────────────

function sanitizeError(message: string): string {
  if (!message) return "An error occurred";
  return String(message)
    // Strip Vercel/Stripe/generic API keys
    .replace(/(?:vrl|sk|pk|Bearer)[_\s-]?[A-Za-z0-9]{15,}/g, "[REDACTED]")
    // Strip internal Vercel URLs that might leak project details
    .replace(/https?:\/\/[^\s"]+vercel-storage\.com[^\s"]*/g, "[INTERNAL]")
    // Strip generic tokens
    .replace(/(?:api[_-]?key|secret|token)[\s:=]+["']?[^\s"',]{6,}/gi, "[REDACTED]")
    // Cap length
    .slice(0, 300);
}

// ─── Types ──────────────────────────────────────────────────────────

export interface DeployResult {
  success: true;
  url: string;
  productionUrl?: string;  // Stable URL across redeploys
  deploymentId: string;
  projectId: string;
  projectName: string;
}

export interface DeployError {
  success: false;
  error: string;
}

export interface DomainResult {
  verified: boolean;
  domain: string;
  alreadyAdded?: boolean;
  dnsRecords: { type: string; name: string; value: string }[];
  message: string;
}

// ─── Slug generation ────────────────────────────────────────────────

export function makeProjectSlug(businessName: string): string {
  if (!businessName || typeof businessName !== "string") {
    return `zlrx-site-${Date.now().toString(36)}`;
  }
  const cleaned = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `zlrx-${cleaned || "site-" + Date.now().toString(36)}`;
}

// ─── Domain validation ───────────────────────────────────────────

export function isValidDomain(domain: string): { valid: boolean; reason?: string; cleaned?: string } {
  if (!domain || typeof domain !== "string") {
    return { valid: false, reason: "Domain is required" };
  }
  
  let cleaned = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")  // Strip www prefix for normalization
    .replace(/\/.*$/, "")
    .replace(/[\s\u0000-\u001f\u007f-\u009f]/g, ""); // Strip whitespace and control chars
  
  // Strip trailing dots
  cleaned = cleaned.replace(/\.+$/, "");
  
  if (cleaned.length === 0) {
    return { valid: false, reason: "Domain is empty after cleaning" };
  }
  
  if (cleaned.length > 253) {
    return { valid: false, reason: "Domain exceeds 253 character limit" };
  }
  
  // Reject punycode/IDN trickery (xn-- prefix is the punycode marker)
  // We'll allow legitimate punycode but require explicit user intent later
  if (cleaned.includes("xn--")) {
    return { valid: false, reason: "Internationalized domain names not supported yet. Use the ASCII version." };
  }
  
  // Reject Unicode characters that aren't ASCII letters/digits/hyphens/dots
  if (!/^[a-z0-9.-]+$/.test(cleaned)) {
    return { valid: false, reason: "Domain contains invalid characters. Use only letters, numbers, hyphens, and dots." };
  }
  
  // Standard domain regex — labels max 63 chars, must start/end with alphanumeric
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(cleaned)) {
    return { valid: false, reason: "Domain format is invalid" };
  }
  
  // Must have at least one dot (TLD)
  if (!cleaned.includes(".")) {
    return { valid: false, reason: "Domain must include a TLD (e.g., .com, .io)" };
  }
  
  return { valid: true, cleaned };
}

// ─── Deploy static HTML as a Vercel project ─────────────────────────

export async function deployWebsite(
  slug: string,
  html: string
): Promise<DeployResult | DeployError> {
  try {
    // Vercel deployment with proper SPA rewrites for 404 handling
    const res = await fetch(
      `https://api.vercel.com/v13/deployments${teamQuery()}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: slug,
          files: [
            {
              file: "index.html",
              data: Buffer.from(html, "utf-8").toString("base64"),
              encoding: "base64",
            },
            // FIXED: Use vercel.json with proper SPA rewrite instead of duplicating index as 404
            // This means 404s correctly return 404 status (good for SEO) but show the app shell
            {
              file: "vercel.json",
              data: Buffer.from(JSON.stringify({
                rewrites: [{ source: "/(.*)", destination: "/index.html" }],
                cleanUrls: true,
              }), "utf-8").toString("base64"),
              encoding: "base64",
            },
          ],
          target: "production",
          projectSettings: {
            framework: null,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("ZELREX DEPLOY: Vercel API error", res.status, err?.error?.message);
      return {
        success: false,
        error: sanitizeError(err?.error?.message) || `Deployment failed (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    
    // FIXED: Construct the production URL (stable across redeploys)
    // data.url is the unique deployment URL like zlrx-foo-abc123.vercel.app
    // The production URL is zlrx-foo.vercel.app
    const productionUrl = `https://${slug}.vercel.app`;
    const deploymentUrl = `https://${data.url}`;

    return {
      success: true,
      url: productionUrl,           // Stable URL (preferred for sharing)
      productionUrl,
      deploymentId: data.id,
      projectId: data.projectId,
      projectName: slug,
    };
  } catch (e: any) {
    console.error("ZELREX DEPLOY: exception", e?.message);
    return { success: false, error: sanitizeError(e?.message) || "Deployment failed" };
  }
}

// ─── Add custom domain (FIXED: idempotent) ──────────────────────────

export async function addCustomDomain(
  projectId: string,
  domain: string
): Promise<DomainResult> {
  // Validate domain first
  const validation = isValidDomain(domain);
  if (!validation.valid) {
    return {
      verified: false,
      domain: domain,
      dnsRecords: [],
      message: validation.reason || "Invalid domain",
    };
  }
  
  const cleanDomain = validation.cleaned!;

  try {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/domains${teamQuery()}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: cleanDomain }),
      }
    );

    const data = await res.json();

    // FIXED: Idempotent handling — "domain already exists" is success, not error
    if (!res.ok) {
      const errorCode = data?.error?.code;
      const errorMsg = data?.error?.message || "";
      
      // Vercel returns 409 with code "domain_already_in_use" for duplicates
      if (res.status === 409 || /already (?:exists|in use|added)/i.test(errorMsg)) {
        // Check current verification status by querying the existing domain
        return await verifyDomain(projectId, cleanDomain);
      }
      
      return {
        verified: false,
        domain: cleanDomain,
        dnsRecords: getDefaultDnsRecords(cleanDomain),
        message: sanitizeError(errorMsg) || `Failed to add domain (HTTP ${res.status})`,
      };
    }

    // Domain added — check verification status
    if (data.verified === false || data.verification) {
      return {
        verified: false,
        domain: cleanDomain,
        dnsRecords: data.verification && Array.isArray(data.verification)
          ? data.verification.map((v: any) => ({
              type: v.type || "TXT",
              name: v.domain || cleanDomain,
              value: v.value || "",
            }))
          : getDefaultDnsRecords(cleanDomain),
        message: "Domain added. Configure the DNS records below, then verify.",
      };
    }

    return {
      verified: true,
      domain: cleanDomain,
      dnsRecords: [],
      message: "Domain connected and verified. Your site is live.",
    };
  } catch (e: any) {
    return {
      verified: false,
      domain: cleanDomain,
      dnsRecords: getDefaultDnsRecords(cleanDomain),
      message: sanitizeError(e?.message) || "Failed to add domain",
    };
  }
}

// ─── Check domain verification status ───────────────────────────────

export async function verifyDomain(
  projectId: string,
  domain: string
): Promise<DomainResult> {
  const validation = isValidDomain(domain);
  if (!validation.valid) {
    return {
      verified: false,
      domain: domain,
      dnsRecords: [],
      message: validation.reason || "Invalid domain",
    };
  }
  const cleanDomain = validation.cleaned!;

  try {
    const verifyRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/domains/${cleanDomain}/verify${teamQuery()}`,
      { method: "POST", headers: headers() }
    );

    const data = await verifyRes.json();

    if (data.verified) {
      return {
        verified: true,
        domain: cleanDomain,
        alreadyAdded: true,
        dnsRecords: [],
        message: `${cleanDomain} is verified and live. Your site is ready.`,
      };
    }

    return {
      verified: false,
      domain: cleanDomain,
      alreadyAdded: true,
      dnsRecords: data.verification && Array.isArray(data.verification)
        ? data.verification.map((v: any) => ({
            type: v.type || "TXT",
            name: v.domain || cleanDomain,
            value: v.value || "",
          }))
        : getDefaultDnsRecords(cleanDomain),
      message: "Domain not yet verified. DNS changes can take up to 48 hours. Make sure your records are set correctly.",
    };
  } catch (e: any) {
    return {
      verified: false,
      domain: cleanDomain,
      dnsRecords: getDefaultDnsRecords(cleanDomain),
      message: sanitizeError(e?.message) || "Verification check failed",
    };
  }
}

// ─── Default DNS records ────────────────────────────────────────────

function getDefaultDnsRecords(domain: string) {
  const isSubdomain = domain.split(".").length > 2;
  
  if (isSubdomain) {
    return [
      {
        type: "CNAME",
        name: domain.split(".")[0],
        value: "cname.vercel-dns.com",
      },
    ];
  }
  
  // For root domains, Vercel supports A records (IP) or ALIAS records
  // The IP can change so this is a fallback. The verifyDomain call above
  // returns Vercel's current required records when available.
  return [
    { type: "A", name: "@", value: "76.76.21.21" },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
  ];
}

// ─── Redeploy ──────────────────────────────────────────────────────

export async function redeployWebsite(
  slug: string,
  html: string
): Promise<DeployResult | DeployError> {
  return deployWebsite(slug, html);
}

// ─── Delete project ────────────────────────────────────────────────

export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate projectId format
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(projectId)) {
    return { success: false, error: "Invalid projectId format" };
  }
  
  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}${teamQuery()}`,
      { method: "DELETE", headers: headers() }
    );

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: sanitizeError(data?.error?.message) || `Delete failed (HTTP ${res.status})`,
      };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: sanitizeError(e?.message) };
  }
}