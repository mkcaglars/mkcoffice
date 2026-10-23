import type { Metadata } from "next";
import { TemplateView } from "@/components/main/template-view";
import { getTemplates } from "@/utils/templates";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title:
    "Free Office Templates — Word, Excel & PowerPoint | MKC Ofis",
  description:
    "Download free professional templates for Word documents, Excel spreadsheets, and PowerPoint presentations. No login required — open and edit directly in your browser.",
  keywords: [
    "free office templates",
    "free Word template",
    "free Excel template",
    "free PowerPoint template",
    "resume template free",
    "spreadsheet template free",
    "presentation template free",
    "document template online",
    "MKC Ofis",
  ],
  alternates: {
    canonical: `${SITE_URL}/template`,
  },
  openGraph: {
    title: "Free Office Templates — Word, Excel & PowerPoint | MKC Ofis",
    description:
      "Free professional templates for Word, Excel, and PowerPoint. Edit directly in your browser — no login needed.",
    url: `${SITE_URL}/template`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Office Templates — Word, Excel & PowerPoint | MKC Ofis",
    description:
      "Free professional templates for Word, Excel, and PowerPoint. Edit directly in your browser.",
  },
};

export default function TemplatePage() {
  const templates = getTemplates();
  return <TemplateView initialTemplates={templates} />;
}
