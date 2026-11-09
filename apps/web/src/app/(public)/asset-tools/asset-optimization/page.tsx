import type { Metadata } from 'next';
import { CheckCircle2, FolderKanban, ListTodo, Search, Target, TrendingUp } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Asset Optimization", description: "Plan improvements that add value to your websites, using SEO audits, tasks and tracked progress for each asset.", alternates: { canonical: '/asset-tools/asset-optimization' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Asset Optimization"
      title="Improve the assets you own"
      lead="Link each asset to an SEO project, turn audit findings into tasks and track the work that makes the asset stronger."
      primary={{ label: "Start improving", href: "/signup" }}
      secondary={{ label: "On-Page SEO Audit", href: "/seo-audit" }}
      facts={{ title: "Grounded in real work", items: ["Tasks come from your audits, not generic checklists", "Progress reflects tasks you complete", "Value changes only from completed valuations", "Prepare an asset for sale when you are ready"] }}
      cta={{ title: "Make every asset worth more", text: "Create a free account and link your first project." }}
      features={[
        { icon: <FolderKanban size={24} />, title: "Linked projects", text: "Each asset can have its own SEO project." },
        { icon: <Search size={24} />, title: "Audits", text: "Find issues on the asset\u2019s site." },
        { icon: <ListTodo size={24} />, title: "Tasks", text: "Prioritized tasks from findings." },
        { icon: <Target size={24} />, title: "Goals", text: "Focus on what moves value." },
        { icon: <CheckCircle2 size={24} />, title: "Verification", text: "Re-audit to confirm fixes." },
        { icon: <TrendingUp size={24} />, title: "Progress", text: "See open, in-progress and done work per asset." },
      ]}
      steps={[
        { title: "Link a project", text: "Connect the asset to an SEO project." },
        { title: "Audit", text: "Run an on-page audit." },
        { title: "Work the plan", text: "Complete prioritized tasks." },
        { title: "Re-value", text: "Run a new valuation to see the effect." },
      ]}
      related={[
        { label: "Asset Tools Overview", href: "/asset-tools" },
        { label: "Asset Overview", href: "/asset-tools/asset-overview" },
        { label: "Website Value Calculator", href: "/website-value" },
        { label: "Acquisition Analysis", href: "/asset-tools/acquisition-analysis" },
        { label: "Valuation & Performance", href: "/asset-tools/valuation-performance" },
        { label: "Marketplace", href: "/marketplace" },
      ]}
    />
  );
}
