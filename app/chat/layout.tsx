import "../globals.css";
import { GeistSans } from "geist/font/sans";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} bg-[#05070C] text-white`}>
        {children}
      </body>
    </html>
  );
}
