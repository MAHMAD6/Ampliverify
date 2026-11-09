import type { Metadata } from 'next';
import { BadgeCheck, Briefcase, FolderKanban, ShieldCheck, Tags, Wallet } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Asset Overview", description: "One place for every website you own or manage, with verification status, value range, financials and linked projects.", alternates: { canonical: '/asset-tools/asset-overview' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Asset Overview"
      title="Your whole portfolio at a glance"
      lead="See each asset with its relationship to you, ownership status, latest valuation, recorded financials and linked SEO project."
      primary={{ label: "Add your first asset", href: "/signup" }}
      secondary={{ label: "Asset Tools", href: "/asset-tools" }}
      facts={{ title: "Clear labels, no guesswork", items: ["Owned, managed, authorized and prospective assets kept apart", "Verified ownership shown only after a successful check", "Values only from completed valuations", "Empty states until you add real data"] }}
      cta={{ title: "Organize your digital assets", text: "Create a free account and build your portfolio." }}
      features={[
        { icon: <Briefcase size={24} />, title: "Portfolio view", text: "Filter by relationship, search and archive." },
        { icon: <ShieldCheck size={24} />, title: "Ownership status", text: "See which assets are verified." },
        { icon: <Wallet size={24} />, title: "Financials", text: "Record monthly revenue and costs." },
        { icon: <Tags size={24} />, title: "Categories", text: "Organize assets by type and niche." },
        { icon: <FolderKanban size={24} />, title: "Linked projects", text: "Connect assets to SEO projects." },
        { icon: <BadgeCheck size={24} />, title: "Evidence history", text: "Keep a record of every verification check." },
      ]}
      steps={[
        { title: "Add an asset", text: "Enter its name, website and your relationship." },
        { title: "Verify ownership", text: "Choose a verification method." },
        { title: "Record data", text: "Add financials and link a project." },
        { title: "Review", text: "Track everything from the dashboard." },
      ]}
      related={[
        { label: "Asset Tools Overview", href: "/asset-tools" },
        { label: "Website Value Calculator", href: "/website-value" },
        { label: "Acquisition Analysis", href: "/asset-tools/acquisition-analysis" },
        { label: "Asset Optimization", href: "/asset-tools/asset-optimization" },
        { label: "Valuation & Performance", href: "/asset-tools/valuation-performance" },
        { label: "Marketplace", href: "/marketplace" },
      ]}
    />
  );
}
