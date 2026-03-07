import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, Card, Button, getTheme } from "./ui";

/**
 * PricingSection — Now dynamic.
 *
 * Priority for tier data:
 * 1. website.copy.pricing.pricing.tiers (from Claude copy generation — real user data)
 * 2. Fallback to a single "Contact for pricing" card if no tiers exist
 *
 * Stripe integration:
 * - If website.stripeCheckoutUrls exists, CTA buttons link to Stripe checkout
 * - If not, CTA buttons link to /contact (or calendly if available)
 */
export function PricingSection({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);

  // Pull real tier data from the generated copy
  const copyTiers = website.copy?.pricing?.pricing?.tiers;
  const stripeUrls: Record<string, string> = (website as any).stripeCheckoutUrls || {};
  const contactFallback = (website as any).copy?.contact?.methods?.items?.find(
    (m: any) => m.label === "Book a call"
  )?.href || "/contact";

  // If no tiers in copy, show a single card
  const tiers = copyTiers && copyTiers.length > 0
    ? copyTiers
    : [
        {
          name: website.copy?.pricing?.pricing?.title || "Custom",
          price: "Contact for pricing",
          note: "",
          features: ["Tailored to your project", "Scope call included"],
          highlighted: true,
        },
      ];

  /**
   * Resolve the CTA URL for a tier:
   * 1. Check stripeCheckoutUrls for a matching key
   * 2. Fall back to contact/booking link
   */
  function getTierUrl(tierName: string): string {
    const key = tierName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (stripeUrls[key]) return stripeUrls[key];
    // Also try exact match and common variations
    for (const [k, v] of Object.entries(stripeUrls)) {
      if (k.toLowerCase() === tierName.toLowerCase()) return v;
    }
    return contactFallback;
  }

  /**
   * Determine the CTA text based on whether Stripe is connected
   */
  function getCtaText(tierName: string): string {
    const key = tierName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const hasStripe = stripeUrls[key] || Object.keys(stripeUrls).some(
      k => k.toLowerCase() === tierName.toLowerCase()
    );
    if (hasStripe) return `Get ${tierName}`;
    return website.copy?.pricing?.cta?.cta?.text || "Get started";
  }

  return (
    <Section website={website} id="pricing">
      <div style={{ display: "grid", gap: 14 }}>
        <Eyebrow website={website}>
          {website.copy?.pricing?.pricing?.eyebrow ?? "Pricing"}
        </Eyebrow>
        <h2
          style={{
            margin: 0,
            fontFamily: t.fontFamily,
            color: t.textPrimary,
            fontSize: 34,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {website.copy?.pricing?.pricing?.title ??
            website.copy?.pricing?.hero?.headline ??
            "Simple pricing, clear value."}
        </h2>
        <p
          style={{
            margin: 0,
            color: t.textSecondary,
            maxWidth: 760,
            lineHeight: 1.6,
            fontSize: 16,
          }}
        >
          {website.copy?.pricing?.pricing?.subtitle ??
            website.copy?.pricing?.hero?.subheadline ??
            "Transparent pricing. No surprises."}
        </p>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns:
            tiers.length === 1
              ? "minmax(0, 480px)"
              : tiers.length === 2
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(3, minmax(0, 1fr))",
          gap: 14,
          alignItems: "stretch",
          justifyContent: tiers.length === 1 ? "center" : undefined,
        }}
      >
        {tiers.map((tier: any) => {
          const isHighlighted = tier.highlighted === true;
          const tierUrl = getTierUrl(tier.name);
          const ctaText = getCtaText(tier.name);
          const isStripeLink = tierUrl.includes("stripe.com") || tierUrl.includes("buy.stripe.com");

          return (
            <Card
              key={tier.name}
              website={website}
              style={{
                padding: 18,
                position: "relative",
                outline: isHighlighted
                  ? `2px solid ${withAlpha(t.accent, 0.55)}`
                  : "none",
                boxShadow: isHighlighted
                  ? "0 30px 90px rgba(0,0,0,0.35)"
                  : undefined,
              }}
            >
              {isHighlighted && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: withAlpha(t.accent, 0.15),
                    border: `1px solid ${withAlpha(t.accent, 0.35)}`,
                    color: t.textPrimary,
                  }}
                >
                  {tiers.length > 1 ? "Most popular" : "Featured"}
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    fontWeight: 850,
                    color: t.textPrimary,
                    fontSize: 16,
                  }}
                >
                  {tier.name}
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    color: t.textPrimary,
                    fontSize: 28,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {tier.price}
                </div>
                {tier.note && (
                  <div
                    style={{
                      color: t.textSecondary,
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {tier.note}
                  </div>
                )}
              </div>

              {tier.features && tier.features.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    borderTop: `1px solid ${t.border}`,
                    paddingTop: 14,
                  }}
                >
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      color: t.textSecondary,
                      lineHeight: 1.7,
                      fontSize: 14,
                    }}
                  >
                    {tier.features.map((f: string) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <Button
                  website={website}
                  href={tierUrl}
                  variant={isHighlighted ? "primary" : "secondary"}
                  {...(isStripeLink ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {ctaText}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Guarantee banner — if the copy has one */}
      {website.copy?.pricing?.cta?.subtitle && (
        <div
          style={{
            marginTop: 20,
            padding: "14px 18px",
            borderRadius: 12,
            background: withAlpha(t.accent, 0.06),
            border: `1px solid ${withAlpha(t.accent, 0.15)}`,
            textAlign: "center",
            color: t.textSecondary,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {website.copy.pricing.cta.subtitle}
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          section#pricing > div > div:nth-child(2) {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 680px) {
          section#pricing > div > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Section>
  );
}

function withAlpha(hexOrRgb: string, a: number) {
  if (hexOrRgb.includes("gradient(")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgba(")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgb(")) return hexOrRgb;
  if (
    !hexOrRgb.startsWith("#") ||
    (hexOrRgb.length !== 7 && hexOrRgb.length !== 4)
  )
    return hexOrRgb;

  const hex =
    hexOrRgb.length === 4
      ? `#${hexOrRgb[1]}${hexOrRgb[1]}${hexOrRgb[2]}${hexOrRgb[2]}${hexOrRgb[3]}${hexOrRgb[3]}`
      : hexOrRgb;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}