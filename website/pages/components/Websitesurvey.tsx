/**
 * WEBSITE BUILDER SURVEY
 * 
 * A multi-step overlay that collects everything needed to make
 * each website truly bespoke. Pops up when user asks to build a website.
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
import React, { useState } from "react";

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
  fontPreference: "modern" | "classic" | "editorial" | "tech";
  
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

// ─── Colors ─────────────────────────────────────────────────────────

const S = {
  bg: "#06090F",
  overlay: "rgba(0,0,0,0.7)",
  surface: "rgba(10,15,26,0.85)",
  surfaceHover: "#101828",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.16)",
  accent: "#4A90FF",
  accentGlow: "rgba(74,144,255,0.12)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.30)",
  danger: "#EF4444",
  success: "#10B981",
};

// Liquid glass CSS injected once
const SURVEY_GLASS_CSS = `
  @keyframes surveyFadeIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes surveySlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes surveyPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  @keyframes surveyShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes zelrexTipIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  @media(max-width:640px) { .survey-option-grid { grid-template-columns: 1fr !important; } }
  @media(max-width:480px) {
    .survey-header { padding: 16px 18px 14px !important; }
    .survey-body { padding: 16px 18px !important; }
    .survey-footer { padding: 14px 18px !important; }
  }

  .sv-glass-card {
    position: relative; overflow: hidden; border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(12px) brightness(1.05);
    -webkit-backdrop-filter: blur(12px) brightness(1.05);
    transition: all 400ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-card::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0.3; pointer-events: none;
    background: linear-gradient(168deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.03) 20%,transparent 50%,transparent 65%,rgba(255,255,255,0.02) 82%,rgba(255,255,255,0.08) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -0.5px 0 rgba(255,255,255,0.03);
  }
  .sv-glass-card:hover { border-color: rgba(255,255,255,0.10); box-shadow: 0 4px 24px rgba(0,0,0,0.1); }

  .sv-glass-btn {
    position: relative; overflow: hidden; cursor: pointer; font-family: inherit;
    transition: all 500ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-btn::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0; pointer-events: none;
    background: linear-gradient(160deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.04) 15%,transparent 42%,transparent 58%,rgba(255,255,255,0.03) 80%,rgba(255,255,255,0.12) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.04);
    transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-btn::after {
    content: ''; position: absolute; top: -50%; left: 5%; width: 90%; height: 80%; border-radius: 50%; pointer-events: none; opacity: 0;
    background: radial-gradient(ellipse at 40% 25%,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.02) 35%,transparent 70%);
    transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-btn:hover::before, .sv-glass-btn:hover::after { opacity: 1; }
  .sv-glass-btn:hover {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.14) !important;
    backdrop-filter: blur(20px) brightness(1.22) saturate(1.6);
    -webkit-backdrop-filter: blur(20px) brightness(1.22) saturate(1.6);
    box-shadow: 0 0 0 0.5px rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.45);
    transform: translateY(-0.5px);
  }
  .sv-glass-btn:active { transform: scale(0.97) translateY(0) !important; transition-duration: 120ms; }
  .sv-glass-btn > * { position: relative; z-index: 1; }

  .sv-glass-btn-accent {
    position: relative; overflow: hidden; cursor: pointer; font-family: inherit; border: none;
    transition: all 500ms cubic-bezier(0.32,0.72,0,1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -0.5px 0 rgba(255,255,255,0.04);
  }
  .sv-glass-btn-accent::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0.4; pointer-events: none;
    background: linear-gradient(160deg,rgba(255,255,255,0.30) 0%,rgba(255,255,255,0.06) 18%,transparent 48%,transparent 58%,rgba(255,255,255,0.04) 82%,rgba(255,255,255,0.18) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.05);
    transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-btn-accent::after {
    content: ''; position: absolute; top: -50%; left: 5%; width: 90%; height: 80%; border-radius: 50%; pointer-events: none; opacity: 0.35;
    background: radial-gradient(ellipse at 40% 25%,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.03) 35%,transparent 65%);
    transition: opacity 600ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-btn-accent:hover::before, .sv-glass-btn-accent:hover::after { opacity: 1; }
  .sv-glass-btn-accent:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 36px rgba(74,144,255,0.35), inset 0 1px 0 rgba(255,255,255,0.30);
  }
  .sv-glass-btn-accent:active { transform: scale(0.97) translateY(0) !important; transition-duration: 120ms; }
  .sv-glass-btn-accent > * { position: relative; z-index: 1; }

  .sv-glass-input {
    width: 100%; padding: 11px 16px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06); background: rgba(6,9,15,0.8);
    color: rgba(255,255,255,0.92); font-size: 14px; font-family: inherit;
    outline: none; letter-spacing: -0.005em;
    transition: all 300ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-glass-input::placeholder { color: rgba(255,255,255,0.20); }
  .sv-glass-input:focus {
    border-color: rgba(74,144,255,0.4);
    box-shadow: 0 0 0 3px rgba(74,144,255,0.08), 0 0 20px rgba(74,144,255,0.06);
    background: rgba(6,9,15,0.95);
  }

  .sv-option {
    position: relative; overflow: hidden; text-align: left; padding: 14px 16px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06); background: transparent; cursor: pointer;
    transition: all 400ms cubic-bezier(0.32,0.72,0,1); font-family: inherit;
  }
  .sv-option::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0; pointer-events: none;
    background: linear-gradient(168deg,rgba(255,255,255,0.15) 0%,rgba(255,255,255,0.04) 18%,transparent 45%,transparent 60%,rgba(255,255,255,0.02) 80%,rgba(255,255,255,0.08) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -0.5px 0 rgba(255,255,255,0.04);
    transition: opacity 400ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-option:hover { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }
  .sv-option:hover::before { opacity: 1; }
  .sv-option:active { transform: scale(0.98); transition-duration: 120ms; }
  .sv-option-active {
    border-color: rgba(74,144,255,0.30) !important;
    background: rgba(74,144,255,0.08) !important;
    box-shadow: 0 0 0 0.5px rgba(74,144,255,0.20), 0 0 20px rgba(74,144,255,0.04), inset 0 1px 0 rgba(74,144,255,0.12);
  }
  .sv-option-active::before {
    opacity: 0.6 !important;
    background: linear-gradient(168deg,rgba(74,144,255,0.20) 0%,rgba(74,144,255,0.05) 18%,transparent 45%,transparent 60%,rgba(74,144,255,0.02) 80%,rgba(74,144,255,0.12) 100%) !important;
    box-shadow: inset 0 1px 0 rgba(74,144,255,0.30), inset 0 -0.5px 0 rgba(74,144,255,0.05) !important;
  }

  .sv-color-swatch {
    width: 48px; height: 48px; border-radius: 14px; cursor: pointer; position: relative; overflow: hidden;
    transition: all 400ms cubic-bezier(0.32,0.72,0,1); border: 2px solid transparent;
  }
  .sv-color-swatch::after {
    content: ''; position: absolute; top: -30%; left: 10%; width: 80%; height: 50%; border-radius: 50%; pointer-events: none;
    background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.30) 0%, transparent 70%);
  }
  .sv-color-swatch:hover { transform: scale(1.08) translateY(-2px); }
  .sv-color-swatch:active { transform: scale(0.95); }
  .sv-color-active { border-color: rgba(255,255,255,0.9) !important; box-shadow: 0 0 20px var(--swatch-glow); }

  .sv-progress-track { height: 3px; background: rgba(255,255,255,0.04); position: relative; overflow: hidden; }
  .sv-progress-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, #4A90FF, #10B981);
    transition: width 600ms cubic-bezier(0.32,0.72,0,1);
    box-shadow: 0 0 12px rgba(74,144,255,0.3);
  }

  .sv-step-dot {
    width: 8px; height: 8px; border-radius: 999px;
    transition: all 400ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-step-dot-active { background: #4A90FF; box-shadow: 0 0 8px rgba(74,144,255,0.5); }
  .sv-step-dot-done { background: #10B981; box-shadow: 0 0 6px rgba(16,185,129,0.4); }
  .sv-step-dot-pending { background: rgba(255,255,255,0.12); }

  .sv-tier-card {
    padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.015); margin-bottom: 10px;
    transition: all 300ms cubic-bezier(0.32,0.72,0,1);
  }
  .sv-tier-card:hover { border-color: rgba(255,255,255,0.10); background: rgba(255,255,255,0.025); }

  .sv-remove-btn {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06); background: transparent;
    color: rgba(255,255,255,0.25); cursor: pointer; font-size: 13px;
    transition: all 300ms cubic-bezier(0.32,0.72,0,1); display: flex;
    align-items: center; justify-content: center;
  }
  .sv-remove-btn:hover { border-color: rgba(239,68,68,0.3); color: #EF4444; background: rgba(239,68,68,0.06); }

  .sv-add-btn {
    padding: 7px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);
    background: transparent; color: rgba(255,255,255,0.45); font-size: 12.5px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 400ms cubic-bezier(0.32,0.72,0,1); letter-spacing: -0.005em;
  }
  .sv-add-btn:hover { border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.03); }

  .sv-social-select {
    padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);
    background: rgba(6,9,15,0.8); color: rgba(255,255,255,0.92); font-size: 13px;
    font-family: inherit; outline: none; appearance: none; -webkit-appearance: none;
    transition: all 300ms cubic-bezier(0.32,0.72,0,1);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 30px;
  }
  .sv-social-select:focus { border-color: rgba(74,144,255,0.4); box-shadow: 0 0 0 3px rgba(74,144,255,0.08); }
  .sv-social-select option { background: #0D1320; }

  .sv-review-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .sv-review-row:last-child { border-bottom: none; }
`;

// ─── Main Component ─────────────────────────────────────────────────

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

  const [errors, setErrors] = useState<string[]>([]);

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
    if (step < totalSteps - 1) setStep(step + 1);
    else onComplete(data);
  }
  function back() { setErrors([]); if (step > 0) setStep(step - 1); }

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

  const stepTitles = ["Your Business", "Your Service", "Brand & Style", "Contact Info", "Review & Build"];
  const stepDescs = [
    "Tell us about your business so we can build something truly yours",
    "Define your offer — pricing, deliverables, and turnaround",
    "Choose your visual identity and brand personality",
    "How can your clients reach you?",
    "Everything looks good? Let's build it.",
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <style>{SURVEY_GLASS_CSS}</style>
      <div style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        background: S.surface, borderRadius: 24,
        border: `1px solid ${S.border}`,
        backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow: "0 60px 140px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 0.5px 0 rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "surveyFadeIn 400ms cubic-bezier(0.22,1,0.36,1) forwards",
      }}>
        {/* Header */}
        <div className="survey-header" style={{
          padding: "22px 28px 18px",
          borderBottom: `1px solid ${S.border}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Step {step + 1} of {totalSteps}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`sv-step-dot ${i < step ? "sv-step-dot-done" : i === step ? "sv-step-dot-active" : "sv-step-dot-pending"}`} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.text, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
              {stepTitles[step]}
            </div>
            <div style={{ fontSize: 13, color: S.textMuted, marginTop: 5, letterSpacing: "-0.005em", lineHeight: 1.5 }}>
              {stepDescs[step]}
            </div>
          </div>
          <button onClick={onClose} className="sv-glass-btn" style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${S.border}`,
            background: "rgba(255,255,255,0.02)", color: S.textSec,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, marginTop: 2,
          }}><span>✕</span></button>
        </div>

        {/* Progress bar */}
        <div className="sv-progress-track">
          <div className="sv-progress-fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 28px 20px" }}>
          <div key={step} style={{ animation: "surveySlideUp 350ms cubic-bezier(0.22,1,0.36,1) forwards" }}>
            {step === 0 && <StepBusiness data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
            {step === 1 && <StepService data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
            {step === 2 && <StepBrand data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
            {step === 3 && <StepContact data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion} />}
            {step === 4 && <StepReview data={data} />}
          </div>
        </div>

        {/* Footer */}
        {errors.length > 0 && (
          <div style={{ padding: "0 28px 10px" }}>
            <div className="sv-glass-card" style={{ padding: "12px 16px", borderColor: "rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.04)" }}>
              {errors.map((e, i) => <div key={i} style={{ fontSize: 12.5, color: S.danger, lineHeight: 1.7, letterSpacing: "-0.005em" }}>• {e}</div>)}
            </div>
          </div>
        )}
        <div style={{
          padding: "16px 28px 22px",
          borderTop: `1px solid ${S.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {step > 0 ? (
            <button onClick={back} className="sv-glass-btn" style={{
              padding: "10px 22px", borderRadius: 12, border: `1px solid ${S.border}`,
              background: "rgba(255,255,255,0.02)", color: S.textSec, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
            }}><span>Back</span></button>
          ) : <div />}
          
          <button onClick={next} className="sv-glass-btn-accent" style={{
            padding: "11px 28px", borderRadius: 12,
            background: step === totalSteps - 1 
              ? `linear-gradient(135deg, ${S.accent}, #10B981)` 
              : S.accent,
            color: "#fff", fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em",
            boxShadow: `0 6px 28px rgba(74,144,255,0.25), inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}>
            <span>{step === totalSteps - 1 ? "Build my website →" : "Continue →"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Input Components ────────────────────────────────────────

function Label({ children, required, askKey, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: { children: React.ReactNode; required?: boolean; askKey?: string; zelrexTip?: string | null; setZelrexTip?: (k: string | null) => void; onAskZelrex?: (question: string) => void; buildAskQuestion?: (key: string) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 13.5, fontWeight: 600, color: S.text, letterSpacing: "-0.01em" }}>{children}{required && <span style={{ color: S.accent, marginLeft: 4, fontSize: 12 }}>*</span>}</label>
      {askKey && setZelrexTip && (
        <button type="button" className="sv-glass-btn" onClick={() => {
          if (onAskZelrex && askKey && buildAskQuestion) {
            onAskZelrex(buildAskQuestion(askKey));
          } else {
            setZelrexTip(zelrexTip === askKey ? null : askKey);
          }
        }} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 9,
          border: `1px solid ${zelrexTip === askKey ? "rgba(74,144,255,0.35)" : "rgba(74,144,255,0.15)"}`,
          background: zelrexTip === askKey ? "rgba(74,144,255,0.10)" : "rgba(74,144,255,0.04)",
          color: zelrexTip === askKey ? S.accent : "rgba(74,144,255,0.75)",
          fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
          whiteSpace: "nowrap",
          boxShadow: zelrexTip === askKey ? "0 0 16px rgba(74,144,255,0.12), inset 0 0.5px 0 rgba(74,144,255,0.20)" : "inset 0 0.5px 0 rgba(255,255,255,0.06)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, position: "relative", zIndex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            </svg>
            Ask Zelrex
          </span>
        </button>
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: S.textMuted, marginBottom: 10, lineHeight: 1.55, letterSpacing: "-0.005em" }}>{children}</div>;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

function Input({ value, onChange, placeholder, ...rest }: InputProps) {
  return (
    <input 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      className="sv-glass-input"
      {...rest}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      rows={rows}
      className="sv-glass-input"
      style={{ resize: "vertical", lineHeight: 1.65 }}
    />
  );
}

function OptionGrid({ options, value, onChange }: { 
  options: Array<{ key: string; label: string; desc?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="survey-option-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button key={opt.key} type="button" onClick={() => onChange(opt.key)} className={`sv-option ${active ? "sv-option-active" : ""}`}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: active ? S.text : S.textSec, letterSpacing: "-0.01em", position: "relative", zIndex: 1 }}>
              {active && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: S.accent, boxShadow: `0 0 8px ${S.accent}`, marginRight: 8, verticalAlign: "middle" }} />}
              {opt.label}
            </div>
            {opt.desc && <div style={{ fontSize: 11.5, color: S.textMuted, marginTop: 3, letterSpacing: "-0.005em", position: "relative", zIndex: 1 }}>{opt.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}

function FieldGroup({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 24, ...style }}>{children}</div>;
}

// ─── Ask Zelrex Tips ──────────────────────────────────────────────

const ZELREX_TIPS: Record<string, string> = {
  businessName: "Your business name is your brand identity. For freelancers, using your real name + what you do works well (e.g., 'Sarah Chen Design'). Avoid generic names — specific beats clever. Make sure it's easy to spell and say out loud.",
  tagline: "Your tagline should answer: 'What do you do and for whom?' in one line. Focus on the outcome you deliver, not the process. Example: 'Brand identity for startups that want to look like they've been around for years.'",
  businessType: "Pick the category that best matches your primary revenue source. If you do multiple things, choose the one you want to be known for. Specialists earn 2-3x more than generalists in freelancing.",
  targetAudience: "The more specific your audience, the higher your conversion rate. 'SaaS startups with 10-50 employees' converts 5x better than 'businesses.' Think: industry + size + specific problem they have.",
  platformsLeaving: "If you're leaving a platform like Upwork or Fiverr, that's actually a strong selling point. It means you've already proven demand. Your website should position you as the premium, direct alternative.",
  mainService: "Name your service like a product, not a skill. 'Complete Brand Identity Package' sounds more valuable than 'Logo Design.' Premium naming justifies premium pricing.",
  serviceDescription: "Lead with the transformation, not the deliverable. Instead of 'I make logos,' try 'I build visual identities that make startups look established and trustworthy from day one.' Paint the before/after.",
  deliverables: "List concrete, tangible things the client receives. Each deliverable should feel like it has standalone value. More items = higher perceived value. Include file formats and revision counts.",
  turnaround: "Faster delivery commands higher prices (urgency premium). But be realistic — under-promising and over-delivering builds referrals. 2 weeks is the sweet spot for most creative services.",
  pricingModel: "Package pricing converts best for freelancers — it anchors value to outcomes, not hours. Hourly punishes efficiency. If you're unsure, start with packages and offer hourly as an add-on only.",
  price: "Price based on value delivered, not time spent. Research what your target clients currently pay for similar services. Then position yourself 20-30% below the top tier — premium but accessible.",
  tiers: "Three tiers is the magic number. The middle tier should be your ideal offer — most people pick it. The top tier makes the middle look reasonable. The bottom tier captures budget clients who might upgrade later.",
  guarantee: "A guarantee removes the buyer's risk and dramatically increases conversion. 'Full refund if you're not satisfied with the first concept' costs you almost nothing but closes deals.",
  primaryColor: "Your brand color should match your industry's emotional tone. Blue = trust (consulting, tech). Green = growth (coaching). Black/dark = premium (design, creative). Avoid colors that blend in with competitors.",
  stylePreference: "Dark premium themes convert best for creative services. Light clean works for consulting and coaching. Bold colorful suits agencies and marketing services. Match the vibe your ideal clients expect.",
  fontPreference: "Modern fonts signal innovation. Classic fonts signal reliability. Editorial fonts signal authority. Tech fonts signal precision. Choose based on what your clients value most.",
  email: "Use a professional email that matches your business name. yourname@yourbusiness.com looks 10x more credible than a Gmail address. You can set this up later with your custom domain.",
  phone: "A business phone number increases trust significantly. If you don't have a separate line, use a Google Voice number. Including a phone number can increase contact form submissions by 40%.",
  location: "Even remote businesses benefit from listing a general location. It helps with local SEO and gives clients context. You don't need a street address — city and state/country is enough.",
  calendly: "A booking link is the single highest-converting CTA for service businesses. It removes friction — clients can book instantly instead of waiting for email replies. This alone can double your inquiry-to-call rate.",
  socialPlatforms: "Only list platforms where you're actually active and posting relevant content. An empty social profile hurts more than no social presence. Focus on 2-3 platforms max where your clients actually spend time.",
  hours: "Setting business hours creates boundaries and professionalism. It also creates subtle urgency — clients know you're not available 24/7. Even 'Mon-Fri 9-5' signals you run a real business.",
  stripeCheckout: "Adding Stripe checkout to your website means clients can pay you directly from your pricing page — no back-and-forth invoicing. Zelrex creates the checkout on YOUR Stripe account, so money goes straight to your bank. You'll need a Stripe account (free to create). If you're not ready for payments, choose 'No payments yet' and add it later.",
};

function ZelrexTipPopover({ tipKey }: { tipKey: string }) {
  const tip = ZELREX_TIPS[tipKey];
  if (!tip) return null;
  return (
    <div className="sv-glass-card" style={{
      marginBottom: 14, padding: "14px 16px",
      borderColor: "rgba(74,144,255,0.12)", background: "rgba(74,144,255,0.04)",
      display: "flex", gap: 12, alignItems: "flex-start",
      animation: "zelrexTipIn 250ms cubic-bezier(0.22,1,0.36,1)",
    }}>
      <div style={{ flexShrink: 0, marginTop: 1, width: 24, height: 24, borderRadius: 8, background: "rgba(74,144,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
          <text x="4" y="23" fill={S.accent} fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="24" fontStyle="italic">Z</text>
          <line x1="3" y1="28" x2="27" y2="28" stroke={S.accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
      <div style={{ fontSize: 12.5, color: S.textSec, lineHeight: 1.7, letterSpacing: "-0.005em" }}>{tip}</div>
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
            }} placeholder={`Deliverable ${i + 1}`} />
            {data.deliverables.length > 1 && (
              <button type="button" className="sv-remove-btn" onClick={() => update("deliverables", data.deliverables.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="sv-add-btn" onClick={() => update("deliverables", [...data.deliverables, ""])}>+ Add deliverable</button>
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
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={data.hasMultipleTiers} onChange={(e) => update("hasMultipleTiers", e.target.checked)} />
          <span style={{ fontSize: 13, color: S.textSec }}>I have multiple pricing tiers</span>
        </label>
      </FieldGroup>

      {data.hasMultipleTiers && (
        <FieldGroup>
          <Label askKey="tiers" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Pricing tiers</Label>
          {zelrexTip === "tiers" && <ZelrexTipPopover tipKey="tiers" />}
          {data.tiers.map((tier, i) => (
            <div key={i} className="sv-tier-card">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <Input value={tier.name} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, name: v }; update("tiers", next);
                }} placeholder="Tier name (e.g., Starter)" />
                <Input value={tier.price} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, price: v }; update("tiers", next);
                }} placeholder="Price (e.g., $500)" />
              </div>
              {tier.features.map((f, j) => (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <Input value={f} onChange={(v) => {
                    const next = [...data.tiers];
                    const feats = [...tier.features]; feats[j] = v;
                    next[i] = { ...tier, features: feats };
                    update("tiers", next);
                  }} placeholder={`Feature ${j + 1}`} />
                </div>
              ))}
              <button type="button" className="sv-add-btn" style={{ marginTop: 6, fontSize: 11.5 }} onClick={() => {
                const next = [...data.tiers];
                next[i] = { ...tier, features: [...tier.features, ""] };
                update("tiers", next);
              }}>+ feature</button>
            </div>
          ))}
          <button type="button" className="sv-add-btn" onClick={() => update("tiers", [...data.tiers, { name: "", price: "", features: [""] }])}>+ Add tier</button>
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

function StepBrand({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  const colors = [
    { hex: "#4A90FF", name: "Blue" },
    { hex: "#8B5CF6", name: "Purple" },
    { hex: "#10B981", name: "Green" },
    { hex: "#F59E0B", name: "Amber" },
    { hex: "#EF4444", name: "Red" },
    { hex: "#EC4899", name: "Pink" },
    { hex: "#06B6D4", name: "Cyan" },
    { hex: "#F97316", name: "Orange" },
  ];

  return (
    <div>
      <FieldGroup>
        <Label askKey="primaryColor" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Primary brand color</Label>
        {zelrexTip === "primaryColor" && <ZelrexTipPopover tipKey="primaryColor" />}
        <Hint>This will be your accent color for buttons and highlights.</Hint>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {colors.map((c) => {
            const active = data.primaryColor === c.hex;
            return (
              <button key={c.hex} type="button" onClick={() => update("primaryColor", c.hex)}
                className={`sv-color-swatch ${active ? "sv-color-active" : ""}`}
                style={{ background: c.hex, ["--swatch-glow" as string]: `${c.hex}60` } as React.CSSProperties}
                title={c.name}
              />
            );
          })}
          <div style={{ position: "relative" }}>
            <input type="color" value={data.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} style={{
              width: 48, height: 48, borderRadius: 14, border: "2px dashed rgba(255,255,255,0.15)",
              background: "transparent", cursor: "pointer", padding: 0,
              transition: "all 300ms cubic-bezier(0.32,0.72,0,1)",
            }} title="Custom color" />
          </div>
        </div>
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

// ─── Step 4: Contact & Social ───────────────────────────────────────

function StepContact({ data, update, zelrexTip, setZelrexTip, onAskZelrex, buildAskQuestion }: StepProps) {
  const socialPlatforms = ["Twitter/X", "LinkedIn", "Instagram", "YouTube", "TikTok", "Facebook", "Discord", "Dribbble", "Behance", "GitHub"];
  
  return (
    <div>
      <FieldGroup>
        <Label required askKey="email" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Email address (shown on site)</Label>
        {zelrexTip === "email" && <ZelrexTipPopover tipKey="email" />}
        <Input value={data.email} onChange={(v) => update("email", v)} placeholder="hello@yourdomain.com" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="phone" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Phone number (optional)</Label>
        {zelrexTip === "phone" && <ZelrexTipPopover tipKey="phone" />}
        <Input value={data.phone} onChange={(v) => update("phone", v)} placeholder="+1 (555) 123-4567" />
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
        <Input value={data.calendlyUrl} onChange={(v) => update("calendlyUrl", v)} placeholder="https://calendly.com/yourname" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="socialPlatforms" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} onAskZelrex={onAskZelrex} buildAskQuestion={buildAskQuestion}>Social media profiles</Label>
        {zelrexTip === "socialPlatforms" && <ZelrexTipPopover tipKey="socialPlatforms" />}
        <Hint>Add any that you want linked on your site.</Hint>
        {data.socialLinks.map((link, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 36px", gap: 8, marginBottom: 8 }}>
            <select className="sv-social-select" value={link.platform} onChange={(e) => {
              const next = [...data.socialLinks]; next[i] = { ...link, platform: e.target.value }; update("socialLinks", next);
            }}>
              {socialPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <Input value={link.url} onChange={(v) => {
              const next = [...data.socialLinks]; next[i] = { ...link, url: v }; update("socialLinks", next);
            }} placeholder="https://..." />
            <button type="button" className="sv-remove-btn" onClick={() => update("socialLinks", data.socialLinks.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="sv-add-btn" onClick={() => update("socialLinks", [...data.socialLinks, { platform: "Twitter/X", url: "" }])}>+ Add social link</button>
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

function StepReview({ data }: { data: SurveyData }) {
  const sections = [
    { label: "Business", items: [
      ["Name", data.businessName],
      ["Type", data.businessType],
      ["Tagline", data.tagline],
      ["Audience", data.targetAudience],
    ]},
    { label: "Service", items: [
      ["Service", data.mainService],
      ["Price", data.hasMultipleTiers ? `${data.tiers.length} tiers` : data.price],
      ["Turnaround", data.turnaround],
      ["Deliverables", data.deliverables.filter(Boolean).join(", ")],
      ["Payments", data.stripeCheckout === "auto" ? "Stripe checkout on website" : data.stripeCheckout === "link-only" ? "Payment links only" : "Set up later"],
    ]},
    { label: "Brand", items: [
      ["Style", data.stylePreference],
      ["Font", data.fontPreference],
      ["USP", data.uniqueSellingPoint],
    ]},
    { label: "Contact", items: [
      ["Email", data.email],
      ["Phone", data.phone],
      ["Booking", data.calendlyUrl],
      ["Socials", data.socialLinks.length ? `${data.socialLinks.length} linked` : "None"],
    ]},
  ];

  return (
    <div>
      <div style={{ fontSize: 13.5, color: S.textSec, marginBottom: 24, lineHeight: 1.65, letterSpacing: "-0.005em" }}>
        Review your details below. Zelrex will use all of this to build your website — every headline, every section, every price will be real. No placeholders.
      </div>
      
      {sections.map((section) => (
        <div key={section.label} className="sv-glass-card" style={{ padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
            {section.label}
          </div>
          {section.items.filter(([_, v]) => v).map(([label, value]) => (
            <div key={label} className="sv-review-row">
              <span style={{ fontSize: 13, color: S.textMuted, letterSpacing: "-0.005em" }}>{label}</span>
              <span style={{ fontSize: 13, color: S.text, fontWeight: 500, textAlign: "right", maxWidth: "60%", letterSpacing: "-0.005em" }}>{value}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="sv-glass-card" style={{
        padding: "16px 18px", marginTop: 8,
        borderColor: "rgba(74,144,255,0.12)", background: "rgba(74,144,255,0.04)",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: "rgba(74,144,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={S.accent} strokeWidth="2" strokeLinecap="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <span style={{ fontSize: 13, color: S.textSec, lineHeight: 1.65, letterSpacing: "-0.005em" }}>
          Zelrex will generate a multi-page website with all of this information. Every section will be customized to your business type and brand preferences.
        </span>
      </div>
    </div>
  );
}