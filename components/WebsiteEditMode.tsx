// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from "react";

const G = {
  bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6", green: "#34D399", amber: "#FBBF24", red: "#F87171",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

interface EditableField {
  id: string;
  path: string; // JSON path in websiteData, e.g. "copy.hero.headline"
  label: string;
  value: string;
  type: "text" | "textarea" | "price";
  section: string;
}

function extractEditableFields(websiteData: any): EditableField[] {
  const fields: EditableField[] = [];
  const copy = websiteData?.copy || {};
  const branding = websiteData?.branding || {};
  const survey = websiteData?.survey || {};
  let idx = 0;
  const add = (path: string, label: string, value: any, type: "text" | "textarea" | "price", section: string) => {
    if (value !== undefined && value !== null) {
      fields.push({ id: `f_${idx++}`, path, label, value: String(value), type, section });
    }
  };

  // Hero section
  add("copy.hero.headline", "Hero headline", copy.hero?.headline, "text", "Hero");
  add("copy.hero.subheadline", "Hero subheadline", copy.hero?.subheadline, "textarea", "Hero");
  add("copy.hero.ctaText", "Hero CTA button", copy.hero?.ctaText, "text", "Hero");

  // About
  add("copy.about.headline", "About headline", copy.about?.headline, "text", "About");
  add("copy.about.body", "About text", copy.about?.body, "textarea", "About");

  // Value props
  if (copy.valueProps?.items) {
    copy.valueProps.items.forEach((item: any, i: number) => {
      add(`copy.valueProps.items[${i}].title`, `Benefit ${i + 1} title`, item.title, "text", "Benefits");
      add(`copy.valueProps.items[${i}].description`, `Benefit ${i + 1} description`, item.description, "textarea", "Benefits");
    });
  }

  // Pricing
  if (copy.pricing?.tiers) {
    copy.pricing.tiers.forEach((tier: any, i: number) => {
      add(`copy.pricing.tiers[${i}].name`, `Tier ${i + 1} name`, tier.name, "text", "Pricing");
      add(`copy.pricing.tiers[${i}].price`, `Tier ${i + 1} price`, tier.price, "price", "Pricing");
      add(`copy.pricing.tiers[${i}].description`, `Tier ${i + 1} description`, tier.description, "textarea", "Pricing");
    });
  }

  // Testimonials
  if (copy.testimonials?.items) {
    copy.testimonials.items.forEach((t: any, i: number) => {
      add(`copy.testimonials.items[${i}].quote`, `Testimonial ${i + 1}`, t.quote, "textarea", "Testimonials");
      add(`copy.testimonials.items[${i}].name`, `Testimonial ${i + 1} name`, t.name, "text", "Testimonials");
    });
  }

  // CTA
  add("copy.cta.headline", "CTA headline", copy.cta?.headline, "text", "CTA");
  add("copy.cta.subheadline", "CTA subtext", copy.cta?.subheadline, "textarea", "CTA");
  add("copy.cta.buttonText", "CTA button", copy.cta?.buttonText, "text", "CTA");

  // Branding
  add("branding.name", "Business name", branding.name, "text", "Branding");
  add("branding.tagline", "Tagline", branding.tagline, "text", "Branding");

  return fields;
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
    if (current[key] === undefined) current[key] = {};
    current = current[key];
  }
  const lastKey = isNaN(Number(parts[parts.length - 1])) ? parts[parts.length - 1] : Number(parts[parts.length - 1]);
  current[lastKey] = value;
  return clone;
}

export function WebsiteEditMode({ websiteData, onSave, onClose }: {
  websiteData: any;
  onSave: (updatedData: any) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [editedData, setEditedData] = useState<any>(websiteData);
  const [activeSection, setActiveSection] = useState<string>("Hero");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (websiteData) setFields(extractEditableFields(websiteData));
  }, [websiteData]);

  const sections = [...new Set(fields.map(f => f.section))];

  const updateField = (field: EditableField, newValue: string) => {
    const updated = setNestedValue(editedData, field.path, newValue);
    setEditedData(updated);
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: newValue } : f));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedData);
      setHasChanges(false);
    } catch {}
    setSaving(false);
  };

  if (!websiteData) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
        <div style={{ color: G.textSec, fontSize: 14 }}>No website data to edit. Build a website first.</div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgb(3,5,8)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes weFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .we-input{width:100%;padding:10px 14px;border-radius:10px;border:1px solid ${G.glassBorder};background:rgba(255,255,255,0.03);color:${G.text};font-size:13px;font-family:inherit;outline:none;transition:border-color 200ms}
        .we-input:focus{border-color:${G.accent}}
        .we-textarea{resize:vertical;min-height:60px;line-height:1.6}
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${G.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.textMuted, cursor: "pointer", fontSize: 18, padding: 4 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Edit website</div>
            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{fields.length} editable fields · {hasChanges ? "Unsaved changes" : "No changes"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {hasChanges && (
            <button onClick={() => { setEditedData(websiteData); setFields(extractEditableFields(websiteData)); setHasChanges(false); }} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${G.glassBorder}`, background: "none", color: G.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Discard
            </button>
          )}
          <button onClick={handleSave} disabled={!hasChanges || saving} style={{
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
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {fields.filter(f => f.section === activeSection).map((field, i) => (
            <div key={field.id} style={{ marginBottom: 20, animation: `weFadeUp 200ms ${EASE} ${i * 30}ms both` }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: G.textSec, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  className="we-input we-textarea"
                  value={field.value}
                  onChange={e => updateField(field, e.target.value)}
                  rows={3}
                />
              ) : (
                <input
                  className="we-input"
                  type={field.type === "price" ? "text" : "text"}
                  value={field.value}
                  onChange={e => updateField(field, e.target.value)}
                />
              )}
            </div>
          ))}

          {fields.filter(f => f.section === activeSection).length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: G.textMuted, fontSize: 13 }}>
              No editable fields in this section.
            </div>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ padding: "12px 24px", borderTop: `1px solid ${G.glassBorder}`, fontSize: 11, color: G.textMuted, textAlign: "center", flexShrink: 0 }}>
        Changes will rebuild your website with the updated text. Images and layout stay the same. Redeploy after saving to push changes live.
      </div>
    </div>
  );
}