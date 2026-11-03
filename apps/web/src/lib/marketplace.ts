import { formatMoney } from './format';

export type AssetType = 'WEBSITE' | 'DOMAIN' | 'CONTENT_SITE' | 'ECOMMERCE' | 'SAAS' | 'APP' | 'OTHER';
export type ListingStatus = 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'WITHDRAWN' | 'SOLD';

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'CONTENT_SITE', label: 'Content site / blog' },
  { value: 'ECOMMERCE', label: 'E-commerce store' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'APP', label: 'App' },
  { value: 'DOMAIN', label: 'Domain name' },
  { value: 'OTHER', label: 'Other digital asset' },
];
export const assetLabel = (t: string) => ASSET_TYPES.find((a) => a.value === t)?.label ?? t;

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone?: 'blue' | 'green' | 'amber' }> = {
  PENDING_REVIEW: { label: 'In review', tone: 'amber' },
  PUBLISHED: { label: 'Live', tone: 'green' },
  REJECTED: { label: 'Needs changes', tone: 'amber' },
  WITHDRAWN: { label: 'Withdrawn' },
  SOLD: { label: 'Sold', tone: 'blue' },
};

export type PublicListing = {
  id: string;
  title: string;
  assetType: AssetType;
  url: string | null;
  summary: string;
  askingPriceMinor: number;
  currency: string;
  monthlyRevenueMinor: number | null;
  monthlyVisitors: number | null;
  publishedAt: string | null;
};
export type OwnListing = PublicListing & { status: ListingStatus; reviewNote: string | null; createdAt: string; updatedAt: string; inquiries?: number };
export type ListingDetail = PublicListing & { description: string; own: boolean; status?: ListingStatus; reviewNote?: string | null; myInquiry: Inquiry | null };
export type Inquiry = { id: string; listing?: { id: string; title: string; status: ListingStatus }; message: string; reply: string | null; repliedAt: string | null; status: 'OPEN' | 'REPLIED' | 'CLOSED'; createdAt: string; from?: string };
export type MarketTransaction = { id: string; listing: { id: string; title: string }; role: 'BUYER' | 'SELLER'; amountMinor: number; currency: string; status: string; completedAt: string | null; createdAt: string };
export type MarketSummary = {
  marketplace: { publishedListings: number };
  seller: { listings: number; byStatus: Partial<Record<ListingStatus, number>>; openInquiries: number; completedSales: number; earnings: { currency: string; amountMinor: number }[]; payoutThresholdMinor: number; payoutsAvailable: boolean };
  buyer: { inquiriesSent: number; purchases: number };
};

export const money = (minor: number | null | undefined, currency: string) => (minor === null || minor === undefined ? '—' : formatMoney(String(minor), currency));
