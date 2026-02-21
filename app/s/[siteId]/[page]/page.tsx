import { notFound } from "next/navigation";
import { getWebsiteById } from "@/website/core/getWebsiteById";
import { RenderPage } from "@/website/pages/renderPage";

export default async function SiteSubPage({
  params,
}: {
  params: Promise<{ siteId: string; page: string }>;
}) {
  const { siteId, page } = await params;
  const website = await getWebsiteById(siteId);

  if (!website) {
    notFound();
  }

  const matched = website.pages.find((p) => p.slug === page);

  if (!matched) {
    notFound();
  }

  return (
    <RenderPage
      website={website}
      pageType={
        matched.slug as "home" | "offer" | "pricing" | "about" | "contact"
      }
    />
  );
}
