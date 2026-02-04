import { notFound } from "next/navigation";
import { getWebsiteById } from "@/website/core/getWebsiteById";
import { RenderPage } from "@/website/pages/renderPage";

interface PageProps {
  params: {
    siteId: string;
    page: string;
  };
}

export default async function SiteSubPage({ params }: PageProps) {
  const website = await getWebsiteById(params.siteId);

  if (!website) {
    notFound();
  }

  const page = website.pages.find((p) => p.slug === params.page);

  if (!page) {
    notFound();
  }

  return <RenderPage website={website} pageType={(page as any).type} />;
}
