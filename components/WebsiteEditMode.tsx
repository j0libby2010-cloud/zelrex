// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/* Zelrex design tokens: same values as the C object in ChatPageClient.tsx. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Drawn icons: 1.5 stroke, round caps, same as the rest of the app. */
const XIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const PencilIcon = ({ size = 16, color = C.accent }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4.5L16.2 4.3a1.5 1.5 0 012.1 0l1.4 1.4a1.5 1.5 0 010 2.1L8.5 19 4 20z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /><path d="M14 6.5l3.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const WE_STYLES = `
  @keyframes weFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes weSpin{to{transform:rotate(360deg)}}

  .we-btn{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
  .we-btn:hover{background:rgba(255,255,255,0.05);color:${C.text}!important}
  .we-btn-accent{transition:filter 150ms ${EASE},transform 100ms ${EASE}}
  .we-btn-accent:not(:disabled){cursor:pointer}
  .we-btn-accent:not(:disabled):hover{filter:brightness(1.1)}
  .we-btn-accent:not(:disabled):active{transform:scale(0.98)}
  .we-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
  .we-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}

  .we-navitem{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none;width:100%;text-align:left;font-family:inherit}
  .we-navitem:hover{background:rgba(255,255,255,0.04)}
  .we-navitem.we-navitem-active,.we-navitem.we-navitem-active:hover{background:rgba(255,255,255,0.07)}

  .we-input{width:100%;padding:10px 14px;border-radius:10px;border:1px solid ${C.border};background:${C.bgInput};color:${C.text};font-size:13px;font-family:inherit;outline:none;transition:border-color 150ms ${EASE}}
  .we-input:focus{border-color:${C.accent}}
  .we-input::placeholder{color:${C.textMuted}}
  .we-textarea{resize:vertical;min-height:76px;line-height:1.6}
  select.we-input{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
  select.we-input option,select.we-input optgroup{background:${C.bgElevated};color:${C.text}}
  .we-group{padding:18px;border-radius:14px;background:${C.bgElevated};border:1px solid ${C.border};margin-bottom:16px}

  .we-gs::-webkit-scrollbar{width:5px}
  .we-gs::-webkit-scrollbar-track{background:transparent}
  .we-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
  .we-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

  /* Same top bar as every other panel: 52px with a hairline. */
  .we-header{height:52px;padding:0 14px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${C.border};flex-shrink:0}

  @media(max-width:768px){
    .we-nav{display:none!important}
    .we-mobile-nav{display:block!important}
    .we-main{padding:20px 16px!important}
    .we-input{font-size:16px}
  }
  @media(max-width:520px){ .we-status{display:none!important} }
`;

interface EditableField {
  id: string;
  path: string;
  label: string;
  value: string;
  type: "text" | "textarea" | "price";
  section: string;
  group?: string;
}

/**
 * FIXED: Field paths now match the actual schema produced by generateCopy.ts
 *
 * The actual schema is nested under page names: copy.home.hero.headline,
 * copy.about.story.body, copy.pricing.pricing.tiers[i].name, etc.
 * Previously this used "copy.hero.headline" and "copy.testimonials" which
 * don't exist in the generated schema — edits silently failed.
 */
function extractEditableFields(websiteData: any): EditableField[] {
  const fields: EditableField[] = [];
  const copy = websiteData?.copy || {};
  const branding = websiteData?.branding || {};
  let idx = 0;

  const add = (
    path: string,
    label: string,
    value: any,
    type: "text" | "textarea" | "price",
    section: string,
    group?: string
  ) => {
    if (value !== undefined && value !== null && value !== "") {
      fields.push({ id: `f_${idx++}`, path, label, value: String(value), type, section, group });
    }
  };

  // Branding
  add("branding.name", "Business name", branding.name, "text", "Branding");
  add("branding.tagline", "Tagline", branding.tagline, "text", "Branding");

  // Home
  add("copy.home.hero.headline", "Hero headline", copy.home?.hero?.headline, "text", "Home — Hero");
  add("copy.home.hero.subheadline", "Hero subheadline", copy.home?.hero?.subheadline, "textarea", "Home — Hero");
  add("copy.home.valueProps.eyebrow", "Eyebrow text", copy.home?.valueProps?.eyebrow, "text", "Home — Benefits");
  add("copy.home.valueProps.title", "Section title", copy.home?.valueProps?.title, "text", "Home — Benefits");
  add("copy.home.valueProps.subtitle", "Section subtitle", copy.home?.valueProps?.subtitle, "textarea", "Home — Benefits");
  if (copy.home?.valueProps?.items && Array.isArray(copy.home.valueProps.items)) {
    copy.home.valueProps.items.forEach((item: any, i: number) => {
      add(`copy.home.valueProps.items[${i}].title`, `Title`, item.title, "text", "Home — Benefits", `Benefit ${i + 1}`);
      add(`copy.home.valueProps.items[${i}].description`, `Description`, item.description, "textarea", "Home — Benefits", `Benefit ${i + 1}`);
    });
  }
  add("copy.home.howItWorks.title", "Section title", copy.home?.howItWorks?.title, "text", "Home — Process");
  if (copy.home?.howItWorks?.steps && Array.isArray(copy.home.howItWorks.steps)) {
    copy.home.howItWorks.steps.forEach((step: any, i: number) => {
      add(`copy.home.howItWorks.steps[${i}].title`, `Title`, step.title, "text", "Home — Process", `Step ${i + 1}`);
      add(`copy.home.howItWorks.steps[${i}].description`, `Description`, step.description, "textarea", "Home — Process", `Step ${i + 1}`);
    });
  }
  add("copy.home.primaryCta.title", "CTA title", copy.home?.primaryCta?.title, "text", "Home — CTA");
  add("copy.home.primaryCta.subtitle", "CTA subtitle", copy.home?.primaryCta?.subtitle, "textarea", "Home — CTA");
  add("copy.home.primaryCta.cta.text", "Button text", copy.home?.primaryCta?.cta?.text, "text", "Home — CTA");

  // Offer
  add("copy.offer.hero.headline", "Page headline", copy.offer?.hero?.headline, "text", "Services — Hero");
  add("copy.offer.hero.subheadline", "Page subheadline", copy.offer?.hero?.subheadline, "textarea", "Services — Hero");
  add("copy.offer.whatYouGet.title", "Section title", copy.offer?.whatYouGet?.title, "text", "Services — Deliverables");
  if (copy.offer?.whatYouGet?.items && Array.isArray(copy.offer.whatYouGet.items)) {
    copy.offer.whatYouGet.items.forEach((item: any, i: number) => {
      add(`copy.offer.whatYouGet.items[${i}].title`, `Title`, item.title, "text", "Services — Deliverables", `Deliverable ${i + 1}`);
      add(`copy.offer.whatYouGet.items[${i}].description`, `Description`, item.description, "textarea", "Services — Deliverables", `Deliverable ${i + 1}`);
    });
  }
  add("copy.offer.whoItsFor.title", "Section title", copy.offer?.whoItsFor?.title, "text", "Services — Who It's For");
  if (copy.offer?.whoItsFor?.items && Array.isArray(copy.offer.whoItsFor.items)) {
    copy.offer.whoItsFor.items.forEach((item: any, i: number) => {
      add(`copy.offer.whoItsFor.items[${i}].title`, `Title`, item.title, "text", "Services — Who It's For", `Audience ${i + 1}`);
      add(`copy.offer.whoItsFor.items[${i}].description`, `Description`, item.description, "textarea", "Services — Who It's For", `Audience ${i + 1}`);
    });
  }
  add("copy.offer.cta.title", "CTA title", copy.offer?.cta?.title, "text", "Services — CTA");
  add("copy.offer.cta.cta.text", "Button text", copy.offer?.cta?.cta?.text, "text", "Services — CTA");

  // Pricing
  add("copy.pricing.hero.headline", "Page headline", copy.pricing?.hero?.headline, "text", "Pricing — Hero");
  add("copy.pricing.hero.subheadline", "Page subheadline", copy.pricing?.hero?.subheadline, "textarea", "Pricing — Hero");
  add("copy.pricing.pricing.title", "Section title", copy.pricing?.pricing?.title, "text", "Pricing — Tiers");
  if (copy.pricing?.pricing?.tiers && Array.isArray(copy.pricing.pricing.tiers)) {
    copy.pricing.pricing.tiers.forEach((tier: any, i: number) => {
      add(`copy.pricing.pricing.tiers[${i}].name`, `Name`, tier.name, "text", "Pricing — Tiers", `Tier ${i + 1}`);
      add(`copy.pricing.pricing.tiers[${i}].price`, `Price`, tier.price, "price", "Pricing — Tiers", `Tier ${i + 1}`);
      add(`copy.pricing.pricing.tiers[${i}].note`, `Note`, tier.note, "text", "Pricing — Tiers", `Tier ${i + 1}`);
      if (tier.features && Array.isArray(tier.features) && tier.features.length > 0) {
        add(`copy.pricing.pricing.tiers[${i}].features`, `Features (one per line)`, tier.features.join("\n"), "textarea", "Pricing — Tiers", `Tier ${i + 1}`);
      }
    });
  }
  add("copy.pricing.cta.title", "CTA title", copy.pricing?.cta?.title, "text", "Pricing — CTA");
  add("copy.pricing.cta.cta.text", "Button text", copy.pricing?.cta?.cta?.text, "text", "Pricing — CTA");

  // About
  add("copy.about.hero.headline", "Page headline", copy.about?.hero?.headline, "text", "About — Hero");
  add("copy.about.hero.subheadline", "Page subheadline", copy.about?.hero?.subheadline, "textarea", "About — Hero");
  add("copy.about.story.title", "Story title", copy.about?.story?.title, "text", "About — Story");
  add("copy.about.story.body", "Story body", copy.about?.story?.body, "textarea", "About — Story");
  add("copy.about.values.title", "Values title", copy.about?.values?.title, "text", "About — Values");
  if (copy.about?.values?.items && Array.isArray(copy.about.values.items)) {
    copy.about.values.items.forEach((item: any, i: number) => {
      add(`copy.about.values.items[${i}].title`, `Title`, item.title, "text", "About — Values", `Value ${i + 1}`);
      add(`copy.about.values.items[${i}].description`, `Description`, item.description, "textarea", "About — Values", `Value ${i + 1}`);
    });
  }
  add("copy.about.cta.title", "CTA title", copy.about?.cta?.title, "text", "About — CTA");
  add("copy.about.cta.cta.text", "Button text", copy.about?.cta?.cta?.text, "text", "About — CTA");

  // Contact
  add("copy.contact.hero.headline", "Page headline", copy.contact?.hero?.headline, "text", "Contact — Hero");
  add("copy.contact.hero.subheadline", "Page subheadline", copy.contact?.hero?.subheadline, "textarea", "Contact — Hero");
  add("copy.contact.methods.title", "Section title", copy.contact?.methods?.title, "text", "Contact — Methods");
  add("copy.contact.cta.title", "CTA title", copy.contact?.cta?.title, "text", "Contact — CTA");
  add("copy.contact.cta.cta.text", "Button text", copy.contact?.cta?.cta?.text, "text", "Contact — CTA");

  return fields;
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  
  // Special case: features field needs to be split back into array
  if (path.endsWith(".features")) {
    const valueAsArray = String(value).split("\n").map(s => s.trim()).filter(Boolean);
    return setRawNestedValue(clone, path, valueAsArray);
  }
  
  return setRawNestedValue(clone, path, value);
}

function setRawNestedValue(obj: any, path: string, value: any): any {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const isIndex = /^\d+$/.test(part);
    const key = isIndex ? Number(part) : part;
    const nextPart = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextPart);
    
    if (current[key] === undefined || current[key] === null) {
      current[key] = nextIsIndex ? [] : {};
    }
    current = current[key];
  }
  const lastPart = parts[parts.length - 1];
  const lastKey = /^\d+$/.test(lastPart) ? Number(lastPart) : lastPart;
  current[lastKey] = value;
  return obj;
}

// ─── DRAFT PERSISTENCE ──────────────────────────

function makeDraftKey(websiteId: string): string { return `zelrex_edit_draft_${websiteId}`; }

function loadDraft(websiteId: string): any | null {
  if (!websiteId) return null;
  try {
    const raw = localStorage.getItem(makeDraftKey(websiteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.savedAt && Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(makeDraftKey(websiteId));
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

function saveDraft(websiteId: string, data: any) {
  if (!websiteId) return;
  try { localStorage.setItem(makeDraftKey(websiteId), JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

function clearDraft(websiteId: string) {
  if (!websiteId) return;
  try { localStorage.removeItem(makeDraftKey(websiteId)); } catch {}
}

// ─── COMPONENT ─────────────────────────────────────────────

export function WebsiteEditMode({ websiteData, onSave, onClose }: {
  websiteData: any;
  onSave: (updatedData: any) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [editedData, setEditedData] = useState<any>(websiteData);
  const [activeSection, setActiveSection] = useState<string>("Branding");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // FIXED: Capture original data so Discard always returns to it
  const originalDataRef = useRef<any>(null);
  const websiteId = websiteData?.id || "default";

  useEffect(() => {
    if (!websiteData) return;
    if (!originalDataRef.current) {
      originalDataRef.current = JSON.parse(JSON.stringify(websiteData));
    }
    const draft = loadDraft(websiteId);
    if (draft) {
      setEditedData(draft);
      setFields(extractEditableFields(draft));
      setHasChanges(true);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 5000);
    } else {
      setEditedData(websiteData);
      setFields(extractEditableFields(websiteData));
    }
  }, [websiteData, websiteId]);

  useEffect(() => {
    if (fields.length > 0 && !fields.some(f => f.section === activeSection)) {
      setActiveSection(fields[0].section);
    }
  }, [fields, activeSection]);

  const sections = Array.from(new Set(fields.map(f => f.section)));

  // Autosave to localStorage (debounced 500ms)
  useEffect(() => {
    if (!hasChanges) return;
    const timer = setTimeout(() => saveDraft(websiteId, editedData), 500);
    return () => clearTimeout(timer);
  }, [editedData, hasChanges, websiteId]);

  const updateField = useCallback((field: EditableField, newValue: string) => {
    setEditedData((prev: any) => setNestedValue(prev, field.path, newValue));
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: newValue } : f));
    setHasChanges(true);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  const handleDiscard = useCallback(() => {
    if (!confirm("Discard all unsaved changes?")) return;
    if (originalDataRef.current) {
      setEditedData(originalDataRef.current);
      setFields(extractEditableFields(originalDataRef.current));
    }
    setHasChanges(false);
    clearDraft(websiteId);
    setSaveError(null);
  }, [websiteId]);

  // FIXED: Save errors are now visible
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave(editedData);
      setHasChanges(false);
      setSaveSuccess(true);
      clearDraft(websiteId);
      originalDataRef.current = JSON.parse(JSON.stringify(editedData));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save changes. Your edits are still here — try again, or close and reopen.");
    } finally {
      setSaving(false);
    }
  }, [editedData, onSave, websiteId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saving) handleSave();
      }
      if (e.key === "Escape") {
        if (hasChanges) {
          if (confirm("You have unsaved changes. Close anyway?")) onClose();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hasChanges, saving, handleSave, onClose]);

  // Warn before tab close with unsaved changes
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  if (!websiteData) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: C.bg, display: "flex", flexDirection: "column", opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}` }}>
        <style>{WE_STYLES}</style>
        <div className="we-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PencilIcon />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Edit website</span>
          </div>
          <button className="we-btn-icon" onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon /></button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 360, animation: "weFadeUp 300ms ease 80ms both" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>Nothing to edit yet</h1>
            <p style={{ margin: "10px auto 0", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>Build a website first, then come back to change its text.</p>
          </div>
        </div>
      </div>
    );
  }

  // Closing from the X behaves like Esc: ask first if there are unsaved edits.
  const requestClose = () => {
    if (hasChanges && !confirm("You have unsaved changes. Close anyway?")) return;
    onClose();
  };

  const visibleFields = fields.filter(f => f.section === activeSection);
  const grouped: Record<string, EditableField[]> = {};
  const ungrouped: EditableField[] = [];
  visibleFields.forEach(f => {
    if (f.group) { if (!grouped[f.group]) grouped[f.group] = []; grouped[f.group].push(f); }
    else ungrouped.push(f);
  });

  // Section names look like "Home — Benefits": group them by page for the nav.
  const navGroups: { page: string; items: { key: string; label: string }[] }[] = [];
  sections.forEach(s => {
    const [page, sub] = s.split(" — ");
    let g = navGroups.find(x => x.page === page);
    if (!g) { g = { page, items: [] }; navGroups.push(g); }
    g.items.push({ key: s, label: sub ?? page });
  });
  const [activePage, activeSub] = activeSection.split(" — ");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}` }}>
      <style>{WE_STYLES}</style>

      {/* Top bar */}
      <div className="we-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PencilIcon />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Edit website</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="we-status" style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 4 }}>
            {draftRestored && <span style={{ fontSize: 12, color: C.textMuted }}>Draft restored</span>}
            {saveSuccess ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.green }}><CheckIcon />Saved</span>
            ) : hasChanges ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}><span style={{ width: 5, height: 5, borderRadius: 999, background: C.accent }} />Unsaved changes</span>
            ) : null}
          </div>
          {hasChanges && (
            <button className="we-btn" onClick={handleDiscard} title="Discard all changes" style={{ padding: "7px 14px", borderRadius: 999, color: C.textSec, fontSize: 12, fontWeight: 500 }}>Discard</button>
          )}
          <button className="we-btn-accent" onClick={handleSave} disabled={!hasChanges || saving} title="Save (⌘S)" style={{
            padding: "7px 16px", borderRadius: 999, border: "none",
            background: hasChanges ? C.accent : C.bgInput,
            color: hasChanges ? "#fff" : C.textMuted,
            fontSize: 12, fontWeight: 600, cursor: hasChanges ? "pointer" : "default",
            opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            {saving && <span style={{ width: 11, height: 11, borderRadius: 999, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "weSpin 0.7s linear infinite" }} />}
            {saving ? "Saving…" : "Save & rebuild"}
          </button>
          <button className="we-btn-icon" onClick={requestClose} aria-label="Close" title="Close (Esc)" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon /></button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div style={{ padding: "10px 20px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: C.red, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span>{saveError}</span>
          <button className="we-btn-icon" onClick={() => setSaveError(null)} aria-label="Dismiss" style={{ width: 24, height: 24, border: "none", background: "none", color: C.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><XIcon size={14} /></button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Section nav: grouped by page, same style as the main sidebar. */}
        <nav className="we-nav we-gs" style={{ width: 232, flexShrink: 0, overflowY: "auto", borderRight: `1px solid ${C.border}`, padding: "10px 10px 20px" }}>
          {navGroups.map(g => {
            const solo = g.items.length === 1 && g.items[0].label === g.page;
            return (
              <div key={g.page}>
                {!solo && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, padding: "16px 12px 6px" }}>{g.page}</div>}
                {g.items.map(it => (
                  <button key={it.key} className={activeSection === it.key ? "we-navitem we-navitem-active" : "we-navitem"} onClick={() => setActiveSection(it.key)} style={{ display: "block", padding: "7px 12px", marginTop: solo ? 6 : 0, borderRadius: 8, fontSize: 13, fontWeight: 500, color: activeSection === it.key ? C.text : C.textSec }}>{it.label}</button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Fields */}
        <div className="we-main we-gs" style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* Phones get a picker instead of the side nav. */}
            <select className="we-input we-mobile-nav" value={activeSection} onChange={e => setActiveSection(e.target.value)} aria-label="Section" style={{ display: "none", marginBottom: 20 }}>
              {navGroups.map(g => (
                <optgroup key={g.page} label={g.page}>
                  {g.items.map(it => <option key={it.key} value={it.key}>{it.label}</option>)}
                </optgroup>
              ))}
            </select>

            <div style={{ marginBottom: 24 }}>
              {activeSub !== undefined && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{activePage}</div>}
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, color: C.text }}>{activeSub ?? activePage}</h1>
            </div>

            {ungrouped.map((field, i) => (
              <FieldRow key={field.id} field={field} index={i} onChange={updateField} />
            ))}
            {Object.entries(grouped).map(([groupName, groupFields]) => (
              <div key={groupName} className="we-group">
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>{groupName}</div>
                {groupFields.map((field, i) => (
                  <FieldRow key={field.id} field={field} index={i} onChange={updateField} />
                ))}
              </div>
            ))}

            {visibleFields.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontSize: 13 }}>No editable fields in this section.</div>
            )}
          </div>
        </div>
      </div>

      {/* One quiet line, same place and style as the main chat's disclaimer.
          Shortcuts live in the button tooltips instead of a footer. */}
      <div style={{ padding: "8px 16px 14px", textAlign: "center", fontSize: 12, fontWeight: 500, color: C.textSec, flexShrink: 0 }}>
        Changes go live when you redeploy.
      </div>
    </div>
  );
}

function FieldRow({ field, index, onChange }: { field: EditableField; index: number; onChange: (f: EditableField, v: string) => void }) {
  return (
    <div style={{ marginBottom: 18, animation: `weFadeUp 200ms ${EASE} ${index * 20}ms both` }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.textSec, margin: "0 0 6px 2px" }}>
        {field.label}
      </label>
      {field.type === "textarea" ? (
        <textarea className="we-input we-textarea" value={field.value} onChange={e => onChange(field, e.target.value)} rows={3} />
      ) : (
        <input className="we-input" type="text" value={field.value} onChange={e => onChange(field, e.target.value)} />
      )}
    </div>
  );
}