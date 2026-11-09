import type { Metadata } from 'next';
import { FileWarning, Gauge, ListChecks, Search, ShieldCheck, Workflow } from 'lucide-react';
import { ToolPage } from '@/components/public/ToolPage';

export const metadata: Metadata = { title: "On-Page SEO Audit", description: "Crawl your website and get a prioritized list of technical and on-page SEO issues, with clear explanations and fixes.", alternates: { canonical: '/seo-audit' } };

export default function Page() {
  return (
    <ToolPage
      eyebrow="On-Page SEO Audit"
      title="Find what holds your pages back"
      lead="AmpliVerify crawls your site and checks each page for technical, on-page and content issues, then ranks them by impact so you know what to fix first."
      primary={{ label: "Run your first audit", href: "/signup" }}
      secondary={{ label: "See pricing", href: "/pricing" }}
      facts={{ title: "What every audit includes", items: ["Page-by-page findings from your real site, never sample data", "Severity and impact for each issue", "Plain-language explanations and recommended fixes", "Re-crawl to verify that fixes worked"] }}
      cta={{ title: "Start with a free account", text: "Create an account, add your website and run an audit in minutes." }}
      features={[
        { icon: <Search size={24} />, title: "Full-site crawl", text: "Checks titles, descriptions, headings, links, images, indexability and more on every crawled page." },
        { icon: <Gauge size={24} />, title: "Performance signals", text: "Highlights speed and Core Web Vitals problems that affect rankings and users." },
        { icon: <FileWarning size={24} />, title: "Prioritized issues", text: "Issues are grouped and ranked by severity so the biggest wins come first." },
        { icon: <ListChecks size={24} />, title: "Actionable fixes", text: "Each finding explains why it matters and how to resolve it." },
        { icon: <Workflow size={24} />, title: "Tasks & tracking", text: "Turn findings into tasks in the Optimization Center and track progress." },
        { icon: <ShieldCheck size={24} />, title: "Verify results", text: "Re-audit after changes to confirm what improved." },
      ]}
      steps={[
        { title: "Add your site", text: "Create a project and enter your domain." },
        { title: "Run the audit", text: "We crawl the site and analyse each page." },
        { title: "Review findings", text: "Work through issues ranked by impact." },
        { title: "Fix and verify", text: "Apply fixes, then re-crawl to confirm." },
      ]}
      related={[
        { label: "SEO Editor", href: "/seo-editor" },
        { label: "GEO / AI Search", href: "/geo-ai-search" },
        { label: "Content Audit", href: "/content-audit" },
        { label: "Website Value Calculator", href: "/website-value" },
      ]}
    />
  );
}
