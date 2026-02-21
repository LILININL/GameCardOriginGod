import type { Metadata } from "next";
import { Azeret_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const azeretMono = Azeret_Mono({
  variable: "--font-azeret-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alumilive เว็บทดสอบ Alpha",
  description: "ห้องเล่นตัวอย่างและห้องแสดงการ์ด",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="th">
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${azeretMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
