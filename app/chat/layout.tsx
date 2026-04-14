import { ZelrexErrorBoundary } from "@/components/ZelrexErrorBoundary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Zelrex — AI Business Engine",
  description: "AI-powered business infrastructure for freelancers. Build websites, manage clients, track revenue.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent" as const,
    title: "Zelrex",
  },
  themeColor: "#06090F",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ZelrexErrorBoundary>
      {children}
    </ZelrexErrorBoundary>
  );
}