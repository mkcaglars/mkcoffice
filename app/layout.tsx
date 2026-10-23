import type { Metadata } from "next";
import { GoogleAnalytics } from '@next/third-parties/google'
import { getMessages } from "next-intl/server";
import { I18nProvider } from "@/components/i18n-provider";
import { ProgressProvider } from "@/components/progress-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MKC Ofis — Free Online Word, Excel & PowerPoint Editor",
    template: "%s",
  },
  description:
    "Free online office suite. Open, view, and edit Word, Excel, and PowerPoint documents directly in your browser. No upload, no login — your files stay private.",
  keywords: [
    "web office",
    "online office suite",
    "Word online",
    "Excel online",
    "PowerPoint online",
    "DOCX viewer",
    "DOCX editor",
    "XLSX editor",
    "PPTX editor",
    "open docx online",
    "edit excel online",
    "serverless office",
    "privacy first",
    "MKC Ofis",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    siteName: "MKC Ofis",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@nicezizi",
  },
  // Self-hosted (PHP backend) builds sit behind the portal login.
  robots:
    process.env.NEXT_PUBLIC_BACKEND === "php"
      ? { index: false, follow: false }
      : { index: true, follow: true },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "MKC Ofis",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  const preload = () => {
    const theme = document.cookie.match(/theme=([^;]+)/)?.[1] || "";
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme == "dark" || (dark && theme != "light");
    document.documentElement.classList.toggle("dark", isDark);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MKC Ofis",
    url: SITE_URL,
    description:
      "Open, view, and edit Word, Excel, and PowerPoint documents directly in your browser. No upload, no server — your files stay private.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Edit DOCX, XLSX, PPTX files",
      "No file upload required",
      "Privacy-first — files stay local",
      "Free templates",
      "Browser extension for drag & drop",
    ],
  };

  return (
    <html suppressHydrationWarning>
      <head>
        <script>{`(${preload.toString()})()`}</script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <ProgressProvider>
          <I18nProvider initialMessages={messages}>{children}</I18nProvider>
        </ProgressProvider>
        <Toaster position="bottom-center" />
      </body>
      {/* Self-hosted (PHP backend) builds do not report to the upstream analytics. */}
      {process.env.NEXT_PUBLIC_BACKEND !== "php" && (
        <GoogleAnalytics gaId="G-EFLBPT6TS8" />
      )}
    </html>
  );
}
