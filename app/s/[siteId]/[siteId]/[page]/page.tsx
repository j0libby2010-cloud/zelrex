import { getWebsiteById } from "../../../../../website/core/getWebsiteById";
import { RenderPage } from "../../../../../website/pages/renderPage";
import { notFound } from "next/navigation";

export default function SitePage({
  params,
}: {
  params: { siteId: string; page: string };
}) {
  const website = getWebsiteById(params.siteId);

  if (!website) {
    notFound();
  }

  const pageType = params.page as
    | "home"
    | "offer"
    | "pricing"
    | "about"
    | "contact";

  return <RenderPage website={website} pageType={pageType} />;
}
