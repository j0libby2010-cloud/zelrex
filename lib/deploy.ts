// lib/deploy.ts — Vercel deployment API wrapper for Zelrex
// Deploys static freelancer websites as individual Vercel projects

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || undefined;

function headers() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function teamQuery() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
}

// ─── Types ──────────────────────────────────────────────────────────

export interface DeployResult {
  success: true;
  url: string;
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
  dnsRecords: { type: string; name: string; value: string }[];
  message: string;
}

// ─── Slug generation ────────────────────────────────────────────────

export function makeProjectSlug(businessName: string): string {
  return (
    "zlrx-" +
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
  );
}

// ─── Deploy static HTML as a Vercel project ─────────────────────────

export async function deployWebsite(
  slug: string,
  html: string
): Promise<DeployResult | DeployError> {
  try {
    // Vercel deployment API: create a deployment with inline files
    // This automatically creates the project if it doesn't exist
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
            // 404 fallback → same page (SPA routing)
            {
              file: "404.html",
              data: Buffer.from(html, "utf-8").toString("base64"),
              encoding: "base64",
            },
          ],
          target: "production",
          projectSettings: {
            framework: null, // static site, no framework
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("ZELREX DEPLOY: Vercel API error", res.status, err);
      return {
        success: false,
        error: err?.error?.message || `Deployment failed (HTTP ${res.status})`,
      };
    }

    const data = await res.json();

    return {
      success: true,
      url: `https://${data.url}`,
      deploymentId: data.id,
      projectId: data.projectId,
      projectName: slug,
    };
  } catch (e: any) {
    console.error("ZELREX DEPLOY: exception", e);
    return { success: false, error: e.message || "Deployment failed" };
  }
}

// ─── Add custom domain to a Vercel project ──────────────────────────

export async function addCustomDomain(
  projectId: string,
  domain: string
): Promise<DomainResult> {
  // Clean the domain
  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

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

    if (!res.ok) {
      return {
        verified: false,
        domain: cleanDomain,
        dnsRecords: getDefaultDnsRecords(cleanDomain),
        message:
          data?.error?.message ||
          `Failed to add domain (HTTP ${res.status})`,
      };
    }

    // Domain added — check if it needs verification
    if (data.verified === false || data.verification) {
      return {
        verified: false,
        domain: cleanDomain,
        dnsRecords: data.verification
          ? data.verification.map((v: any) => ({
              type: v.type,
              name: v.domain,
              value: v.value,
            }))
          : getDefaultDnsRecords(cleanDomain),
        message:
          "Domain added. Configure DNS records below, then tell me to verify.",
      };
    }

    return {
      verified: true,
      domain: cleanDomain,
      dnsRecords: [],
      message: "Domain connected and verified. Your site is live!",
    };
  } catch (e: any) {
    return {
      verified: false,
      domain: cleanDomain,
      dnsRecords: getDefaultDnsRecords(cleanDomain),
      message: e.message || "Failed to add domain",
    };
  }
}

// ─── Check domain verification status ───────────────────────────────

export async function verifyDomain(
  projectId: string,
  domain: string
): Promise<DomainResult> {
  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

  try {
    // POST to verify endpoint triggers a re-check
    const verifyRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/domains/${cleanDomain}/verify${teamQuery()}`,
      { method: "POST", headers: headers() }
    );

    const data = await verifyRes.json();

    if (data.verified) {
      return {
        verified: true,
        domain: cleanDomain,
        dnsRecords: [],
        message: `${cleanDomain} is verified and live! Your site is ready.`,
      };
    }

    return {
      verified: false,
      domain: cleanDomain,
      dnsRecords: getDefaultDnsRecords(cleanDomain),
      message:
        "Domain not yet verified. DNS changes can take up to 48 hours. Make sure your records are set correctly.",
    };
  } catch (e: any) {
    return {
      verified: false,
      domain: cleanDomain,
      dnsRecords: getDefaultDnsRecords(cleanDomain),
      message: e.message || "Verification check failed",
    };
  }
}

// ─── Default DNS records for manual setup ───────────────────────────

function getDefaultDnsRecords(domain: string) {
  const isSubdomain = domain.split(".").length > 2;

  if (isSubdomain) {
    // For subdomains like www.example.com → CNAME
    return [
      {
        type: "CNAME",
        name: domain.split(".")[0],
        value: "cname.vercel-dns.com",
      },
    ];
  }

  // For root domains like example.com → A record
  return [
    { type: "A", name: "@", value: "76.76.21.21" },
  ];
}

// ─── Redeploy (update existing site) ────────────────────────────────

export async function redeployWebsite(
  slug: string,
  html: string
): Promise<DeployResult | DeployError> {
  // Same as deployWebsite — Vercel overwrites the previous production deployment
  return deployWebsite(slug, html);
}

// ─── Delete project (cleanup) ───────────────────────────────────────

export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}${teamQuery()}`,
      { method: "DELETE", headers: headers() }
    );

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data?.error?.message || `Delete failed (HTTP ${res.status})`,
      };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
