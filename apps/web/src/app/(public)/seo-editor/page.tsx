import type { Metadata } from 'next';
import { AlignLeft, FileText, Heading, KeyRound, PenSquare, Sparkles } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "SEO Editor", description: "Write and optimize pages with live SEO guidance for titles, headings, keywords, readability and structure.", alternates: { canonical: '/seo-editor' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="On-Page SEO Editor"
      title="Optimize content while you write"
      lead="The SEO Editor scores your draft as you type and suggests concrete improvements for titles, headings, keyword use and readability."
      primary={{ label: "Try the SEO Editor", href: "/signup" }}
      secondary={{ label: "See pricing", href: "/pricing" }}
      facts={{ title: "Built for real pages", items: ["Guidance based on your target keywords and page content", "Works for new drafts and existing URLs", "AI suggestions are clearly labelled and always editable", "Publish to connected CMS platforms where available"] }}
      cta={{ title: "Write better pages faster", text: "Create a free account and open the editor from any project." }}
      features={[
        { icon: <PenSquare size={24} />, title: "Live scoring", text: "See how changes affect your on-page score in real time." },
        { icon: <KeyRound size={24} />, title: "Keyword guidance", text: "Track target and related terms without stuffing." },
        { icon: <Heading size={24} />, title: "Structure checks", text: "Get feedback on headings, length and internal links." },
        { icon: <AlignLeft size={24} />, title: "Readability", text: "Spot long sentences and dense paragraphs." },
        { icon: <Sparkles size={24} />, title: "AI assistance", text: "Generate titles, descriptions and outlines you can edit." },
        { icon: <FileText size={24} />, title: "Drafts & history", text: "Save drafts and keep a history of versions." },
      ]}
      steps={[
        { title: "Pick a page", text: "Start a new draft or load an existing URL." },
        { title: "Set keywords", text: "Choose the terms the page should rank for." },
        { title: "Edit with guidance", text: "Follow live suggestions as you write." },
        { title: "Publish", text: "Copy the result or publish to your CMS." },
      ]}
      related={[
        { label: "On-Page SEO Audit", href: "/seo-audit" },
        { label: "GEO / AI Search", href: "/geo-ai-search" },
        { label: "Content Audit", href: "/content-audit" },
        { label: "Website Value Calculator", href: "/website-value" },
      ]}
    />
  );
}
