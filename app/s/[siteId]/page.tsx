import { getWebsiteById } from "../../../website/core/getWebsiteById";
import { RenderPage } from "../../../website/pages/renderPage";
import { notFound } from "next/navigation";

export default function SiteHome({
  params,
}: {
  params: { siteId: string };
}) {
  const website = getWebsiteById(params.siteId);

  if (!website) {
    notFound();
  }

  return <RenderPage website={website} pageType="home" />;
}
