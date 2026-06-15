import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PracticePro — Legal & Property Practice Management for Nigeria",
  description:
    "The all-in-one platform for Nigerian legal practitioners and property managers. Draft court documents with VEGA, manage properties with Atrium. Built for Nigeria, powered by AI.",
  keywords: [
    "PracticePro",
    "VEGA",
    "Atrium",
    "Nigeria legal software",
    "legal & property practice management",
    "property management Nigeria",
    "legal document drafting",
    "Nigerian regulatory compliance",
    "NDPA 2023",
    "AI practice assistant",
  ],
  authors: [{ name: "PracticePro" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PracticePro — Legal & Property Practice Management for Nigeria",
    description:
      "Draft court documents with AI. Manage properties effortlessly. Built for Nigerian legal practitioners and property managers.",
    url: "https://practicepro.ng",
    siteName: "PracticePro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PracticePro — Legal & Property Practice Management for Nigeria",
    description:
      "Draft court documents with AI. Manage properties effortlessly. Built for Nigerian legal practitioners and property managers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
