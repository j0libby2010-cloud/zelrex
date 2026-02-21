import { ReactNode } from "react";
import { themes } from "../../theme/themes";

export function Section({
  themeKey,
  children,
}: {
  themeKey: keyof typeof themes | string;
  children: ReactNode;
}) {
  const theme = themes[(themeKey as keyof typeof themes)] ?? themes.obsidian;

  return (
    <section
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: `${theme.pagePadding}px`,
        display: "flex",
        flexDirection: "column",
        gap: theme.sectionGap,
      }}
    >
      {children}
    </section>
  );
}
