import { notFound } from "next/navigation";
import { getWebsiteById } from "@/website/core/getWebsiteById";
import { RenderPage } from "@/website/pages/renderPage";

export default async function SiteHome({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  const website = await getWebsiteById(siteId);

  if (!website) {
    notFound();
  }

  return <RenderPage website={website} pageType="home" />;
}
