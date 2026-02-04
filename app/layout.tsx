import "./globals.css";
import { GeistSans } from "geist/font/sans";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.className} bg-gradient-to-b from-[#0b1220] to-[#05070c] text-white`}
      >
        {children}
      </body>
    </html>
  );
}
