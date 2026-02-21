import { ZelrexWebsite } from "../../core/websiteTypes";
import { themes } from "../../theme/themes";

export function Hero({
  website,
  title,
  subtitle,
}: {
  website: ZelrexWebsite;
  title: string;
  subtitle?: string;
}) {
  const theme =
    themes[website.theme as keyof typeof themes] ?? themes.ivory;

  return (
    <section
      style={{
          display: "flex",
          flexDirection: "column",
          gap: theme.sectionGap,
          padding: `${theme.pagePadding}px`,
      }}
    >
      <h1
        style={{
          fontSize: theme.heroTitleSize,
          fontWeight: theme.headingWeight,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        {title}
      </h1>

      {subtitle ? (
        <p
          style={{
            maxWidth: 720,
            fontSize: theme.heroSubtitleSize,
            lineHeight: 1.6,
            opacity: 0.85,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </section>
  );
}
