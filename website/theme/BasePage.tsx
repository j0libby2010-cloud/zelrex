import { ZelrexWebsite } from "../core/websiteTypes";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function BasePage({
  website,
  children,
}: {
  website: ZelrexWebsite;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={website.theme}>
      <Header website={website} />

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "96px 24px 120px",
        }}
      >
        {children}
      </main>

      <Footer website={website} />
    </div>
  );
}

