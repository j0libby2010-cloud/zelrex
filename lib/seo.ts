// lib/seo.ts — SEO enhancement for generated freelancer websites

export interface SEOData {
  businessName: string;
  tagline: string;
  description: string;
  url: string;
  niche: string;
  services: string[];
  location?: string;
  logo?: string;
  primaryColor: string;
  pricing?: { name: string; price: string }[];
}

/**
 * Generate meta tags, OG tags, and structured data for a freelancer website.
 * Inject into <head> of the generated HTML.
 */
export function generateSEOHead(data: SEOData): string {
  const desc = (data.description || data.tagline || `${data.businessName} — professional ${data.niche} services`).slice(0, 160);
  const title = `${data.businessName} — ${data.tagline || data.niche}`;

  // Structured data (JSON-LD) — LocalBusiness + Service
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: data.businessName,
    description: desc,
    url: data.url,
    ...(data.logo ? { logo: data.logo } : {}),
    ...(data.location ? { address: { "@type": "PostalAddress", addressLocality: data.location } } : {}),
    ...(data.services.length > 0 ? {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Services",
        itemListElement: data.services.map((s, i) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s },
          position: i + 1,
        })),
      },
    } : {}),
    ...(data.pricing?.length ? {
      priceRange: data.pricing.map(p => p.price).join(" - "),
    } : {}),
  };

  return `
    <title>${escHtml(title)}</title>
    <meta name="description" content="${escHtml(desc)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${escHtml(data.url)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escHtml(title)}">
    <meta property="og:description" content="${escHtml(desc)}">
    <meta property="og:url" content="${escHtml(data.url)}">
    <meta property="og:site_name" content="${escHtml(data.businessName)}">
    ${data.logo ? `<meta property="og:image" content="${escHtml(data.logo)}">` : ""}
    <meta name="theme-color" content="${data.primaryColor || '#000000'}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escHtml(title)}">
    <meta name="twitter:description" content="${escHtml(desc)}">

    <!-- Structured Data -->
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  `.trim();
}

/**
 * Generate a simple sitemap XML for a deployed site.
 */
export function generateSitemap(baseUrl: string): string {
  const now = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

/**
 * Generate robots.txt for a deployed site.
 */
export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Inject SEO head tags into existing HTML string.
 * Finds </head> or <head> and inserts the SEO tags.
 */
export function injectSEO(html: string, seoData: SEOData): string {
  const seoHead = generateSEOHead(seoData);

  // Try to inject before </head>
  if (html.includes("</head>")) {
    return html.replace("</head>", seoHead + "\n</head>");
  }

  // Try to inject after <head>
  if (html.includes("<head>")) {
    return html.replace("<head>", "<head>\n" + seoHead);
  }

  // If no head tag, add one
  if (html.includes("<html")) {
    return html.replace(/<html[^>]*>/, (match) => match + "\n<head>\n" + seoHead + "\n</head>");
  }

  // Last resort: prepend
  return "<head>\n" + seoHead + "\n</head>\n" + html;
}