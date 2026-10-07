/**
 * WEBSITE BUILDER SURVEY
 *
 * A full-screen, multi-step form that collects everything needed to make
 * each website truly bespoke. Opens when the user asks to build a website.
 * Looks and behaves like the app's other panels (Settings, Domain): 52px header,
 * 28px title, pill buttons, hairline borders, no glass, no glow.
 *
 * Steps:
 * 1. Business basics (name, tagline, what you do)
 * 2. Service details (what's included, pricing, turnaround)
 * 3. Brand & visual (colors, style preference)
 * 4. Contact & social (email, phone, social links, hours)
 * 5. Review & build
 *
 * Usage in page.tsx:
 *   {showSurvey && <WebsiteSurvey onComplete={(data) => { ... }} onClose={() => setShowSurvey(false)} />}
 */

"use client";
import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────

export interface SurveyData {
  // Step 1: Business basics
  businessName: string;
  tagline: string;
  businessType: string; // "video editing", "design", "writing", etc.
  targetAudience: string;

  // Step 2: Service details
  mainService: string;
  serviceDescription: string;
  deliverables: string[];
  turnaround: string;
  pricingModel: "package" | "hourly" | "retainer" | "project";
  price: string;
  hasMultipleTiers: boolean;
  tiers: Array<{ name: string; price: string; features: string[] }>;
  guarantee: string;

  // Stripe checkout preference
  stripeCheckout: "auto" | "link-only" | "none";

  // Step 3: Brand & visual
  primaryColor: string;
  stylePreference: "dark-premium" | "light-clean" | "bold-colorful" | "minimal-elegant";
  fontPreference: "modern" | "classic" | "editorial" | "tech" | "studio" | "luxury";

  // Step 4: Contact & social
  email: string;
  phone: string;
  location: string;
  hours: string;
  socialLinks: { platform: string; url: string }[];
  calendlyUrl: string;

  // Step 5: Extras
  aboutStory: string;
  uniqueSellingPoint: string;
  platformsLeavingFrom: string;
}

// ─── Design tokens (same as the rest of the app) ────────────────────

const S = {
  bg: "#06090F",
  bgElevated: "#0D1320",
  bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF",
  text: "rgba(255,255,255,0.88)",
  textSec: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.30)",
  danger: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

const SURVEY_CSS = `
  .sv-root,.sv-root *{box-sizing:border-box}
  @keyframes sv-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes sv-tip{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
  .sv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

  .sv-header{height:52px;padding:0 14px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${S.border};flex-shrink:0}
  .sv-icon-btn{width:34px;height:34px;border-radius:999px;border:none;background:none;color:${S.textSec};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background-color 150ms ${EASE},color 150ms ${EASE}}
  .sv-icon-btn:hover{background:rgba(255,255,255,0.05);color:${S.text}}

  .sv-rail-wrap{position:sticky;top:0;z-index:2;background:${S.bg};padding-bottom:4px}
  .sv-rail{display:flex;gap:6px;width:600px;max-width:100%;margin:0 auto;padding:16px 24px 10px}
  .sv-rail-item{flex:1;min-width:0;padding:0;border:none;background:none;text-align:left;font-family:inherit;cursor:default}
  .sv-rail-item[data-done="true"]{cursor:pointer}
  .sv-rail-bar{height:2px;border-radius:2px;background:rgba(255,255,255,0.10);transition:background-color 240ms ${EASE}}
  .sv-rail-item[data-on="true"] .sv-rail-bar{background:${S.accent}}
  .sv-rail-label{display:block;margin-top:8px;font-size:12px;font-weight:500;color:${S.textMuted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 150ms ${EASE}}
  .sv-rail-item[data-current="true"] .sv-rail-label{color:${S.text}}
  .sv-rail-item[data-done="true"] .sv-rail-label{color:${S.textSec}}
  .sv-rail-item[data-done="true"]:hover .sv-rail-label{color:${S.text}}

  .sv-scroll{flex:1;min-height:0;overflow-y:auto}
  .sv-content{width:600px;max-width:100%;margin:0 auto;padding:32px 24px 48px;animation:sv-in 250ms ${EASE} both}

  .sv-input{width:100%;height:40px;padding:0 12px;border-radius:10px;border:1px solid ${S.border};background:${S.bgInput};color:${S.text};font-size:14px;font-family:inherit;outline:none;transition:border-color 150ms ${EASE}}
  textarea.sv-input{height:auto;min-height:88px;padding:10px 12px;line-height:1.6;resize:vertical;display:block}
  .sv-input::placeholder{color:${S.textMuted}}
  .sv-input:hover{border-color:${S.borderHover}}
  .sv-input:focus{border-color:${S.accent}}
  .sv-select{height:40px;padding:0 32px 0 12px;border-radius:10px;border:1px solid ${S.border};background-color:${S.bgInput};color:${S.text};font-size:14px;font-family:inherit;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;transition:border-color 150ms ${EASE}}
  .sv-select:hover{border-color:${S.borderHover}}
  .sv-select:focus{border-color:${S.accent}}
  .sv-select option{background:${S.bgElevated};color:${S.text}}

  .sv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .sv-opt{position:relative;text-align:left;padding:12px 40px 12px 14px;border-radius:12px;border:1px solid ${S.border};background:transparent;color:${S.textSec};font-family:inherit;cursor:pointer;transition:background-color 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE}}
  .sv-opt:hover{background:rgba(255,255,255,0.03);border-color:${S.borderHover}}
  .sv-opt[aria-checked="true"]{border-color:${S.accent};background:rgba(74,144,255,0.08);color:${S.text}}
  .sv-opt-check{position:absolute;right:12px;top:12px;color:${S.accent};opacity:0;transition:opacity 150ms ${EASE}}
  .sv-opt[aria-checked="true"] .sv-opt-check{opacity:1}

  .sv-swatch{width:32px;height:32px;border-radius:999px;border:none;padding:0;cursor:pointer;flex-shrink:0;transition:box-shadow 150ms ${EASE}}
  .sv-swatch:hover{box-shadow:0 0 0 2px ${S.bg},0 0 0 3px ${S.borderHover}}
  .sv-swatch[aria-checked="true"]{box-shadow:0 0 0 2px ${S.bg},0 0 0 4px rgba(255,255,255,0.85)}
  .sv-custom{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 4px;border-radius:999px;border:1px solid ${S.border};color:${S.textSec};font-size:13px;font-weight:500;cursor:pointer;transition:border-color 150ms ${EASE},color 150ms ${EASE}}
  .sv-custom:hover{border-color:${S.borderHover};color:${S.text}}
  .sv-custom[data-on="true"]{border-color:${S.accent};color:${S.text}}
  .sv-custom input{width:24px;height:24px;padding:0;border:none;border-radius:999px;background:none;cursor:pointer;overflow:hidden}
  .sv-custom input::-webkit-color-swatch-wrapper{padding:0}
  .sv-custom input::-webkit-color-swatch{border:none;border-radius:999px}
  .sv-custom input::-moz-color-swatch{border:none;border-radius:999px}

  .sv-btn{height:36px;padding:0 18px;border-radius:999px;border:1px solid ${S.border};background:transparent;color:${S.textSec};font-size:13.5px;font-weight:500;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background-color 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE}}
  .sv-btn:hover{background:rgba(255,255,255,0.04);border-color:${S.borderHover};color:${S.text}}
  .sv-btn-sm{height:30px;padding:0 12px;font-size:12.5px}
  .sv-btn-accent{height:36px;padding:0 22px;border-radius:999px;border:none;background:${S.accent};color:#fff;font-size:13.5px;font-weight:600;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:filter 150ms ${EASE},transform 100ms ${EASE}}
  .sv-btn-accent:hover{filter:brightness(1.1)}
  .sv-btn-accent:active{filter:brightness(0.95);transform:scale(0.98);transition-duration:80ms}
  .sv-ask{height:24px;padding:0 8px 0 6px;border-radius:999px;border:none;background:none;color:${S.accent};font-size:12px;font-weight:500;font-family:inherit;display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;transition:background-color 150ms ${EASE}}
  .sv-ask:hover,.sv-ask[aria-expanded="true"]{background:rgba(74,144,255,0.10)}
  .sv-switch{position:relative;width:36px;height:20px;border-radius:999px;border:none;padding:0;flex-shrink:0;cursor:pointer;background:rgba(255,255,255,0.14);transition:background-color 150ms ${EASE}}
  .sv-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:999px;background:#fff;transition:transform 150ms ${EASE}}
  .sv-switch[aria-checked="true"]{background:${S.accent}}
  .sv-switch[aria-checked="true"]::after{transform:translateX(16px)}
  .sv-icon-btn:focus-visible,.sv-btn:focus-visible,.sv-btn-accent:focus-visible,.sv-ask:focus-visible,.sv-switch:focus-visible,.sv-opt:focus-visible,.sv-swatch:focus-visible,.sv-rail-item:focus-visible,.sv-custom:focus-within{outline:2px solid ${S.accent};outline-offset:2px}

  .sv-card{border:1px solid ${S.border};border-radius:12px;background:${S.bgElevated}}
  .sv-tier{border:1px solid ${S.border};border-radius:12px;background:${S.bgElevated};padding:14px 14px 12px;margin-bottom:10px}
  .sv-review-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:11px 16px;border-top:1px solid ${S.border}}

  .sv-footer{border-top:1px solid ${S.border};flex-shrink:0;padding:12px 0 calc(12px + env(safe-area-inset-bottom))}
  .sv-footer-inner,.sv-footer-errors{width:600px;max-width:100%;margin:0 auto;padding:0 24px}
  .sv-footer-inner{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .sv-footer-errors{margin-bottom:10px}

  @media (max-width:640px){
    .sv-grid{grid-template-columns:1fr}
    .sv-content{padding:24px 20px 40px}
    .sv-rail{padding:14px 20px 8px}
    .sv-footer-inner,.sv-footer-errors{padding:0 20px}
    .sv-input,.sv-select{height:44px}
    .sv-review-row{flex-direction:column;gap:2px}
    .sv-review-row > span:last-child{text-align:left !important;max-width:100% !important}
  }
  @media (prefers-reduced-motion:reduce){.sv-content,.sv-tip{animation:none !important}}
`;

// ─── Icons: drawn for this form, 1.5px stroke ───────────────────────

const Svg = ({ children, size = 16, stroke = 1.5 }: { children: React.ReactNode; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const XIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M7 7l10 10M17 7L7 17" /></Svg>;
const PlusIcon = ({ size = 14 }: { size?: number }) => <Svg size={size} stroke={1.8}><path d="M12 5v14M5 12h14" /></Svg>;
const CheckIcon = ({ size = 16 }: { size?: number }) => <Svg size={size} stroke={2}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>;
/** The Zelrex Z, same mark as the product tour. */
const ZMark = ({ size = 13 }: { size?: number }) => <Svg size={size} stroke={2}><path d="M6 6.5h12L6 17.5h12" /></Svg>;

// ─── Main Component ─────────────────────────────────────────────────

const STEP_TITLES = ["Your Business", "Your Service", "Brand & Style", "Contact Info", "Review & Build"];
const STEP_SHORT = ["Business", "Service", "Brand", "Contact", "Review"];
const STEP_DESCS = [
  "Tell us about your business so we can build something truly yours",
  "Define your offer — pricing, deliverables, and turnaround",
  "Choose your visual identity and brand personality",
  "How can your clients reach you?",
  "Everything looks good? Let's build it.",
];

export function WebsiteSurvey({
  onComplete,
  onClose,
  onAskZelrex,
  initialData,
}: {
  onComplete: (data: SurveyData) => void;
  onClose: () => void;
  onAskZelrex?: (question: string) => void;
  initialData?: Partial<SurveyData>;
}) {
  const [step, setStep] = useState(0);
  const totalSteps = 5;
  const [zelrexTip, setZelrexTip] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<SurveyData>({
    businessName: initialData?.businessName ?? "",
    tagline: initialData?.tagline ?? "",
    businessType: initialData?.businessType ?? "",
    targetAudience: initialData?.targetAudience ?? "",
    mainService: initialData?.mainService ?? "",
    serviceDescription: initialData?.serviceDescription ?? "",
    deliverables: initialData?.deliverables ?? [""],
    turnaround: initialData?.turnaround ?? "",
    pricingModel: initialData?.pricingModel ?? "package",
    price: initialData?.price ?? "",
    hasMultipleTiers: initialData?.hasMultipleTiers ?? false,
    tiers: initialData?.tiers ?? [
      { name: "", price: "", features: [""] },
    ],
    guarantee: initialData?.guarantee ?? "",
    stripeCheckout: initialData?.stripeCheckout ?? "auto",
    primaryColor: initialData?.primaryColor ?? "#4A90FF",
    stylePreference: initialData?.stylePreference ?? "dark-premium",
    fontPreference: initialData?.fontPreference ?? "modern",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    location: initialData?.location ?? "",
    hours: initialData?.hours ?? "",
    socialLinks: initialData?.socialLinks ?? [],
    calendlyUrl: initialData?.calendlyUrl ?? "",
    aboutStory: initialData?.aboutStory ?? "",
    uniqueSellingPoint: initialData?.uniqueSellingPoint ?? "",
    platformsLeavingFrom: initialData?.platformsLeavingFrom ?? "",
  });

  function update<K extends keyof SurveyData>(key: K, value: SurveyData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  // FIXED: Autosave draft to localStorage every 500ms.
  useEffect(() => {
    const draftKey = "zelrex_survey_draft_active";
    const saveTimer = setTimeout(() => {
      try {
        // Only save if there's actual content (not just defaults)
        const hasContent = data.businessName || data.tagline || data.mainService || data.email;
        if (hasContent) {
          localStorage.setItem(draftKey, JSON.stringify({
            savedAt: Date.now(),
            step,
            data,
          }));
        }
      } catch {}
    }, 500);
    return () => clearTimeout(saveTimer);
  }, [data, step]);

  useEffect(() => {
    // Restore step from saved draft if matching content
    try {
      const draftKey = "zelrex_survey_draft_active";
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        // Only restore step if data was also restored (passed via initialData)
        if (parsed.step !== undefined && parsed.data?.businessName === data.businessName && parsed.data?.businessName) {
          setStep(parsed.step);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [errors, setErrors] = useState<string[]>([]);

  // Each step starts at the top (the scroll container is shared between steps).
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [step]);

  // Esc closes, like every other panel. The draft is already autosaved.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validateStep(s: number): string[] {
    const e: string[] = [];
    if (s === 0) {
      if (!data.businessName.trim()) e.push("Business name is required");
      if (!data.businessType) e.push("Select your service type");
      if (!data.targetAudience.trim()) e.push("Describe your ideal client");
    } else if (s === 1) {
      if (!data.mainService.trim()) e.push("Name your main service");
      if (!data.serviceDescription.trim()) e.push("Describe what the client gets");
      if (!data.hasMultipleTiers && !data.price.trim()) e.push("Set your price");
      if (data.hasMultipleTiers && data.tiers.every((t) => !t.name.trim() || !t.price.trim())) e.push("Fill in at least one tier");
    } else if (s === 2) {
      // No hard requirements — all have defaults
    } else if (s === 3) {
      if (!data.email.trim()) e.push("Email is required for your contact page");
    }
    return e;
  }

  function next() {
    const errs = validateStep(step);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Clear draft on successful completion
      try { localStorage.removeItem("zelrex_survey_draft_active"); } catch {}
      onComplete(data);
    }
  }
  function back() { setErrors([]); if (step > 0) setStep(step - 1); }
  /** Jump to an earlier step (only ever backwards, so nothing can be skipped past validation). */
  function goTo(i: number) { if (i < step) { setErrors([]); setStep(i); } }

  // ─── Ask Zelrex: questions mapped to each survey field ───────
  // These get pasted into the chat when the user clicks "Ask Zelrex"
  // LEGAL: Every pricing/money question includes a disclaimer
  function buildAskQuestion(key: string): string {
    const biz = data.businessType || "my service";
    const aud = data.targetAudience || "my target audience";
    const svc = data.mainService || data.businessType || "my service";
    const name = data.businessName || "my business";
    const base: Record<string, string> = {
      businessName: `Help me come up with a professional business name. I offer ${biz} for ${aud}. Give me a few options with reasoning — I'll pick the one that fits best.`,
      tagline: `Help me write a one-line tagline for ${name}. I do ${svc} for ${aud}. Give me a few options. I'll make the final choice.`,
      businessType: `Help me figure out which freelance category fits what I do. I'll describe my work and you tell me which category makes the most sense.`,
      targetAudience: `Help me define my ideal client. I do ${biz}. What types of businesses or people would pay well for this and be good to work with? Give me 2-3 specific profiles. I'll decide which fits best.`,
      mainService: `Help me name my main service. I do ${biz} for ${aud}. What should I call this package? Give me a few options that sound professional. I'll pick the one I like.`,
      serviceDescription: `Help me write a clear description of what my client gets when they hire me. I do ${svc} for ${aud}. Make it specific and outcome-focused. I'll edit it to match my voice.`,
      deliverables: `Help me figure out what deliverables to include in my ${svc} package for ${aud}. What should clients expect to receive? I'll choose what to include based on what I can actually deliver.`,
      turnaround: `What's a realistic turnaround time for ${svc}? I want to be competitive but not over-promise. I'll set the final timeline based on my capacity.`,
      pricingModel: `Help me decide between package, hourly, retainer, or per-project pricing for ${svc} targeting ${aud}. What tends to work best? Important: this is general business guidance only, not financial advice. I'll make the final pricing structure decision.`,
      price: `What are freelancers typically charging for ${svc} targeting ${aud}? Give me market ranges so I can position myself. Important: this is market research only, not financial advice. All pricing decisions are mine and depend on my specific situation.`,
      tiers: `Help me structure pricing tiers for ${svc}. What should each tier include? Important: this is general business guidance only, not financial advice. All pricing decisions are mine.`,
      guarantee: `Help me come up with a guarantee for ${svc} that makes clients feel safe without putting me at too much risk. I'll choose one I'm comfortable with.`,
      stripeCheckout: `Explain how Stripe checkout works with Zelrex. How does payment get to me? Is it secure? Zelrex never touches my money directly, right?`,
      primaryColor: `Help me pick a brand color for ${biz} targeting ${aud}. What colors work best for this industry?`,
      stylePreference: `Help me choose a website style for ${name}. I do ${biz} for ${aud}. Which style would look most professional and convert best?`,
      fontPreference: `Help me pick a typography style for ${name}. What font feel matches ${biz} best?`,
      email: `Should I get a professional email matching my domain for my freelance business? What are the options?`,
      phone: `Should I include a phone number on my freelance website? What are the pros and cons?`,
      location: `Should I list my location on my freelance site even if I work remotely?`,
      calendly: `Should I use a booking tool like Calendly for my freelance business? How does it help with getting clients?`,
      socialPlatforms: `Which social media platforms should I focus on for ${biz} targeting ${aud}?`,
      hours: `Should I set business hours for my freelance business? What hours make sense?`,
      platformsLeaving: `I'm thinking about leaving freelance platforms to go independent. What should I know about the transition?`,
    };
    return base[key] || `Help me figure out what to put for "${key}" on my website.`;
  }

  const last = step === totalSteps - 1;

  return (
    <div role="dialog" aria-modal="true" aria-label="Build your website" className="sv-root" style={{
      position: "fixed", inset: 0, zIndex: 9999, background: S.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif", color: S.text,
    }}>
      <style>{SURVEY_CSS}</style>

      {/* Header: same shape as every other panel */}
      <div className="sv-header">
        <span style={{ fontSize: 14, fontWeight: 600, color: S.text, letterSpacing: "-0.01em" }}>Build your website</span>
        <button type="button" className="sv-icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)"><XIcon size={17} /></button>
      </div>

      <div className="sv-scroll" ref={scrollRef}>
        {/* Step rail: finished steps are buttons, so you can go back and fix something */}
        <div className="sv-rail-wrap"><nav className="sv-rail" aria-label="Progress">
          {STEP_SHORT.map((label, i) => {
            const done = i < step;
            return (
              <button key={label} type="button" className="sv-rail-item" data-on={i <= step} data-done={done} data-current={i === step}
                onClick={() => goTo(i)} disabled={!done} aria-current={i === step ? "step" : undefined} aria-label={`Step ${i + 1} of ${totalSteps}: ${label}${done ? " (completed, go back)" : ""}`}>
                <div className="sv-rail-bar" />
                <span className="sv-rail-label" aria-hidden>{label}</span>
              </button>
            );
          })}
        </nav></div>

        <div className="sv-content" key={step}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: S.text }}>{STEP_TITLES[step]}</h1>
          <p style={{ margin: "10px 0 32px", fontSize: 14, lineHeight: 1.6, color: S.textSec }}>{STEP_DESCS[step]}</p>

          {step === 0 && <StepBusiness data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
          {step === 1 && <StepService data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
          {step === 2 && <StepBrand data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
          {step === 3 && <StepContact data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
          {step === 4 && <StepReview data={data} onEdit={goTo} />}
        </div>
      </div>

      <div className="sv-footer">
        {errors.length > 0 && (
          <div role="alert" className="sv-footer-errors">
            {errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: S.danger, lineHeight: 1.6 }}>{e}</div>)}
          </div>
        )}
        <div className="sv-footer-inner">
          {step > 0 ? <button type="button" onClick={back} className="sv-btn">Back</button> : <span />}
          <button type="button" onClick={next} className="sv-btn-accent">{last ? "Build my website" : "Continue"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared form pieces ─────────────────────────────────────────────

/** Gives every field a label id that its inputs point at with aria-labelledby, so screen readers read "Business name" not just the placeholder. */
const FieldCtx = createContext<string | undefined>(undefined);

function FieldGroup({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const id = useId();
  return <FieldCtx.Provider value={`${id}-label`}><div style={{ marginBottom: 28, ...style }}>{children}</div></FieldCtx.Provider>;
}

function Label({ children, required, askKey, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: { children: React.ReactNode; required?: boolean; askKey?: string; zelrexTip?: string | null; setZelrexTip?: (k: string | null) => void; onAskZelrex?: (question: string) => void; buildAskQuestion?: (key: string) => string }) {
  const labelId = useContext(FieldCtx);
  const open = !!askKey && zelrexTip === askKey;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, minHeight: 24 }}>
      <span id={labelId} style={{ fontSize: 13.5, fontWeight: 500, color: S.text, letterSpacing: "-0.005em" }}>
        {children}
        {required && <><span aria-hidden style={{ color: S.accent, marginLeft: 4 }}>*</span><span className="sv-sr"> (required)</span></>}
      </span>
      {askKey && setZelrexTip && (
        <button type="button" className="sv-ask" aria-expanded={onAskZelrex ? undefined : open} aria-label={`Ask Zelrex about ${typeof children === "string" ? children : "this field"}`} onClick={() => {
          if (onAskZelrex && buildAskQuestion) {
            onAskZelrex(buildAskQuestion(askKey));
          } else {
            setZelrexTip(open ? null : askKey);
          }
        }}>
          <ZMark />
          Ask Zelrex
        </button>
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: S.textMuted, marginBottom: 10, lineHeight: 1.55 }}>{children}</div>;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

function Input({ value, onChange, placeholder, ...rest }: InputProps) {
  const labelId = useContext(FieldCtx);
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="sv-input"
      aria-labelledby={labelId}
      {...rest}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const labelId = useContext(FieldCtx);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="sv-input"
      aria-labelledby={labelId}
    />
  );
}

function OptionGrid({ options, value, onChange }: {
  options: Array<{ key: string; label: string; desc?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelId = useContext(FieldCtx);
  return (
    <div className="sv-grid" role="radiogroup" aria-labelledby={labelId}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button key={opt.key} type="button" role="radio" aria-checked={active} onClick={() => onChange(opt.key)} className="sv-opt">
            <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.005em" }}>{opt.label}</div>
            {opt.desc && <div style={{ fontSize: 12, color: S.textMuted, marginTop: 3, lineHeight: 1.45 }}>{opt.desc}</div>}
            <span className="sv-opt-check"><CheckIcon /></span>
          </button>
        );
      })}
    </div>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
      <button type="button" role="switch" aria-checked={checked} className="sv-switch" onClick={() => onChange(!checked)} aria-label={typeof children === "string" ? children : undefined} />
      <span style={{ fontSize: 13.5, color: S.textSec, cursor: "pointer" }} onClick={() => onChange(!checked)}>{children}</span>
    </div>
  );
}

function AddButton({ onClick, children, small }: { onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return <button type="button" className={`sv-btn${small ? " sv-btn-sm" : ""}`} onClick={onClick}><PlusIcon />{children}</button>;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="sv-icon-btn" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${S.border}` }} onClick={onClick} aria-label={label} title={label}><XIcon size={15} /></button>;
}

// ─── Ask Zelrex Tips ──────────────────────────────────────────────
// Shown inline when the survey isn't wired to the chat. General guidance only: no invented statistics.

const ZELREX_TIPS: Record<string, string> = {
  businessName: "Your business name is your brand identity. For freelancers, using your real name + what you do works well (e.g., 'Sarah Chen Design'). Avoid generic names — specific beats clever. Make sure it's easy to spell and say out loud.",
  tagline: "Your tagline should answer: 'What do you do and for whom?' in one line. Focus on the outcome you deliver, not the process. Example: 'Brand identity for startups that want to look like they've been around for years.'",
  businessType: "Pick the category that best matches your primary revenue source. If you do multiple things, choose the one you want to be known for. A specialist is easier to remember and to refer than a generalist.",
  targetAudience: "The more specific your audience, the easier it is for a visitor to recognise themselves. 'SaaS startups with 10-50 employees' gives them more to latch onto than 'businesses.' Think: industry + size + the specific problem they have.",
  platformsLeaving: "If you're leaving a platform like Upwork or Fiverr, that can be a selling point: it shows you've already had paying clients. Your website can position you as the direct alternative.",
  mainService: "Name your service like a product, not a skill. 'Complete Brand Identity Package' sounds more valuable than 'Logo Design.' A clear name also makes your pricing easier to explain.",
  serviceDescription: "Lead with the transformation, not the deliverable. Instead of 'I make logos,' try 'I build visual identities that make startups look established and trustworthy from day one.' Paint the before/after.",
  deliverables: "List concrete, tangible things the client receives. Each deliverable should feel like it has standalone value. Include file formats and revision counts so there are no surprises later.",
  turnaround: "Faster delivery can justify a higher price, but only promise what you can actually do. Under-promising and over-delivering builds referrals. Pick a timeline you could still hit in a busy week.",
  pricingModel: "Packages tie the price to an outcome instead of hours, which many freelancers prefer. Hourly pays you less the faster you work. If you're unsure, you could start with a package and keep hourly for add-ons. It's your call, and this is general guidance, not financial advice.",
  price: "Many freelancers price on the value delivered rather than time spent. Look at what your target clients already pay for similar work, then decide where you want to sit in that range. This is general guidance, not financial advice.",
  tiers: "Three tiers is a common pattern: the offer you most want to sell in the middle, a smaller option below it and a fuller one above. You decide what goes in each. This is general guidance, not financial advice.",
  guarantee: "A guarantee lowers the buyer's risk, but only offer one you're comfortable honouring. Write down exactly what it covers, and check what rules apply to refunds where you and your clients are based.",
  primaryColor: "Your brand color should match your industry's emotional tone. Blue = trust (consulting, tech). Green = growth (coaching). Black/dark = premium (design, creative). Avoid colors that blend in with competitors.",
  stylePreference: "Match the feel your ideal clients expect. Dark and premium often suits creative and technical work, light and clean often suits consulting and coaching, and bold and colorful often suits agencies and marketing.",
  fontPreference: "Modern = clean innovation. Classic = trusted reliability. Editorial = refined authority. Tech = bold precision. Studio = creative portfolio. Luxury = premium elegance.",
  email: "Use a professional email that matches your business name. yourname@yourbusiness.com looks more credible than a Gmail address. You can set this up later with your custom domain.",
  phone: "A phone number can add trust, but only list one you'll actually answer. If you'd rather not share your personal number, a separate number from a service like Google Voice is an option.",
  location: "Even remote businesses benefit from listing a general location. It helps with local SEO and gives clients context. You don't need a street address — city and state/country is enough.",
  calendly: "A booking link removes a round of emailing: visitors can pick a time themselves instead of waiting for your reply.",
  socialPlatforms: "Only list platforms where you're actually active and posting relevant content. An empty social profile can hurt more than no social presence. Two or three where your clients actually spend time is plenty.",
  hours: "Setting business hours creates boundaries and professionalism. It also tells clients when to expect a reply. Even 'Mon-Fri 9-5' signals you run a real business.",
  stripeCheckout: "Adding Stripe checkout to your website means clients can pay you directly from your pricing page — no back-and-forth invoicing. Zelrex creates the checkout on YOUR Stripe account: payments go to your account and Stripe pays them out to you. You'll need a Stripe account (free to create). If you're not ready for payments, choose 'No payments yet' and add it later.",
};

function ZelrexTipPopover({ tipKey }: { tipKey: string }) {
  const tip = ZELREX_TIPS[tipKey];
  if (!tip) return null;
  return (
    <div className="sv-tip" role="note" style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${S.border}`, background: S.bgElevated, animation: `sv-tip 200ms ${EASE} both` }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: S.accent, marginBottom: 4 }}>Zelrex</div>
      <div style={{ fontSize: 13, color: S.textSec, lineHeight: 1.65 }}>{tip}</div>
    </div>
  );
}

// ─── Step 1: Business Basics ────────────────────────────────────────

type StepProps = { data: SurveyData; update: <K extends keyof SurveyData>(k: K, v: SurveyData[K]) => void; zelrexTip: string | null; setZelrexTip: (k: string | null) => void; onAskZelrex?: (question: string) => void; buildAskQuestion?: (key: string) => string };

function StepBusiness({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  return (
    <div>
      <FieldGroup>
        <Label required askKey="businessName" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Business name</Label>
        {zelrexTip === "businessName" && <ZelrexTipPopover tipKey="businessName" />}
        <Input value={data.businessName} onChange={(v) => update("businessName", v)} placeholder="e.g., Sarah Chen Design" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="tagline" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Tagline (one line that says what you do)</Label>
        {zelrexTip === "tagline" && <ZelrexTipPopover tipKey="tagline" />}
        <Hint>This becomes your hero subtitle. Make it clear, not clever.</Hint>
        <Input value={data.tagline} onChange={(v) => update("tagline", v)} placeholder="e.g., Brand identity and web design for startups" />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="businessType" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>What type of service do you offer?</Label>
        {zelrexTip === "businessType" && <ZelrexTipPopover tipKey="businessType" />}
        <OptionGrid
          value={data.businessType}
          onChange={(v) => update("businessType", v)}
          options={[
            { key: "video editing", label: "Video Editing", desc: "YouTube, social, corporate" },
            { key: "design", label: "Design", desc: "Brand, graphic, UI/UX, web" },
            { key: "writing", label: "Writing", desc: "Copy, content, ghostwriting" },
            { key: "social media", label: "Social Media", desc: "Management, content, strategy" },
            { key: "virtual assistance", label: "Virtual Assistance", desc: "Admin, ops, support" },
            { key: "coaching", label: "Coaching", desc: "Life, business, fitness" },
            { key: "consulting", label: "Consulting", desc: "Strategy, advisory" },
            { key: "agency", label: "Agency", desc: "Full-service team" },
          ]}
        />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="targetAudience" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Who is your ideal client?</Label>
        {zelrexTip === "targetAudience" && <ZelrexTipPopover tipKey="targetAudience" />}
        <Hint>Be specific.</Hint>
        <Input value={data.targetAudience} onChange={(v) => update("targetAudience", v)} placeholder="e.g., SaaS startups with 10-50 employees who need a rebrand" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="platformsLeaving" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Are you leaving a platform? (optional)</Label>
        {zelrexTip === "platformsLeaving" && <ZelrexTipPopover tipKey="platformsLeaving" />}
        <Input value={data.platformsLeavingFrom} onChange={(v) => update("platformsLeavingFrom", v)} placeholder="e.g., Upwork, Fiverr" />
      </FieldGroup>
    </div>
  );
}

// ─── Step 2: Service Details ────────────────────────────────────────

function StepService({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  return (
    <div>
      <FieldGroup>
        <Label required askKey="mainService" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Main service name</Label>
        {zelrexTip === "mainService" && <ZelrexTipPopover tipKey="mainService" />}
        <Hint>What would you call this offer on a menu?</Hint>
        <Input value={data.mainService} onChange={(v) => update("mainService", v)} placeholder="e.g., Complete Brand Identity Package" />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="serviceDescription" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Describe what the client gets.</Label>
        {zelrexTip === "serviceDescription" && <ZelrexTipPopover tipKey="serviceDescription" />}
        <TextArea value={data.serviceDescription} onChange={(v) => update("serviceDescription", v)} placeholder="e.g., I design your complete brand identity from scratch — logo, colors, typography, and brand guidelines. You get 3 concepts, unlimited revisions on the chosen direction, and a brand book delivered in 2 weeks." />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="deliverables" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>What's included? (one per line)</Label>
        {zelrexTip === "deliverables" && <ZelrexTipPopover tipKey="deliverables" />}
        <Hint>List specific deliverables.</Hint>
        {data.deliverables.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Input value={d} onChange={(v) => {
              const next = [...data.deliverables];
              next[i] = v;
              update("deliverables", next);
            }} placeholder={`Deliverable ${i + 1}`} aria-label={`Deliverable ${i + 1}`} aria-labelledby={undefined} />
            {data.deliverables.length > 1 && (
              <RemoveButton label={`Remove deliverable ${i + 1}`} onClick={() => update("deliverables", data.deliverables.filter((_, j) => j !== i))} />
            )}
          </div>
        ))}
        <AddButton onClick={() => update("deliverables", [...data.deliverables, ""])}>Add deliverable</AddButton>
      </FieldGroup>

      <FieldGroup>
        <Label askKey="turnaround" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Turnaround time</Label>
        {zelrexTip === "turnaround" && <ZelrexTipPopover tipKey="turnaround" />}
        <Input value={data.turnaround} onChange={(v) => update("turnaround", v)} placeholder="e.g., 2 weeks, 48 hours, same-day" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="pricingModel" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Pricing model</Label>
        {zelrexTip === "pricingModel" && <ZelrexTipPopover tipKey="pricingModel" />}
        <OptionGrid
          value={data.pricingModel}
          onChange={(v) => update("pricingModel", v as SurveyData["pricingModel"])}
          options={[
            { key: "package", label: "Package", desc: "Fixed price for the full service" },
            { key: "retainer", label: "Retainer", desc: "Monthly ongoing" },
            { key: "project", label: "Per Project", desc: "Custom quote per job" },
            { key: "hourly", label: "Hourly", desc: "Billed by the hour" },
          ]}
        />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="price" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>{data.hasMultipleTiers ? "See tiers below" : "Your price"}</Label>
        {zelrexTip === "price" && <ZelrexTipPopover tipKey="price" />}
        {!data.hasMultipleTiers && (
          <Input value={data.price} onChange={(v) => update("price", v)} placeholder="e.g., $1,500, $150/hr, $500/month" />
        )}
        <Switch checked={data.hasMultipleTiers} onChange={(v) => update("hasMultipleTiers", v)}>I have multiple pricing tiers</Switch>
      </FieldGroup>

      {data.hasMultipleTiers && (
        <FieldGroup>
          <Label askKey="tiers" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Pricing tiers</Label>
          {zelrexTip === "tiers" && <ZelrexTipPopover tipKey="tiers" />}
          {data.tiers.map((tier, i) => (
            <div key={i} className="sv-tier" role="group" aria-label={`Tier ${i + 1}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: S.textSec }}>Tier {i + 1}</span>
                {data.tiers.length > 1 && (
                  <button type="button" className="sv-btn sv-btn-sm" style={{ height: 26, padding: "0 10px" }} onClick={() => update("tiers", data.tiers.filter((_, j) => j !== i))} aria-label={`Remove tier ${i + 1}`}>Remove</button>
                )}
              </div>
              <div className="sv-grid" style={{ marginBottom: 10 }}>
                <Input value={tier.name} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, name: v }; update("tiers", next);
                }} placeholder="Tier name (e.g., Starter)" aria-label={`Tier ${i + 1} name`} aria-labelledby={undefined} />
                <Input value={tier.price} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, price: v }; update("tiers", next);
                }} placeholder="Price (e.g., $500)" aria-label={`Tier ${i + 1} price`} aria-labelledby={undefined} />
              </div>
              {tier.features.map((f, j) => (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <Input value={f} onChange={(v) => {
                    const next = [...data.tiers];
                    const feats = [...tier.features]; feats[j] = v;
                    next[i] = { ...tier, features: feats };
                    update("tiers", next);
                  }} placeholder={`Feature ${j + 1}`} aria-label={`Tier ${i + 1} feature ${j + 1}`} aria-labelledby={undefined} />
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <AddButton small onClick={() => {
                  const next = [...data.tiers];
                  next[i] = { ...tier, features: [...tier.features, ""] };
                  update("tiers", next);
                }}>Feature</AddButton>
              </div>
            </div>
          ))}
          <AddButton onClick={() => update("tiers", [...data.tiers, { name: "", price: "", features: [""] }])}>Add tier</AddButton>
        </FieldGroup>
      )}

      <FieldGroup>
        <Label askKey="guarantee" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Guarantee or risk-reducer (optional)</Label>
        {zelrexTip === "guarantee" && <ZelrexTipPopover tipKey="guarantee" />}
        <Hint>What makes it safe for the client to say yes?</Hint>
        <Input value={data.guarantee} onChange={(v) => update("guarantee", v)} placeholder="e.g., 100% refund if not satisfied within 7 days" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="stripeCheckout" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>How do you want to accept payments?</Label>
        {zelrexTip === "stripeCheckout" && <ZelrexTipPopover tipKey="stripeCheckout" />}
        <Hint>Zelrex can create a Stripe checkout and wire it directly into your pricing buttons.</Hint>
        <OptionGrid
          value={data.stripeCheckout}
          onChange={(v) => update("stripeCheckout", v as SurveyData["stripeCheckout"])}
          options={[
            { key: "auto", label: "Add to my website", desc: "Zelrex creates checkout & adds to pricing buttons" },
            { key: "link-only", label: "Just give me the links", desc: "I'll add payment links myself" },
            { key: "none", label: "No payments yet", desc: "I'll set up payments later" },
          ]}
        />
      </FieldGroup>
    </div>
  );
}

// ─── Step 3: Brand & Visual ─────────────────────────────────────────

const BRAND_COLORS = [
  { hex: "#4A90FF", name: "Blue" },
  { hex: "#8B5CF6", name: "Purple" },
  { hex: "#10B981", name: "Green" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#EF4444", name: "Red" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#F97316", name: "Orange" },
];

function StepBrand({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  const isPreset = BRAND_COLORS.some((c) => c.hex.toLowerCase() === data.primaryColor.toLowerCase());
  return (
    <div>
      <FieldGroup>
        <Label askKey="primaryColor" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Primary brand color</Label>
        {zelrexTip === "primaryColor" && <ZelrexTipPopover tipKey="primaryColor" />}
        <Hint>This will be your accent color for buttons and highlights.</Hint>
        <ColorPicker value={data.primaryColor} isPreset={isPreset} onChange={(hex) => update("primaryColor", hex)} />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="stylePreference" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Website style</Label>
        {zelrexTip === "stylePreference" && <ZelrexTipPopover tipKey="stylePreference" />}
        <OptionGrid
          value={data.stylePreference}
          onChange={(v) => update("stylePreference", v as SurveyData["stylePreference"])}
          options={[
            { key: "dark-premium", label: "Dark & Premium", desc: "Like Stripe, Linear, Vercel" },
            { key: "light-clean", label: "Light & Clean", desc: "Like Apple, Notion" },
            { key: "bold-colorful", label: "Bold & Colorful", desc: "Like Figma, Slack" },
            { key: "minimal-elegant", label: "Minimal & Elegant", desc: "Like Squarespace, Aesop" },
          ]}
        />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="fontPreference" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Typography feel</Label>
        {zelrexTip === "fontPreference" && <ZelrexTipPopover tipKey="fontPreference" />}
        <OptionGrid
          value={data.fontPreference}
          onChange={(v) => update("fontPreference", v as SurveyData["fontPreference"])}
          options={[
            { key: "modern", label: "Modern", desc: "Clean sans-serif" },
            { key: "classic", label: "Classic", desc: "Serif, timeless" },
            { key: "editorial", label: "Editorial", desc: "Magazine-style mix" },
            { key: "tech", label: "Technical", desc: "Mono + sans" },
            { key: "studio", label: "Studio", desc: "Creative portfolio" },
            { key: "luxury", label: "Luxury", desc: "Premium elegance" },
          ]}
        />
      </FieldGroup>

      <FieldGroup>
        <Label>What makes you different from competitors?</Label>
        <Hint>This becomes the core message on your site.</Hint>
        <Input value={data.uniqueSellingPoint} onChange={(v) => update("uniqueSellingPoint", v)} placeholder="e.g., I deliver in 48 hours, not 2 weeks. Same quality, 10x faster." />
      </FieldGroup>
    </div>
  );
}

function ColorPicker({ value, isPreset, onChange }: { value: string; isPreset: boolean; onChange: (hex: string) => void }) {
  const labelId = useContext(FieldCtx);
  return (
    <div role="radiogroup" aria-labelledby={labelId} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "4px 4px" }}>
      {BRAND_COLORS.map((c) => (
        <button key={c.hex} type="button" role="radio" aria-checked={value.toLowerCase() === c.hex.toLowerCase()} aria-label={c.name} title={c.name}
          className="sv-swatch" style={{ background: c.hex }} onClick={() => onChange(c.hex)} />
      ))}
      <label className="sv-custom" data-on={!isPreset} title="Pick any color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#4A90FF"} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
        Custom
      </label>
    </div>
  );
}

// ─── Step 4: Contact & Social ───────────────────────────────────────

function StepContact({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  const socialPlatforms = ["Twitter/X", "LinkedIn", "Instagram", "YouTube", "TikTok", "Facebook", "Discord", "Dribbble", "Behance", "GitHub"];

  return (
    <div>
      <FieldGroup>
        <Label required askKey="email" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Email address (shown on site)</Label>
        {zelrexTip === "email" && <ZelrexTipPopover tipKey="email" />}
        <Input value={data.email} onChange={(v) => update("email", v)} placeholder="hello@yourdomain.com" type="email" autoComplete="email" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="phone" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Phone number (optional)</Label>
        {zelrexTip === "phone" && <ZelrexTipPopover tipKey="phone" />}
        <Input value={data.phone} onChange={(v) => update("phone", v)} placeholder="+1 (555) 123-4567" type="tel" autoComplete="tel" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="location" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Location (optional)</Label>
        {zelrexTip === "location" && <ZelrexTipPopover tipKey="location" />}
        <Input value={data.location} onChange={(v) => update("location", v)} placeholder="e.g., Remote — based in Austin, TX" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="hours" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Business hours (optional)</Label>
        {zelrexTip === "hours" && <ZelrexTipPopover tipKey="hours" />}
        <Input value={data.hours} onChange={(v) => update("hours", v)} placeholder="e.g., Mon-Fri 9am-5pm EST" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="calendly" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Booking link (Calendly, Cal.com, etc.)</Label>
        {zelrexTip === "calendly" && <ZelrexTipPopover tipKey="calendly" />}
        <Hint>If you have one, Zelrex will embed it in your site.</Hint>
        <Input value={data.calendlyUrl} onChange={(v) => update("calendlyUrl", v)} placeholder="https://calendly.com/yourname" type="url" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="socialPlatforms" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Social media profiles</Label>
        {zelrexTip === "socialPlatforms" && <ZelrexTipPopover tipKey="socialPlatforms" />}
        <Hint>Add any that you want linked on your site.</Hint>
        {data.socialLinks.map((link, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select className="sv-select" style={{ width: 140, flexShrink: 0 }} aria-label={`Social profile ${i + 1} platform`} value={link.platform} onChange={(e) => {
              const next = [...data.socialLinks]; next[i] = { ...link, platform: e.target.value }; update("socialLinks", next);
            }}>
              {socialPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Input value={link.url} onChange={(v) => {
                const next = [...data.socialLinks]; next[i] = { ...link, url: v }; update("socialLinks", next);
              }} placeholder="https://..." aria-label={`${link.platform} link`} aria-labelledby={undefined} />
            </div>
            <RemoveButton label={`Remove ${link.platform} link`} onClick={() => update("socialLinks", data.socialLinks.filter((_, j) => j !== i))} />
          </div>
        ))}
        <AddButton onClick={() => update("socialLinks", [...data.socialLinks, { platform: "Twitter/X", url: "" }])}>Add social link</AddButton>
      </FieldGroup>

      <FieldGroup>
        <Label>Your story (optional — for the About page)</Label>
        <Hint>2-3 sentences about who you are and why you do this.</Hint>
        <TextArea value={data.aboutStory} onChange={(v) => update("aboutStory", v)} placeholder="e.g., I've been designing for 8 years, starting at a small agency in Brooklyn before going independent. I work directly with founders because I believe great design shouldn't require a $50K agency retainer." rows={4} />
      </FieldGroup>
    </div>
  );
}

// ─── Step 5: Review ─────────────────────────────────────────────────

/** Review shows words people chose, not the stored keys ("dark-premium"). Unknown values fall back to the raw text. */
const REVIEW_LABELS: Record<string, string> = {
  "dark-premium": "Dark & Premium", "light-clean": "Light & Clean", "bold-colorful": "Bold & Colorful", "minimal-elegant": "Minimal & Elegant",
  modern: "Modern", classic: "Classic", editorial: "Editorial", tech: "Technical", studio: "Studio", luxury: "Luxury",
};
const titleCase = (v: string) => v.replace(/\b\w/g, (c) => c.toUpperCase());

function StepReview({ data, onEdit }: { data: SurveyData; onEdit?: (step: number) => void }) {
  const sections = [
    { label: "Business", step: 0, items: [
      ["Name", data.businessName],
      ["Type", titleCase(data.businessType)],
      ["Tagline", data.tagline],
      ["Audience", data.targetAudience],
    ]},
    { label: "Service", step: 1, items: [
      ["Service", data.mainService],
      ["Price", data.hasMultipleTiers ? `${data.tiers.length} tiers` : data.price],
      ["Turnaround", data.turnaround],
      ["Deliverables", data.deliverables.filter(Boolean).join(", ")],
      ["Payments", data.stripeCheckout === "auto" ? "Stripe checkout on website" : data.stripeCheckout === "link-only" ? "Payment links only" : "Set up later"],
    ]},
    { label: "Brand", step: 2, items: [
      ["Style", REVIEW_LABELS[data.stylePreference] || data.stylePreference],
      ["Font", REVIEW_LABELS[data.fontPreference] || data.fontPreference],
      ["USP", data.uniqueSellingPoint],
    ]},
    { label: "Contact", step: 3, items: [
      ["Email", data.email],
      ["Phone", data.phone],
      ["Booking", data.calendlyUrl],
      ["Socials", data.socialLinks.length ? `${data.socialLinks.length} linked` : "None"],
    ]},
  ];

  return (
    <div>
      <p style={{ margin: "0 0 24px", fontSize: 13.5, color: S.textSec, lineHeight: 1.65 }}>
        Review your details below. Zelrex will use all of this to build your website — every headline, every section, every price will be real. No placeholders.
      </p>

      {sections.map((section) => {
        const rows = section.items.filter(([_, v]) => v);
        return (
          <section key={section.label} className="sv-card" style={{ marginBottom: 12 }} aria-label={section.label}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 10px 16px" }}>
              <h2 style={{ margin: 0, fontSize: 12, fontWeight: 500, color: S.textSec }}>{section.label}</h2>
              {onEdit && <button type="button" className="sv-btn sv-btn-sm" style={{ height: 26, padding: "0 10px" }} onClick={() => onEdit(section.step)} aria-label={`Edit ${section.label.toLowerCase()} details`}>Edit</button>}
            </div>
            {rows.length === 0
              ? <div className="sv-review-row" style={{ color: S.textMuted, fontSize: 13 }}>Nothing added</div>
              : rows.map(([label, value]) => (
                <div key={label} className="sv-review-row">
                  <span style={{ fontSize: 13, color: S.textMuted, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: S.text, textAlign: "right", maxWidth: "65%", overflowWrap: "anywhere" }}>{value}</span>
                </div>
              ))}
          </section>
        );
      })}

      <p style={{ margin: "20px 0 0", fontSize: 13, color: S.textSec, lineHeight: 1.65 }}>
        Zelrex will generate a multi-page website with all of this information. Every section will be customized to your business type and brand preferences.
      </p>
    </div>
  );
}
