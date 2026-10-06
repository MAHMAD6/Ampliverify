'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  FileSearch,
  FileText,
  Flag,
  Folder,
  Globe,
  LineChart,
  Link2,
  List,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconCircle, PageHeader, Panel, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { REPORT_TYPES, type Report } from './meta';
import r from './report.module.css';

const TABS = ['Overview', 'SEO Audit', 'Keyword Opportunities', 'Content Recommendations', 'AI Search (GEO)', 'Competitor Analysis', 'Technical SEO', 'Appendix'];
const CONTENTS: [string, React.ReactNode][] = [
  ['Executive Summary', <FileText key="a" size={18} />],
  ['Key Findings', <LineChart key="b" size={18} />],
  ['SEO Audit Results', <Search key="c" size={18} />],
  ['Keyword Opportunities', <Link2 key="d" size={18} />],
  ['Content Recommendations', <FileText key="e" size={18} />],
  ['AI Search (GEO) Insights', <Sparkles key="f" size={18} />],
  ['Competitor Analysis', <Users key="g" size={18} />],
  ['Technical SEO', <Settings key="h" size={18} />],
  ['Implementation Plan', <List key="i" size={18} />],
  ['Conclusion', <Flag key="j" size={18} />],
  ['Appendix', <Paperclip key="k" size={18} />],
];
const METRICS = [
  { icon: <Search size={22} />, tone: 'blue' as const, label: 'Total Keywords', bg: 'var(--blue-50)' },
  { icon: <BarChart3 size={22} />, tone: 'green' as const, label: 'Organic Traffic', bg: 'var(--green-50)' },
  { icon: <Trophy size={22} />, tone: 'purple' as const, label: 'Average Position', bg: 'var(--purple-50)' },
  { icon: <Star size={22} />, tone: 'amber' as const, label: 'AI Search Visibility', bg: 'var(--amber-50)' },
];

/**
 * Generated report view. Section payloads (report_sections) and files
 * (report_files) are not served by the API yet, so metrics, trend and
 * opportunities show their "once the report is generated" states, and
 * regenerate / share / download are disabled.
 */
export function ReportView({ report }: { report: Report }) {
  const [tab, setTab] = useState('Overview');
  const [section, setSection] = useState(CONTENTS[0][0]);
  const typeLabel = REPORT_TYPES.find(([v]) => v === report.type)?.[1] ?? 'Report';
  const facts: [React.ReactNode, string, string][] = [
    [<Globe key="d" size={20} />, 'Domain', report.domain ?? '—'],
    [<CalendarDays key="g" size={20} />, 'Generated', report.status === 'SUCCEEDED' ? formatDate(report.createdAt) : '—'],
    [<FileText key="p" size={20} />, 'Pages Analyzed', report.pagesAnalyzed?.toLocaleString('en-US') ?? '—'],
    [<Folder key="f" size={20} />, 'Project', report.projectName ?? '—'],
  ];

  return (
    <>
      <PageHeader
        title={report.title}
        crumbs={[{ label: 'Reports', href: '/app/reports' }, { label: 'My Reports', href: '/app/reports' }, { label: report.title }]}
        description={
          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge>{typeLabel}</Badge>
            Comprehensive analysis and optimization recommendations.
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={18} />} disabled title="Regeneration is not available yet">
              Regenerate Report
            </Button>
            <Button variant="outline" icon={<Share2 size={18} />} disabled title="Sharing is not available yet">
              Share
            </Button>
            <Button icon={<Download size={18} />} disabled title="The PDF is not available yet">
              Download PDF
            </Button>
            <Button variant="secondary" aria-label="More report actions" disabled>
              <MoreVertical size={18} />
            </Button>
          </>
        }
      />
      <div className={r.facts}>
        {facts.map(([icon, label, value]) => (
          <div key={label} className={r.fact}>
            <span style={{ color: 'var(--muted)' }}>{icon}</span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className={r.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? r.tabOn : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <span className={r.more}>
          More <ChevronDown size={16} />
        </span>
      </div>

      <div className={r.layout}>
        <nav className={r.contents} aria-label="Report contents">
          <h2>Report Contents</h2>
          {CONTENTS.map(([label, icon]) => (
            <button key={label} className={section === label ? r.contentOn : ''} onClick={() => setSection(label)} aria-current={section === label}>
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          {tab === 'Overview' ? (
            <>
              <Panel>
                <div className={r.overview}>
                  <div className={r.cover} aria-hidden>
                    <div className={r.coverBrand}>
                      <Image src="/brand/mark-transparent.png" alt="" width={22} height={22} /> <b>Ampli</b>
                      <b style={{ color: '#22a447' }}>Verify</b>
                    </div>
                    <strong>{typeLabel}</strong>
                    <span>Comprehensive analysis and recommendations</span>
                    <div className={r.wave} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className={r.kicker}>Report overview</span>
                    <h2 style={{ fontSize: 26 }}>{report.title}</h2>
                    <p style={{ color: 'var(--muted)', margin: '6px 0 14px' }}>Comprehensive SEO audit and optimization recommendations to improve search visibility, organic traffic, and AI search presence.</p>
                    <div className={r.factCards}>
                      {facts.map(([icon, label, value]) => (
                        <div key={label}>
                          <span style={{ color: 'var(--blue)', display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                            {icon} <span style={{ color: 'var(--heading)' }}>{label}</span>
                          </span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Key Metrics Summary"
                description="Your website's current performance at a glance."
                actions={
                  <Select disabled aria-label="Date range" style={{ width: 190 }}>
                    <option>Select date range</option>
                  </Select>
                }
                flushHead
              >
                <div className={r.metrics}>
                  {METRICS.map((m) => (
                    <div key={m.label} className={r.metric} style={{ background: m.bg }}>
                      <IconCircle tone={m.tone} size={44}>
                        {m.icon}
                      </IconCircle>
                      <div>
                        <span>{m.label}</span>
                        <strong>—</strong>
                        <small>Data will appear here once the report is generated.</small>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className={r.twoCol}>
                <Panel
                  title="Visibility Trend"
                  description="Track key performance metrics over time."
                  actions={
                    <Select disabled aria-label="Metric" style={{ width: 170 }}>
                      <option>Organic Keywords</option>
                    </Select>
                  }
                  flushHead
                >
                  <div className={r.chart}>
                    <EmptyState compact icon={<BarChart3 size={24} />} title="No data available yet" description="Data will appear here once the report is generated." />
                  </div>
                </Panel>
                <Panel title="Top Opportunities" description="Highest potential impact areas identified in this report." flushHead>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
                    <EmptyState compact icon={<FileSearch size={24} />} title="No opportunities available yet" description="Key opportunities will appear here once the report is generated." />
                  </div>
                </Panel>
              </div>
            </>
          ) : (
            <Panel title={tab}>
              <EmptyState icon={<FileText size={26} />} title={`No ${tab} data yet`} description="This section will be filled in once the report is generated." />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
