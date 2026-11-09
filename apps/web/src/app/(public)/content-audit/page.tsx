import type { Metadata } from 'next';
import { Archive, BarChart3, CalendarClock, FileSearch, Layers, ListChecks } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Content Audit", description: "Review the quality, freshness and performance of your existing content and decide what to update, merge or remove.", alternates: { canonical: '/content-audit' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Content Audit"
      title="Know which content earns its place"
      lead="Content Audit reviews your pages for quality, duplication and freshness and, with connected analytics, their performance, so you can plan updates with confidence."
      primary={{ label: "Audit your content", href: "/signup" }}
      secondary={{ label: "See pricing", href: "/pricing" }}
      facts={{ title: "Decisions you can make", items: ["Keep, update, merge or remove, page by page", "Performance data from your connected accounts only", "Duplicate and thin content flagged for review", "Export the plan to share with your team"] }}
      cta={{ title: "Clean up your content library", text: "Create a free account, connect your analytics and run a content audit." }}
      features={[
        { icon: <FileSearch size={24} />, title: "Page inventory", text: "A complete list of the content we found on your site." },
        { icon: <Layers size={24} />, title: "Duplication checks", text: "Find overlapping and competing pages." },
        { icon: <CalendarClock size={24} />, title: "Freshness", text: "Spot outdated pages that need a refresh." },
        { icon: <BarChart3 size={24} />, title: "Performance", text: "Bring in traffic and search data from connected accounts." },
        { icon: <ListChecks size={24} />, title: "Recommendations", text: "Clear next steps for each page." },
        { icon: <Archive size={24} />, title: "Action plan", text: "Turn recommendations into tracked tasks." },
      ]}
      steps={[
        { title: "Connect data", text: "Optionally connect Search Console and Analytics." },
        { title: "Run the audit", text: "We review each page." },
        { title: "Decide", text: "Choose to keep, update, merge or remove." },
        { title: "Track", text: "Follow the plan in your project." },
      ]}
      related={[
        { label: "On-Page SEO Audit", href: "/seo-audit" },
        { label: "SEO Editor", href: "/seo-editor" },
        { label: "GEO / AI Search", href: "/geo-ai-search" },
        { label: "Website Value Calculator", href: "/website-value" },
      ]}
    />
  );
}
