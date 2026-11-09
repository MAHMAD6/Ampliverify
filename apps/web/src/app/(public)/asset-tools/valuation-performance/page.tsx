import type { Metadata } from 'next';
import { BarChart3, Calculator, FileBarChart, History, LineChart, Wallet } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Valuation & Performance", description: "Track how each website\u2019s estimated value and recorded earnings change over time, with evidence and confidence for every estimate.", alternates: { canonical: '/asset-tools/valuation-performance' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Valuation & Performance"
      title="Follow the value of your websites"
      lead="Compare valuations over time and review recorded revenue, costs and profit for each asset in one report."
      primary={{ label: "Track your assets", href: "/signup" }}
      secondary={{ label: "Free website valuation", href: "/website-value" }}
      facts={{ title: "Honest numbers", items: ["Valuation ranges with methodology and confidence", "Financials labelled self-reported unless verified", "Changes shown only between real completed valuations", "No projections presented as results"] }}
      cta={{ title: "See how your assets perform", text: "Create a free account and run your first valuation." }}
      features={[
        { icon: <Calculator size={24} />, title: "Valuations", text: "Evidence-based value ranges." },
        { icon: <History size={24} />, title: "History", text: "Every valuation kept for comparison." },
        { icon: <LineChart size={24} />, title: "Value change", text: "See movement between valuations." },
        { icon: <Wallet size={24} />, title: "Earnings", text: "Revenue, costs and profit from recorded months." },
        { icon: <BarChart3 size={24} />, title: "Portfolio totals", text: "Totals across valued assets." },
        { icon: <FileBarChart size={24} />, title: "Reports", text: "Share reports with partners or buyers." },
      ]}
      steps={[
        { title: "Value", text: "Run a valuation for an asset." },
        { title: "Record", text: "Add monthly financials." },
        { title: "Compare", text: "Re-value after improvements." },
        { title: "Report", text: "Share the results." },
      ]}
      related={[
        { label: "Asset Tools Overview", href: "/asset-tools" },
        { label: "Asset Overview", href: "/asset-tools/asset-overview" },
        { label: "Website Value Calculator", href: "/website-value" },
        { label: "Acquisition Analysis", href: "/asset-tools/acquisition-analysis" },
        { label: "Asset Optimization", href: "/asset-tools/asset-optimization" },
        { label: "Marketplace", href: "/marketplace" },
      ]}
    />
  );
}
