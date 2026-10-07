"use client";
import React, { useState, useEffect, useRef } from "react";

/* Zelrex design tokens, same values as the C object in ChatPageClient.tsx. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

type DomainStatus = "none" | "pending" | "verifying" | "verified" | "failed";
type DnsRecord = { type: string; name: string; value: string };

/* Vercel's `verified` only means ownership is verified. A domain is live only when DNS also points at
   Vercel, which the server reports as `dnsConfigured` (true / false / null when it couldn't check).
   Only an explicit `false` keeps the panel in the "set your DNS" state. */
const isLive = (r: any) => !!r?.verified && r.dnsConfigured !== false;

const GlobeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" /><path d="M3 12h18M12 2.75c2.4 2.5 3.6 5.6 3.6 9.25S14.4 18.75 12 21.25C9.6 18.75 8.4 15.65 8.4 12S9.6 5.25 12 2.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
);
const XIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const CopyIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M15 9V6.5A2.5 2.5 0 0012.5 4h-6A2.5 2.5 0 004 6.5v6A2.5 2.5 0 006.5 15H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const CheckIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ArrowUpRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Spinner = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: "dm-spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" /><path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
);

const STYLES = `
  @keyframes dm-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes dm-spin{to{transform:rotate(360deg)}}
  .dm-btn-accent{transition:filter 150ms ${EASE},transform 100ms ${EASE};cursor:pointer}
  .dm-btn-accent:not(:disabled):hover{filter:brightness(1.1)}
  .dm-btn-accent:not(:disabled):active{filter:brightness(0.95);transform:scale(0.98);transition-duration:80ms}
  .dm-btn-accent:disabled{opacity:0.5;cursor:not-allowed}
  .dm-btn-outlined{transition:background-color 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer}
  .dm-btn-outlined:hover{background:rgba(255,255,255,0.04)!important;border-color:${C.borderHover}!important;color:${C.text}!important}
  .dm-btn-outlined:active{background:rgba(255,255,255,0.06)!important;transition-duration:80ms}
  .dm-btn-text{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:none;border:none;border-radius:999px}
  .dm-btn-text:hover{background:rgba(255,255,255,0.04);color:${C.text}!important}
  .dm-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
  .dm-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
  .dm-btn-icon:active{background:rgba(255,255,255,0.10)!important;transition-duration:80ms}
  .dm-input{width:100%;height:42px;padding:0 14px;border-radius:10px;border:1px solid ${C.border};background:${C.bgInput};color:${C.text};font-size:14px;font-family:inherit;outline:none;transition:border-color 150ms ${EASE}}
  .dm-input:focus{border-color:${C.accent}}
  .dm-input::placeholder{color:${C.textMuted}}
  .dm-header{height:52px;padding:0 14px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${C.border};flex-shrink:0}
  .dm-row{display:grid;grid-template-columns:64px minmax(0,1fr) minmax(0,1.6fr);gap:12px;align-items:center;padding:12px 8px 12px 16px}
  .dm-cell{display:flex;align-items:center;gap:4px;min-width:0}
  .dm-add{display:flex;gap:10px}
  @media(max-width:560px){
    .dm-row{grid-template-columns:1fr;gap:8px;padding:14px 12px 14px 16px}
    .dm-head-row{display:none!important}
    .dm-add{flex-direction:column}
  }
`;

export function DomainManager({ deployData, onAddDomain, onVerifyDomain, onClose }: {
  deployData: { url?: string; projectId?: string; projectName?: string; customDomain?: string; domainStatus?: DomainStatus; dnsRecords?: any[] } | null;
  onAddDomain: (domain: string) => Promise<any>;
  onVerifyDomain: () => Promise<any>;
  onClose: () => void;
}) {
  const startStatus: DomainStatus = deployData?.customDomain ? (deployData?.domainStatus || "pending") : "none";
  const [input, setInput] = useState("");
  const [active, setActive] = useState(deployData?.customDomain || "");
  const [status, setStatus] = useState<DomainStatus>(startStatus);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>(deployData?.dnsRecords || []);
  const [dnsKnown, setDnsKnown] = useState<boolean | null>(startStatus === "verified" ? true : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // The 30-second check must always call the *current* verify function. The parent rebuilds it after the
  // domain is saved, and an interval that kept the first copy would verify an undefined domain forever.
  const verifyRef = useRef(onVerifyDomain);
  verifyRef.current = onVerifyDomain;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyResult = (r: any) => {
    if (Array.isArray(r?.dnsRecords) && r.dnsRecords.length) setDnsRecords(r.dnsRecords);
    if (isLive(r)) { setStatus("verified"); setDnsKnown(r.dnsConfigured ?? null); return true; }
    return false;
  };

  const handleAddDomain = async () => {
    // Accept a pasted address: drop the protocol and any path before checking the format.
    const clean = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean) { setError("Enter a domain."); return; }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(clean)) {
      setError("That doesn't look like a domain. Example: mybusiness.com"); return;
    }
    setLoading(true); setError("");
    try {
      const result = await onAddDomain(clean);
      if (result?.error) { setError(result.error); }
      else if (applyResult(result)) { setActive(result.domain || clean); }
      else if (result?.dnsRecords?.length) { setActive(result.domain || clean); setStatus("pending"); }
      else { setError(result?.message || "Couldn't add that domain. Try again."); }
    } catch (e: any) { setError(e?.message || "Couldn't add that domain. Try again."); }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true); setStatus("verifying"); setError("");
    try {
      const result = await onVerifyDomain();
      if (!applyResult(result)) {
        if (result?.verified && result.dnsConfigured === false) {
          setStatus("pending");
          setError("Your domain is added, but its DNS doesn't point at us yet. Changes can take a while to spread.");
        } else {
          setStatus("failed");
          setError(result?.error || result?.message || "DNS hasn't propagated yet. This can take up to 48 hours.");
        }
      }
    } catch { setError("Couldn't check your DNS. Try again in a moment."); setStatus("failed"); }
    setLoading(false);
  };

  // While records are waiting to be set, check again every 30 seconds.
  useEffect(() => {
    if (status !== "pending") return;
    const id = setInterval(async () => {
      try { applyResult(await verifyRef.current()); } catch {}
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const copyValue = async (val: string, key: string) => {
    try { await navigator.clipboard.writeText(val); } catch { return; }
    setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const useDifferent = () => { setStatus("none"); setDnsRecords([]); setDnsKnown(null); setInput(""); setActive(""); setError(""); };

  const showRecords = (status === "pending" || status === "failed" || status === "verifying") && dnsRecords.length > 0;
  const siteUrl = deployData?.url ? deployData.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  const label: Record<DomainStatus, { color: string; text: string }> = {
    none: { color: C.textMuted, text: "" },
    pending: { color: C.accent, text: "Waiting for DNS" },
    verifying: { color: C.accent, text: "Checking DNS" },
    verified: dnsKnown === true ? { color: C.green, text: "Connected" } : { color: C.accent, text: "Added" },
    failed: { color: C.red, text: "DNS not found yet" },
  };
  const sc = label[status];

  const heading = status === "none" ? "Use your own domain"
    : status === "verified" ? (dnsKnown === true ? "Your domain is connected" : "Your domain is added")
    : active;
  const sub = status === "none" ? (siteUrl ? `Your site is at ${siteUrl}. Point a domain you own at it and visitors will see that instead.` : "Deploy your site first, then connect a domain you own.")
    : status === "verified" ? (dnsKnown === true ? `Visitors to ${active} now see your site.` : `We couldn't confirm your DNS settings from here. If ${active} doesn't load, check that its records point at us.`)
    : "Set these records where you registered the domain.";

  const outlinedBtn: React.CSSProperties = { height: 36, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 };

  return (
    <div role="dialog" aria-label="Domain" style={{ position: "fixed", inset: 0, zIndex: 9700, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}`, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLES}</style>

      <div className="dm-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.accent }}>
          <GlobeIcon size={18} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Domain</span>
        </div>
        <button className="dm-btn-icon" onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px 20px 64px" }}>
        <div style={{ width: 520, maxWidth: "100%", margin: "auto", animation: `dm-fadeUp 250ms ${EASE} both` }}>
          <div style={{ textAlign: status === "none" || status === "verified" ? "center" : "left" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text, overflowWrap: "anywhere" }}>{heading}</h1>
            {status !== "none" && sc.text && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, justifyContent: status === "verified" ? "center" : "flex-start", fontSize: 13, fontWeight: 500, color: sc.color }}>
                {status === "verifying" ? <Spinner /> : status === "verified" && dnsKnown === true ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                {sc.text}
              </div>
            )}
            <p style={{ margin: `${status === "none" ? 10 : 14}px ${status === "none" || status === "verified" ? "auto" : 0} 28px`, fontSize: 14, lineHeight: 1.6, color: C.textSec, maxWidth: status === "none" || status === "verified" ? 380 : "none" }}>{sub}</p>
          </div>

          {status === "none" && (
            <div>
              <label htmlFor="dm-domain" style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.textSec, marginBottom: 6 }}>Your domain</label>
              <div className="dm-add">
                <input id="dm-domain" className="dm-input" autoFocus value={input} onChange={(e) => { setInput(e.target.value.toLowerCase()); if (error) setError(""); }} onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleAddDomain(); }} placeholder="mybusiness.com" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={!deployData?.url} />
                <button className="dm-btn-accent" onClick={handleAddDomain} disabled={loading || !input.trim() || !deployData?.url} style={{ height: 42, padding: "0 22px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 }}>
                  {loading ? <><Spinner /> Adding</> : "Connect"}
                </button>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.6, color: C.textMuted }}>You'll need access to your domain's DNS settings, which you can find at the company you bought it from.</p>
            </div>
          )}

          {showRecords && (
            <div>
              <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.bgElevated, overflow: "hidden" }}>
                <div className="dm-row dm-head-row" style={{ padding: "10px 8px 10px 16px", borderBottom: `1px solid ${C.border}` }}>
                  {["Type", "Name", "Value"].map((h) => <span key={h} style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{h}</span>)}
                </div>
                {dnsRecords.map((rec, i) => (
                  <div key={i} className="dm-row" style={{ borderBottom: i < dnsRecords.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'JetBrains Mono','SF Mono',monospace" }}>{rec.type}</span>
                    <div className="dm-cell">
                      <span style={{ fontSize: 12.5, color: C.textSec, fontFamily: "'JetBrains Mono','SF Mono',monospace", overflowWrap: "anywhere", minWidth: 0 }}>{rec.name}</span>
                      <button className="dm-btn-icon" onClick={() => copyValue(rec.name, `n${i}`)} aria-label={`Copy name ${rec.name}`} title="Copy name" style={{ width: 28, height: 28, border: "none", background: "none", color: copied === `n${i}` ? C.green : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{copied === `n${i}` ? <CheckIcon /> : <CopyIcon />}</button>
                    </div>
                    <div className="dm-cell">
                      <span style={{ fontSize: 12.5, color: C.text, fontFamily: "'JetBrains Mono','SF Mono',monospace", overflowWrap: "anywhere", minWidth: 0 }}>{rec.value}</span>
                      <button className="dm-btn-icon" onClick={() => copyValue(rec.value, `v${i}`)} aria-label={`Copy value ${rec.value}`} title="Copy value" style={{ width: 28, height: 28, border: "none", background: "none", color: copied === `v${i}` ? C.green : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{copied === `v${i}` ? <CheckIcon /> : <CopyIcon />}</button>
                    </div>
                  </div>
                ))}
              </div>

              <ol style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                {[`Sign in where you registered ${active}.`, "Open its DNS settings and add the records above.", "Come back and check. It usually takes a few minutes, and can take up to 48 hours."].map((t, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.6, color: C.textSec }}>
                    <span style={{ color: C.textMuted, fontWeight: 600, minWidth: 14 }}>{i + 1}</span><span>{t}</span>
                  </li>
                ))}
              </ol>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28, flexWrap: "wrap" }}>
                <button className="dm-btn-accent" onClick={handleVerify} disabled={loading} style={{ height: 42, padding: "0 22px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {loading ? <><Spinner /> Checking</> : status === "failed" ? "Check again" : "Check DNS"}
                </button>
                <button className="dm-btn-text" onClick={useDifferent} style={{ height: 36, padding: "0 14px", color: C.textSec, fontSize: 13, fontWeight: 500 }}>Use a different domain</button>
              </div>
              {status === "pending" && <p style={{ margin: "14px 0 0", fontSize: 12, color: C.textMuted }}>We'll check again every 30 seconds while this page is open.</p>}
            </div>
          )}

          {status === "verified" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <button className="dm-btn-outlined" onClick={() => window.open(`https://${active}`, "_blank", "noopener,noreferrer")} style={outlinedBtn}>Visit site <ArrowUpRight /></button>
              <button className="dm-btn-text" onClick={useDifferent} style={{ height: 36, padding: "0 14px", color: C.textSec, fontSize: 13, fontWeight: 500 }}>Use a different domain</button>
            </div>
          )}

          {error && (
            <div role="alert" style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", fontSize: 13, lineHeight: 1.5, color: C.red }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
