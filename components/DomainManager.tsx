// @ts-nocheck
"use client";
import React, { useState, useEffect, useCallback } from "react";

const G = {
  bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6", accentSoft: "#5B9BF7", green: "#34D399", amber: "#FBBF24", red: "#F87171", purple: "#A78BFA",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";
const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)", WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`, borderRadius: 20,
  boxShadow: "0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.4)",
};

type DomainStatus = "none" | "pending" | "verifying" | "verified" | "failed";

export function DomainManager({ deployData, onAddDomain, onVerifyDomain, onClose }: {
  deployData: { url?: string; projectId?: string; projectName?: string; customDomain?: string; domainStatus?: DomainStatus; dnsRecords?: any[] } | null;
  onAddDomain: (domain: string) => Promise<any>;
  onVerifyDomain: () => Promise<any>;
  onClose: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<DomainStatus>(deployData?.domainStatus || "none");
  const [dnsRecords, setDnsRecords] = useState<any[]>(deployData?.dnsRecords || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const currentDomain = deployData?.customDomain || "";

  const handleAddDomain = async () => {
    if (!domain.trim()) { setError("Enter a domain"); return; }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/i.test(domain.trim())) {
      setError("Invalid domain format. Example: mybusiness.com"); return;
    }
    setLoading(true); setError("");
    try {
      const result = await onAddDomain(domain.trim());
      if (result?.dnsRecords) {
        setDnsRecords(result.dnsRecords);
        setStatus(result.verified ? "verified" : "pending");
      }
      if (result?.error) setError(result.error);
    } catch (e: any) { setError(e?.message || "Failed to add domain"); }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true); setStatus("verifying"); setError("");
    try {
      const result = await onVerifyDomain();
      setStatus(result?.verified ? "verified" : "failed");
      if (!result?.verified) setError(result?.message || "DNS not propagated yet. This can take up to 48 hours.");
    } catch { setError("Verification check failed"); setStatus("failed"); }
    setLoading(false);
  };

  // Auto-poll every 30s when pending
  useEffect(() => {
    if (status !== "pending" || polling) return;
    const interval = setInterval(async () => {
      try {
        const result = await onVerifyDomain();
        if (result?.verified) { setStatus("verified"); clearInterval(interval); }
      } catch {}
    }, 30000);
    setPolling(true);
    return () => { clearInterval(interval); setPolling(false); };
  }, [status]);

  const copyValue = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  const statusConfig: Record<DomainStatus, { color: string; label: string; icon: string }> = {
    none: { color: G.textMuted, label: "No custom domain", icon: "○" },
    pending: { color: G.amber, label: "DNS setup required", icon: "◐" },
    verifying: { color: G.accent, label: "Checking DNS...", icon: "◌" },
    verified: { color: G.green, label: "Connected & live", icon: "●" },
    failed: { color: G.red, label: "DNS not found", icon: "✕" },
  };

  const sc = statusConfig[status];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ ...liquidGlass, maxWidth: 560, width: "100%", padding: 0, overflow: "hidden", animation: `dmFadeUp 300ms ${EASE}` }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes dmFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes dmSpin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${G.glassBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Custom domain</div>
            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 4 }}>
              {deployData?.url ? `Currently at ${deployData.url.replace("https://", "")}` : "Deploy your site first"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.textMuted, cursor: "pointer", fontSize: 18, padding: 8 }}>✕</button>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>
          {/* Status indicator */}
          {(currentDomain || status !== "none") && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 18px", borderRadius: 14, background: `${sc.color}08`, border: `0.5px solid ${sc.color}20` }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: sc.color, boxShadow: `0 0 8px ${sc.color}40`, animation: status === "verifying" ? "dmSpin 1s linear infinite" : "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{currentDomain || domain}</div>
                <div style={{ fontSize: 11, color: sc.color, fontWeight: 500, marginTop: 2 }}>{sc.label}</div>
              </div>
              {status === "verified" && <span style={{ fontSize: 11, color: G.green, fontWeight: 700 }}>✓ LIVE</span>}
            </div>
          )}

          {/* Domain input (when no domain set) */}
          {status === "none" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: G.textSec, marginBottom: 6 }}>Enter your domain</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={domain} onChange={e => setDomain(e.target.value.toLowerCase())}
                  placeholder="mybusiness.com"
                  onKeyDown={e => e.key === "Enter" && handleAddDomain()}
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.03)", color: G.text, fontSize: 14, outline: "none" }}
                />
                <button onClick={handleAddDomain} disabled={loading} style={{
                  padding: "12px 22px", borderRadius: 12, border: "none", background: G.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? "Adding..." : "Connect"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: G.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                You'll need access to your domain's DNS settings (Namecheap, GoDaddy, Cloudflare, etc.)
              </div>
            </div>
          )}

          {/* DNS Records (when pending) */}
          {(status === "pending" || status === "failed") && dnsRecords.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12 }}>
                {status === "failed" ? "DNS records not detected yet. Verify these are set:" : "Set these DNS records at your domain registrar:"}
              </div>
              <div style={{ borderRadius: 14, overflow: "hidden", border: `0.5px solid ${G.glassBorder}` }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 50px", padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: `0.5px solid ${G.glassBorder}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Type</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Value</span>
                  <span />
                </div>
                {dnsRecords.map((rec: any, i: number) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 50px", padding: "12px 16px", borderBottom: i < dnsRecords.length - 1 ? `0.5px solid ${G.glassBorder}` : "none", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: G.accent, fontFamily: "monospace" }}>{rec.type}</span>
                    <span style={{ fontSize: 12, color: G.textSec, fontFamily: "monospace", wordBreak: "break-all" }}>{rec.name}</span>
                    <span style={{ fontSize: 12, color: G.text, fontFamily: "monospace", wordBreak: "break-all" }}>{rec.value}</span>
                    <button onClick={() => copyValue(rec.value, `dns_${i}`)} style={{ background: "none", border: "none", color: copied === `dns_${i}` ? G.green : G.textMuted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      {copied === `dns_${i}` ? "✓" : "Copy"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Steps */}
              <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: G.text, marginBottom: 8 }}>Steps:</div>
                <div style={{ fontSize: 12, color: G.textSec, lineHeight: 1.8 }}>
                  1. Log into your domain registrar (Namecheap, GoDaddy, etc.)<br />
                  2. Go to DNS settings for {currentDomain || domain}<br />
                  3. Add the records shown above<br />
                  4. Wait 5-30 minutes (can take up to 48h)<br />
                  5. Click "Verify" below
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={handleVerify} disabled={loading} style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: G.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? "Checking..." : status === "failed" ? "Retry verification" : "Verify DNS"}
                </button>
                <button onClick={() => { setStatus("none"); setDnsRecords([]); setDomain(""); }} style={{
                  padding: "13px 20px", borderRadius: 12, border: `1px solid ${G.glassBorder}`, background: "none", color: G.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                  Change domain
                </button>
              </div>

              {polling && status === "pending" && (
                <div style={{ fontSize: 11, color: G.textMuted, marginTop: 10, textAlign: "center" }}>
                  Auto-checking every 30 seconds...
                </div>
              )}
            </div>
          )}

          {/* Verified state */}
          {status === "verified" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: `${G.green}12`, border: `1px solid ${G.green}25`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: G.text, marginBottom: 6 }}>Domain connected</div>
              <div style={{ fontSize: 13, color: G.textSec, marginBottom: 16 }}>
                Your site is live at <span style={{ color: G.green, fontWeight: 600 }}>https://{currentDomain || domain}</span>
              </div>
              <button onClick={() => window.open(`https://${currentDomain || domain}`, "_blank")} style={{
                padding: "10px 24px", borderRadius: 10, border: `1px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.04)", color: G.text, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                Visit site ↗
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: `${G.red}08`, border: `0.5px solid ${G.red}15`, fontSize: 12, color: G.red }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}