import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monitor Dashboard",
  description: "Modern white theme dashboard for Vercel, Cloudflare, and EdgeOne",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#f9fafb] text-gray-900`}>
        {children}
      </body>
    </html>
  );
}