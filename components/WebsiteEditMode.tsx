// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

const G = {
  bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6", green: "#34D399", amber: "#FBBF24", red: "#F87171",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

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
      <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
        <div style={{ color: G.textSec, fontSize: 14 }}>No website data to edit. Build a website first.</div>
      </div>
    );
  }

  const visibleFields = fields.filter(f => f.section === activeSection);
  const grouped: Record<string, EditableField[]> = {};
  const ungrouped: EditableField[] = [];
  visibleFields.forEach(f => {
    if (f.group) { if (!grouped[f.group]) grouped[f.group] = []; grouped[f.group].push(f); }
    else ungrouped.push(f);
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgb(3,5,8)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes weFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .we-input{width:100%;padding:10px 14px;border-radius:10px;border:1px solid ${G.glassBorder};background:rgba(255,255,255,0.03);color:${G.text};font-size:13px;font-family:inherit;outline:none;transition:border-color 200ms}
        .we-input:focus{border-color:${G.accent}}
        .we-textarea{resize:vertical;min-height:60px;line-height:1.6}
        .we-group{padding:14px;border-radius:12px;background:rgba(255,255,255,0.015);border:1px solid ${G.glassBorder};margin-bottom:16px}
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${G.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} title="Close (Esc)" style={{ background: "none", border: "none", color: G.textMuted, cursor: "pointer", fontSize: 18, padding: 4 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Edit website</div>
            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>
              {fields.length} editable fields · {hasChanges ? "Unsaved changes" : "All saved"}
              {draftRestored && <span style={{ color: G.amber, marginLeft: 8 }}>· Draft restored</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saveSuccess && <span style={{ fontSize: 12, color: G.green }}>✓ Saved</span>}
          {hasChanges && (
            <button onClick={handleDiscard} title="Discard all changes" style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${G.glassBorder}`, background: "none", color: G.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Discard
            </button>
          )}
          <button onClick={handleSave} disabled={!hasChanges || saving} title="Save (⌘S)" style={{
            padding: "8px 20px", borderRadius: 10, border: "none",
            background: hasChanges ? G.accent : "rgba(255,255,255,0.06)",
            color: hasChanges ? "#fff" : G.textMuted,
            fontSize: 13, fontWeight: 600, cursor: hasChanges ? "pointer" : "default",
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Saving..." : "Save & rebuild"}
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div style={{ padding: "10px 24px", background: "rgba(248,113,113,0.08)", borderBottom: `1px solid rgba(248,113,113,0.2)`, fontSize: 12, color: G.red, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: "none", border: "none", color: G.red, cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${G.glassBorder}`, display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: "6px 14px", borderRadius: 999, border: `0.5px solid ${activeSection === s ? G.accent + "40" : G.glassBorder}`,
            background: activeSection === s ? G.accent + "12" : "transparent",
            color: activeSection === s ? G.accent : G.textMuted,
            fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {ungrouped.map((field, i) => (
            <FieldRow key={field.id} field={field} index={i} onChange={updateField} />
          ))}
          {Object.entries(grouped).map(([groupName, groupFields]) => (
            <div key={groupName} className="we-group">
              <div style={{ fontSize: 11, fontWeight: 700, color: G.text, marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {groupName}
              </div>
              {groupFields.map((field, i) => (
                <FieldRow key={field.id} field={field} index={i} onChange={updateField} />
              ))}
            </div>
          ))}

          {visibleFields.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: G.textMuted, fontSize: 13 }}>
              No editable fields in this section.
            </div>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ padding: "12px 24px", borderTop: `1px solid ${G.glassBorder}`, fontSize: 11, color: G.textMuted, textAlign: "center", flexShrink: 0 }}>
        ⌘S to save · Esc to close · Drafts auto-saved · Redeploy after saving to push changes live
      </div>
    </div>
  );
}

function FieldRow({ field, index, onChange }: { field: EditableField; index: number; onChange: (f: EditableField, v: string) => void }) {
  return (
    <div style={{ marginBottom: 18, animation: `weFadeUp 200ms ${EASE} ${index * 20}ms both` }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: G.textSec, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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