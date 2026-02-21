import React from "react";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, H2, Lead, Button, Card, getTheme, withAlpha } from "../components/ui";

export function ContactPage({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.contact;
  const biz = website.businessContext;

  return (
    <>
      <Section website={website} style={{ paddingTop: 80 }}>
        <H2 website={website}>
          {copy?.hero?.headline ?? "Get in touch"}
        </H2>
        <Lead website={website} style={{ marginTop: 12 }}>
          {copy?.hero?.subheadline ?? "We'd love to hear from you. Reach out and we'll get back to you within 24 hours."}
        </Lead>
      </Section>

      <Section website={website}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {/* Contact form */}
          <Card website={website} style={{ padding: 32 }}>
            <form
              action={`mailto:hello@${(website.branding.name ?? "business").toLowerCase().replace(/\s+/g, "")}.com`}
              method="POST"
              encType="text/plain"
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Your name"
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12,
                    background: withAlpha(t.textPrimary, 0.04),
                    border: `1px solid ${t.border}`, color: t.textPrimary,
                    fontSize: 14, fontFamily: t.fontFamily, outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12,
                    background: withAlpha(t.textPrimary, 0.04),
                    border: `1px solid ${t.border}`, color: t.textPrimary,
                    fontSize: 14, fontFamily: t.fontFamily, outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>
                  Message
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about your project or question..."
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12,
                    background: withAlpha(t.textPrimary, 0.04),
                    border: `1px solid ${t.border}`, color: t.textPrimary,
                    fontSize: 14, fontFamily: t.fontFamily, outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: "14px 28px", borderRadius: t.button.radius,
                  background: t.button.background, color: t.button.text,
                  fontSize: 14, fontWeight: 600, fontFamily: t.fontFamily,
                  border: "none", cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              >
                Send message
              </button>
            </form>
          </Card>

          {/* Contact info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card website={website} style={{ padding: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Email
              </div>
              <div style={{ fontSize: 15, color: t.textPrimary }}>
                hello@{(website.branding.name ?? "business").toLowerCase().replace(/\s+/g, "")}.com
              </div>
            </Card>

            <Card website={website} style={{ padding: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Response time
              </div>
              <div style={{ fontSize: 15, color: t.textPrimary }}>
                We typically respond within 24 hours during business days.
              </div>
            </Card>

            {biz?.audience && (
              <Card website={website} style={{ padding: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Who we work with
                </div>
                <div style={{ fontSize: 15, color: t.textPrimary, lineHeight: 1.6 }}>
                  {biz.audience}
                </div>
              </Card>
            )}

            <Card website={website} style={{ padding: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Book a call
              </div>
              <div style={{ fontSize: 15, color: t.textSecondary, marginBottom: 12 }}>
                Prefer to talk? Schedule a free discovery call.
              </div>
              <Button website={website} href="/contact">
                Schedule call
              </Button>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}