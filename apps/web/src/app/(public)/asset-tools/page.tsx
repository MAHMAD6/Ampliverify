import type { Metadata } from 'next';
import { BadgeCheck, Briefcase, Calculator, ClipboardCheck, LineChart, TrendingUp } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "Asset Tools", description: "Manage websites and online businesses as digital assets: verify ownership, estimate value, analyse acquisitions and track performance.", alternates: { canonical: '/asset-tools' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="Asset Tools"
      title="Treat your websites like the assets they are"
      lead="Keep a portfolio of the websites you own or manage, verify ownership, estimate value with evidence and plan improvements that make each asset worth more."
      primary={{ label: "Start your portfolio", href: "/signup" }}
      secondary={{ label: "Free website valuation", href: "/website-value" }}
      facts={{ title: "Built on evidence", items: ["Ownership is verified, never assumed from an analysis or payment", "Valuations show their evidence, confidence and limitations", "Self-reported financials are always labelled", "The free valuation and free detailed report stay free"] }}
      cta={{ title: "Build your digital asset portfolio", text: "Create a free account and add your first website." }}
      features={[
        { icon: <Briefcase size={24} />, title: "Asset portfolio", text: "Every website and online business in one place." },
        { icon: <BadgeCheck size={24} />, title: "Ownership verification", text: "Verify with a DNS record, meta tag, file or documents." },
        { icon: <Calculator size={24} />, title: "Valuation", text: "Evidence-based value ranges with confidence grades." },
        { icon: <ClipboardCheck size={24} />, title: "Acquisition analysis", text: "Check a site before you make an offer." },
        { icon: <TrendingUp size={24} />, title: "Improvement plans", text: "Link SEO projects and track tasks per asset." },
        { icon: <LineChart size={24} />, title: "Performance", text: "Follow value and earnings over time." },
      ]}
      steps={[
        { title: "Add assets", text: "List the sites you own, manage or are considering." },
        { title: "Verify", text: "Prove ownership for the sites you control." },
        { title: "Value", text: "Run evidence-based valuations." },
        { title: "Grow", text: "Improve, track and, when ready, sell on the Marketplace." },
      ]}
      related={[
        { label: "Asset Overview", href: "/asset-tools/asset-overview" },
        { label: "Website Value Calculator", href: "/website-value" },
        { label: "Acquisition Analysis", href: "/asset-tools/acquisition-analysis" },
        { label: "Asset Optimization", href: "/asset-tools/asset-optimization" },
        { label: "Valuation & Performance", href: "/asset-tools/valuation-performance" },
        { label: "Marketplace", href: "/marketplace" },
      ]}
    />
  );
}
