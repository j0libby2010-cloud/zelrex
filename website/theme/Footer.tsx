import { ZelrexWebsite } from "../core/websiteTypes";

export function Footer({ website }: { website: ZelrexWebsite }) {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "64px 24px",
        marginTop: 120,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div>
          <strong>{website.branding.name}</strong>
          <p style={{ opacity: 0.7, maxWidth: 360 }}>
            {website.branding.tagline ??
              "Built with clarity, focus, and intention."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 32 }}>
          {website.pages.map((p) => (
            <a key={p.slug} href={`/${p.slug}`}>
              {p.title}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
