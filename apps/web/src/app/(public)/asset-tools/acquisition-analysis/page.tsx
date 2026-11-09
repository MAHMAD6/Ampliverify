import type { Metadata } from 'next';
import { AlertTriangle, ClipboardCheck, Gauge, Globe, Scale, Search } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Acquisition Analysis", description: "Analyse a website before you buy it: SEO health, traffic signals, technical quality and an evidence-based value range.", alternates: { canonical: '/asset-tools/acquisition-analysis' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Acquisition Analysis"
      title="Look before you buy"
      lead="Run an independent analysis of any public website and compare its estimated value range with the asking price before you make an offer."
      primary={{ label: "Analyze a website", href: "/signup" }}
      secondary={{ label: "Browse the Marketplace", href: "/marketplace/listings" }}
      facts={{ title: "What the analysis is (and is not)", items: ["Built from public data and our data providers", "Shows confidence and limitations for every estimate", "Not an appraisal; verify financials during due diligence", "Analysing a site never marks it as owned"] }}
      cta={{ title: "Make better acquisition decisions", text: "Create a free account and run your first acquisition analysis." }}
      features={[
        { icon: <Search size={24} />, title: "SEO health", text: "On-page and technical checks of the public site." },
        { icon: <Globe size={24} />, title: "Domain profile", text: "Domain age, records and search visibility signals." },
        { icon: <Gauge size={24} />, title: "Technical quality", text: "Performance and accessibility signals." },
        { icon: <Scale size={24} />, title: "Price comparison", text: "See whether the asking price is within the estimated range." },
        { icon: <AlertTriangle size={24} />, title: "Risks", text: "Limitations and risks highlighted." },
        { icon: <ClipboardCheck size={24} />, title: "Save as prospect", text: "Track candidate acquisitions in your portfolio." },
      ]}
      steps={[
        { title: "Enter a URL", text: "Add the site and optional asking price." },
        { title: "Choose checks", text: "SEO, traffic, technical, content, domain, valuation." },
        { title: "Review evidence", text: "See scores, ranges and limitations." },
        { title: "Decide", text: "Save as a prospect or move on." },
      ]}
      related={[
        { label: "Asset Tools Overview", href: "/asset-tools" },
        { label: "Asset Overview", href: "/asset-tools/asset-overview" },
        { label: "Website Value Calculator", href: "/website-value" },
        { label: "Asset Optimization", href: "/asset-tools/asset-optimization" },
        { label: "Valuation & Performance", href: "/asset-tools/valuation-performance" },
        { label: "Marketplace", href: "/marketplace" },
      ]}
    />
  );
}
