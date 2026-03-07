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
  surface: "#0C1220",
  surfaceHover: "#101828",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.16)",
  accent: "#4A90FF",
  accentGlow: "rgba(74,144,255,0.12)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.30)",
  danger: "#EF4444",
  success: "#10B981",
};

// ─── Main Component ─────────────────────────────────────────────────

export function WebsiteSurvey({ 
  onComplete, 
  onClose,
  initialData,
}: { 
  onComplete: (data: SurveyData) => void;
  onClose: () => void;
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

  const stepTitles = ["Your Business", "Your Service", "Brand & Style", "Contact Info", "Review & Build"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: S.overlay, backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 620, maxHeight: "90vh",
        background: S.surface, borderRadius: 20,
        border: `1px solid ${S.border}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <style>{`@media(max-width:640px){.survey-option-grid{grid-template-columns:1fr!important}}`}</style>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${S.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Step {step + 1} of {totalSteps}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.text, marginTop: 4, letterSpacing: "-0.02em" }}>
              {stepTitles[step]}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${S.border}`,
            background: "transparent", color: S.textSec, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: S.border }}>
          <div style={{
            height: "100%", width: `${((step + 1) / totalSteps) * 100}%`,
            background: `linear-gradient(90deg, ${S.accent}, #10B981)`,
            borderRadius: 2, transition: "width 400ms ease",
          }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 24px 16px" }}>
          {step === 0 && <StepBusiness data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} />}
          {step === 1 && <StepService data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} />}
          {step === 2 && <StepBrand data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} />}
          {step === 3 && <StepContact data={data} update={update} zelrexTip={zelrexTip} setZelrexTip={setZelrexTip} />}
          {step === 4 && <StepReview data={data} />}
        </div>

        {/* Footer */}
        {errors.length > 0 && (
          <div style={{ padding: "0 24px 8px" }}>
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: S.danger, lineHeight: 1.6 }}>• {e}</div>)}
            </div>
          </div>
        )}
        <div style={{
          padding: "16px 24px 20px",
          borderTop: `1px solid ${S.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {step > 0 ? (
            <button onClick={back} style={{
              padding: "10px 20px", borderRadius: 10, border: `1px solid ${S.border}`,
              background: "transparent", color: S.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>Back</button>
          ) : <div />}
          
          <button onClick={next} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: step === totalSteps - 1 
              ? `linear-gradient(135deg, ${S.accent}, #10B981)` 
              : S.accent,
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: `0 4px 20px ${S.accentGlow}`,
            transition: "transform 150ms, box-shadow 150ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 8px 30px ${S.accentGlow}`; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 20px ${S.accentGlow}`; }}
          >
            {step === totalSteps - 1 ? "Build my website →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Input Components ────────────────────────────────────────

function Label({ children, required, askKey, zelrexTip, setZelrexTip }: { children: React.ReactNode; required?: boolean; askKey?: string; zelrexTip?: string | null; setZelrexTip?: (k: string | null) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{children}{required && <span style={{ color: S.danger, marginLeft: 4 }}>*</span>}</label>
      {askKey && setZelrexTip && (
        <button type="button" onClick={() => setZelrexTip(zelrexTip === askKey ? null : askKey)} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8,
          border: `1px solid ${zelrexTip === askKey ? S.accent + "50" : S.accent + "25"}`,
          background: zelrexTip === askKey ? `linear-gradient(135deg, ${S.accent}20, ${S.accent}08)` : `linear-gradient(135deg, ${S.accent}10, transparent)`,
          color: zelrexTip === askKey ? S.accent : S.accent + "AA",
          fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 200ms cubic-bezier(0.2,0,0,1)", letterSpacing: "0.01em",
          whiteSpace: "nowrap",
          boxShadow: zelrexTip === askKey ? `0 0 16px ${S.accent}20, inset 0 0.5px 0 rgba(255,255,255,0.1)` : `inset 0 0.5px 0 rgba(255,255,255,0.06)`,
        }}
        onMouseEnter={(e) => { const t = e.currentTarget; t.style.borderColor = `${S.accent}60`; t.style.background = `linear-gradient(135deg, ${S.accent}25, ${S.accent}10)`; t.style.boxShadow = `0 0 20px ${S.accent}25, inset 0 0.5px 0 rgba(255,255,255,0.12)`; t.style.transform = "translateY(-0.5px)"; }}
        onMouseLeave={(e) => { const t = e.currentTarget; const isActive = zelrexTip === askKey; t.style.borderColor = isActive ? `${S.accent}50` : `${S.accent}25`; t.style.background = isActive ? `linear-gradient(135deg, ${S.accent}20, ${S.accent}08)` : `linear-gradient(135deg, ${S.accent}10, transparent)`; t.style.boxShadow = isActive ? `0 0 16px ${S.accent}20, inset 0 0.5px 0 rgba(255,255,255,0.1)` : `inset 0 0.5px 0 rgba(255,255,255,0.06)`; t.style.transform = "none"; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          </svg>
          Ask Zelrex
        </button>
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{children}</div>;
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
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 10,
        border: `1px solid ${S.border}`, background: S.bg,
        color: S.text, fontSize: 14, outline: "none",
        transition: "border-color 200ms",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = S.accent; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = S.border; }}
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
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 10,
        border: `1px solid ${S.border}`, background: S.bg,
        color: S.text, fontSize: 14, outline: "none", resize: "vertical",
        fontFamily: "inherit", lineHeight: 1.6,
        transition: "border-color 200ms",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = S.accent; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = S.border; }}
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
          <button key={opt.key} type="button" onClick={() => onChange(opt.key)} style={{
            textAlign: "left", padding: "12px 14px", borderRadius: 10,
            border: `1px solid ${active ? S.accent : S.border}`,
            background: active ? S.accentGlow : "transparent",
            cursor: "pointer", transition: "all 150ms",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: active ? S.text : S.textSec }}>{opt.label}</div>
            {opt.desc && <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>{opt.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}

function FieldGroup({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 20, ...style }}>{children}</div>;
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
    <div style={{
      marginBottom: 12, padding: "12px 14px", borderRadius: 12,
      background: "rgba(74,144,255,0.06)", border: `1px solid ${S.accent}20`,
      display: "flex", gap: 10, alignItems: "flex-start",
      animation: "zelrexTipIn 200ms ease",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
          <text x="4" y="23" fill={S.accent} fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="24" fontStyle="italic">Z</text>
          <line x1="3" y1="28" x2="27" y2="28" stroke={S.accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
      <div style={{ fontSize: 12.5, color: S.textSec, lineHeight: 1.65 }}>{tip}</div>
      <style>{`@keyframes zelrexTipIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Step 1: Business Basics ────────────────────────────────────────

type StepProps = { data: SurveyData; update: <K extends keyof SurveyData>(k: K, v: SurveyData[K]) => void; zelrexTip: string | null; setZelrexTip: (k: string | null) => void };

function StepBusiness({ data, update, zelrexTip, setZelrexTip }: StepProps) {
  return (
    <div>
      <FieldGroup>
        <Label required askKey="businessName" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Business name</Label>
        {zelrexTip === "businessName" && <ZelrexTipPopover tipKey="businessName" />}
        <Input value={data.businessName} onChange={(v) => update("businessName", v)} placeholder="e.g., Sarah Chen Design" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="tagline" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Tagline (one line that says what you do)</Label>
        {zelrexTip === "tagline" && <ZelrexTipPopover tipKey="tagline" />}
        <Hint>This becomes your hero subtitle. Make it clear, not clever.</Hint>
        <Input value={data.tagline} onChange={(v) => update("tagline", v)} placeholder="e.g., Brand identity and web design for startups" />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="businessType" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>What type of service do you offer?</Label>
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
        <Label required askKey="targetAudience" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Who is your ideal client?</Label>
        {zelrexTip === "targetAudience" && <ZelrexTipPopover tipKey="targetAudience" />}
        <Hint>Be specific.</Hint>
        <Input value={data.targetAudience} onChange={(v) => update("targetAudience", v)} placeholder="e.g., SaaS startups with 10-50 employees who need a rebrand" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="platformsLeaving" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Are you leaving a platform? (optional)</Label>
        {zelrexTip === "platformsLeaving" && <ZelrexTipPopover tipKey="platformsLeaving" />}
        <Input value={data.platformsLeavingFrom} onChange={(v) => update("platformsLeavingFrom", v)} placeholder="e.g., Upwork, Fiverr" />
      </FieldGroup>
    </div>
  );
}

// ─── Step 2: Service Details ────────────────────────────────────────

function StepService({ data, update, zelrexTip, setZelrexTip }: StepProps) {
  return (
    <div>
      <FieldGroup>
        <Label required askKey="mainService" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Main service name</Label>
        {zelrexTip === "mainService" && <ZelrexTipPopover tipKey="mainService" />}
        <Hint>What would you call this offer on a menu?</Hint>
        <Input value={data.mainService} onChange={(v) => update("mainService", v)} placeholder="e.g., Complete Brand Identity Package" />
      </FieldGroup>

      <FieldGroup>
        <Label required askKey="serviceDescription" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Describe what the client gets.</Label>
        {zelrexTip === "serviceDescription" && <ZelrexTipPopover tipKey="serviceDescription" />}
        <TextArea value={data.serviceDescription} onChange={(v) => update("serviceDescription", v)} placeholder="e.g., I design your complete brand identity from scratch — logo, colors, typography, and brand guidelines. You get 3 concepts, unlimited revisions on the chosen direction, and a brand book delivered in 2 weeks." />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="deliverables" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>What's included? (one per line)</Label>
        {zelrexTip === "deliverables" && <ZelrexTipPopover tipKey="deliverables" />}
        <Hint>List specific deliverables.</Hint>
        {data.deliverables.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <Input value={d} onChange={(v) => {
              const next = [...data.deliverables];
              next[i] = v;
              update("deliverables", next);
            }} placeholder={`Deliverable ${i + 1}`} />
            {data.deliverables.length > 1 && (
              <button type="button" onClick={() => update("deliverables", data.deliverables.filter((_, j) => j !== i))} style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: `1px solid ${S.border}`,
                background: "transparent", color: S.textMuted, cursor: "pointer", fontSize: 14,
              }}>✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => update("deliverables", [...data.deliverables, ""])} style={{
          padding: "6px 12px", borderRadius: 8, border: `1px solid ${S.border}`,
          background: "transparent", color: S.textSec, fontSize: 12, cursor: "pointer", marginTop: 4,
        }}>+ Add deliverable</button>
      </FieldGroup>

      <FieldGroup>
        <Label askKey="turnaround" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Turnaround time</Label>
        {zelrexTip === "turnaround" && <ZelrexTipPopover tipKey="turnaround" />}
        <Input value={data.turnaround} onChange={(v) => update("turnaround", v)} placeholder="e.g., 2 weeks, 48 hours, same-day" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="pricingModel" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Pricing model</Label>
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
        <Label required askKey="price" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>{data.hasMultipleTiers ? "See tiers below" : "Your price"}</Label>
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
          <Label askKey="tiers" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Pricing tiers</Label>
          {zelrexTip === "tiers" && <ZelrexTipPopover tipKey="tiers" />}
          {data.tiers.map((tier, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 12, border: `1px solid ${S.border}`,
              marginBottom: 10, background: "rgba(255,255,255,0.02)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <Input value={tier.name} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, name: v }; update("tiers", next);
                }} placeholder="Tier name (e.g., Starter)" />
                <Input value={tier.price} onChange={(v) => {
                  const next = [...data.tiers]; next[i] = { ...tier, price: v }; update("tiers", next);
                }} placeholder="Price (e.g., $500)" />
              </div>
              {tier.features.map((f, j) => (
                <div key={j} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <Input value={f} onChange={(v) => {
                    const next = [...data.tiers];
                    const feats = [...tier.features]; feats[j] = v;
                    next[i] = { ...tier, features: feats };
                    update("tiers", next);
                  }} placeholder={`Feature ${j + 1}`} />
                </div>
              ))}
              <button type="button" onClick={() => {
                const next = [...data.tiers];
                next[i] = { ...tier, features: [...tier.features, ""] };
                update("tiers", next);
              }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${S.border}`, background: "transparent", color: S.textMuted, fontSize: 11, cursor: "pointer", marginTop: 4 }}>+ feature</button>
            </div>
          ))}
          <button type="button" onClick={() => update("tiers", [...data.tiers, { name: "", price: "", features: [""] }])} style={{
            padding: "6px 12px", borderRadius: 8, border: `1px solid ${S.border}`,
            background: "transparent", color: S.textSec, fontSize: 12, cursor: "pointer",
          }}>+ Add tier</button>
        </FieldGroup>
      )}

      <FieldGroup>
        <Label askKey="guarantee" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Guarantee or risk-reducer (optional)</Label>
        {zelrexTip === "guarantee" && <ZelrexTipPopover tipKey="guarantee" />}
        <Hint>What makes it safe for the client to say yes?</Hint>
        <Input value={data.guarantee} onChange={(v) => update("guarantee", v)} placeholder="e.g., 100% refund if not satisfied within 7 days" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="stripeCheckout" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>How do you want to accept payments?</Label>
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

function StepBrand({ data, update, zelrexTip, setZelrexTip }: StepProps) {
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
        <Label askKey="primaryColor" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Primary brand color</Label>
        {zelrexTip === "primaryColor" && <ZelrexTipPopover tipKey="primaryColor" />}
        <Hint>This will be your accent color for buttons and highlights.</Hint>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => (
            <button key={c.hex} type="button" onClick={() => update("primaryColor", c.hex)} style={{
              width: 44, height: 44, borderRadius: 12,
              background: c.hex,
              border: data.primaryColor === c.hex ? "3px solid #fff" : "2px solid transparent",
              cursor: "pointer", transition: "all 150ms",
              boxShadow: data.primaryColor === c.hex ? `0 0 16px ${c.hex}60` : "none",
            }} title={c.name} />
          ))}
          <div style={{ position: "relative" }}>
            <input type="color" value={data.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} style={{
              width: 44, height: 44, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.2)",
              background: "transparent", cursor: "pointer", padding: 0,
            }} title="Custom color" />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup>
        <Label askKey="stylePreference" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Website style</Label>
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
        <Label askKey="fontPreference" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Typography feel</Label>
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

function StepContact({ data, update, zelrexTip, setZelrexTip }: StepProps) {
  const socialPlatforms = ["Twitter/X", "LinkedIn", "Instagram", "YouTube", "TikTok", "Facebook", "Discord", "Dribbble", "Behance", "GitHub"];
  
  return (
    <div>
      <FieldGroup>
        <Label required askKey="email" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Email address (shown on site)</Label>
        {zelrexTip === "email" && <ZelrexTipPopover tipKey="email" />}
        <Input value={data.email} onChange={(v) => update("email", v)} placeholder="hello@yourdomain.com" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="phone" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Phone number (optional)</Label>
        {zelrexTip === "phone" && <ZelrexTipPopover tipKey="phone" />}
        <Input value={data.phone} onChange={(v) => update("phone", v)} placeholder="+1 (555) 123-4567" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="location" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Location (optional)</Label>
        {zelrexTip === "location" && <ZelrexTipPopover tipKey="location" />}
        <Input value={data.location} onChange={(v) => update("location", v)} placeholder="e.g., Remote — based in Austin, TX" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="hours" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Business hours (optional)</Label>
        {zelrexTip === "hours" && <ZelrexTipPopover tipKey="hours" />}
        <Input value={data.hours} onChange={(v) => update("hours", v)} placeholder="e.g., Mon-Fri 9am-5pm EST" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="calendly" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Booking link (Calendly, Cal.com, etc.)</Label>
        {zelrexTip === "calendly" && <ZelrexTipPopover tipKey="calendly" />}
        <Hint>If you have one, Zelrex will embed it in your site.</Hint>
        <Input value={data.calendlyUrl} onChange={(v) => update("calendlyUrl", v)} placeholder="https://calendly.com/yourname" />
      </FieldGroup>

      <FieldGroup>
        <Label askKey="socialPlatforms" zelrexTip={zelrexTip} setZelrexTip={setZelrexTip}>Social media profiles</Label>
        {zelrexTip === "socialPlatforms" && <ZelrexTipPopover tipKey="socialPlatforms" />}
        <Hint>Add any that you want linked on your site.</Hint>
        {data.socialLinks.map((link, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 36px", gap: 8, marginBottom: 6 }}>
            <select value={link.platform} onChange={(e) => {
              const next = [...data.socialLinks]; next[i] = { ...link, platform: e.target.value }; update("socialLinks", next);
            }} style={{
              padding: "8px 10px", borderRadius: 8, border: `1px solid ${S.border}`,
              background: S.bg, color: S.text, fontSize: 13,
            }}>
              {socialPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <Input value={link.url} onChange={(v) => {
              const next = [...data.socialLinks]; next[i] = { ...link, url: v }; update("socialLinks", next);
            }} placeholder="https://..." />
            <button type="button" onClick={() => update("socialLinks", data.socialLinks.filter((_, j) => j !== i))} style={{
              borderRadius: 8, border: `1px solid ${S.border}`, background: "transparent",
              color: S.textMuted, cursor: "pointer", fontSize: 14,
            }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => update("socialLinks", [...data.socialLinks, { platform: "Twitter/X", url: "" }])} style={{
          padding: "6px 12px", borderRadius: 8, border: `1px solid ${S.border}`,
          background: "transparent", color: S.textSec, fontSize: 12, cursor: "pointer",
        }}>+ Add social link</button>
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
      <div style={{ fontSize: 14, color: S.textSec, marginBottom: 20, lineHeight: 1.6 }}>
        Review your details below. Zelrex will use all of this to build your website — every headline, every section, every price will be real. No placeholders.
      </div>
      
      {sections.map((section) => (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {section.label}
          </div>
          {section.items.filter(([_, v]) => v).map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}` }}>
              <span style={{ fontSize: 13, color: S.textMuted }}>{label}</span>
              <span style={{ fontSize: 13, color: S.text, fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
            </div>
          ))}
        </div>
      ))}

      <div style={{
        padding: 14, borderRadius: 12, background: S.accentGlow,
        border: `1px solid rgba(74,144,255,0.2)`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 13, color: S.accent, lineHeight: 1.5 }}>
          Zelrex will generate a multi-page website with all of this information. Every section will be customized to your business type and brand preferences.
        </span>
      </div>
    </div>
  );
}
