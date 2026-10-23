import type { Metadata } from "next";
import { Suspense } from "react";
import { OpenView } from "@/components/main/open-view";
import { FilesView } from "@/components/main/files-view";
import { getRecommendedTemplates } from "@/utils/templates";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title:
    "Free Online Office Editor — Open & Edit Word, Excel, PowerPoint | MKC Ofis",
  description:
    "Open, view, and edit DOCX, XLSX, PPTX files directly in your browser for free. No upload, no login — your documents stay private. Drag & drop with the browser extension.",
  keywords: [
    "online office editor",
    "free Word editor online",
    "free Excel editor online",
    "free PowerPoint editor online",
    "open docx online",
    "edit xlsx in browser",
    "edit pptx in browser",
    "no upload document editor",
    "privacy first office",
    "MKC Ofis",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Free Online Office Editor — Word, Excel, PowerPoint | MKC Ofis",
    description:
      "Edit Office documents in your browser for free. No upload, no login — fully private.",
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Online Office Editor — Word, Excel, PowerPoint | MKC Ofis",
    description:
      "Edit Office documents in your browser for free. No upload, no login — fully private.",
  },
};

export default function HomePage() {
  // Server-storage builds (PHP backend) open on the user's files.
  if (process.env.NEXT_PUBLIC_BACKEND === "php") {
    return (
      <Suspense>
        <FilesView />
      </Suspense>
    );
  }
  const templates = getRecommendedTemplates();
  return <OpenView recommendedTemplates={templates} />;
}
