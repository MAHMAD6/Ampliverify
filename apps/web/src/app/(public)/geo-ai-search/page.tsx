import type { Metadata } from 'next';
import { Bot, Eye, Link2, MessageSquareText, Sparkles, Users } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "GEO / AI Search Optimization", description: "See how your brand appears in AI-generated answers and get recommendations to improve your visibility in AI search.", alternates: { canonical: '/geo-ai-search' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="GEO / AI Search"
      title="Be visible where AI answers questions"
      lead="Generative engine optimization (GEO) checks how AI assistants describe your brand and which sources they cite, then suggests changes to improve your presence."
      primary={{ label: "Check your AI visibility", href: "/signup" }}
      secondary={{ label: "See pricing", href: "/pricing" }}
      facts={{ title: "What you can measure", items: ["Whether your brand is mentioned for the questions you track", "Which sources and pages are cited", "How competitors appear for the same prompts", "Changes over time, from your own tracked checks"] }}
      cta={{ title: "Start tracking AI visibility", text: "Create a free account and run your first GEO check." }}
      features={[
        { icon: <Bot size={24} />, title: "AI answer checks", text: "Run prompts that matter to your business and record the answers." },
        { icon: <Eye size={24} />, title: "Brand visibility", text: "See when and how your brand is mentioned." },
        { icon: <Link2 size={24} />, title: "Citations & sources", text: "Find the pages AI engines rely on." },
        { icon: <Users size={24} />, title: "Competitor view", text: "Compare visibility with the competitors you choose." },
        { icon: <MessageSquareText size={24} />, title: "Content recommendations", text: "Get suggestions for clearer, citable content." },
        { icon: <Sparkles size={24} />, title: "History", text: "Track how visibility changes between checks." },
      ]}
      steps={[
        { title: "Add prompts", text: "Enter the questions customers ask." },
        { title: "Run checks", text: "We query supported AI engines." },
        { title: "Review results", text: "See mentions, citations and gaps." },
        { title: "Improve content", text: "Apply recommendations and re-check." },
      ]}
      related={[
        { label: "On-Page SEO Audit", href: "/seo-audit" },
        { label: "SEO Editor", href: "/seo-editor" },
        { label: "Content Audit", href: "/content-audit" },
        { label: "Website Value Calculator", href: "/website-value" },
      ]}
    />
  );
}
