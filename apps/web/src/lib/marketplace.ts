import { formatMoney } from './format';

/** Shapes returned by the Marketplace API (apps/api/src/marketplace; V2 guide §1–§3). */

export type AssetType = 'WEBSITE' | 'DOMAIN' | 'CONTENT_SITE' | 'ECOMMERCE' | 'SAAS' | 'APP' | 'OTHER';
export type ListingKind = 'BUSINESS' | 'DIGITAL_PRODUCT';
export type ListingStatus = 'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'PUBLISHED' | 'REJECTED' | 'WITHDRAWN' | 'SOLD';
export type UrlVisibility = 'PUBLIC' | 'AFTER_INTRODUCTION' | 'AFTER_DILIGENCE';
export type CheckStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type Tone = 'blue' | 'green' | 'amber' | undefined;

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

export const LISTING_KINDS: { value: ListingKind; label: string; hint: string }[] = [
  { value: 'BUSINESS', label: 'Website or online business', hint: 'Sold through introductions, offers, due diligence and a tracked transfer.' },
  { value: 'DIGITAL_PRODUCT', label: 'Digital product', hint: 'Templates, eBooks, plugins or media bought at a fixed price and downloaded securely.' },
];
export const kindLabel = (k: string) => (k === 'DIGITAL_PRODUCT' ? 'Digital product' : 'Business acquisition');

export const CATEGORIES = ['SaaS Businesses', 'AI Apps', 'eCommerce Businesses', 'Content Websites', 'Mobile Apps', 'Lead Generation', 'Online Courses', 'Agencies', 'Templates & Themes', 'eBooks & Guides', 'Plugins & Scripts', 'Graphics & Media', 'Other'];
export const STAGES = ['Idea', 'Pre-revenue', 'Early revenue', 'Profitable', 'Established'];

export const URL_VISIBILITY: { value: UrlVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Show the website address publicly' },
  { value: 'AFTER_INTRODUCTION', label: 'Show after I accept an introduction' },
  { value: 'AFTER_DILIGENCE', label: 'Show only during due diligence' },
];

type Label = { label: string; tone?: Tone };
const lbl = (label: string, tone?: Tone): Label => ({ label, tone });

export const LISTING_STATUS: Record<ListingStatus, Label> = {
  DRAFT: lbl('Draft'),
  PENDING_REVIEW: lbl('In review', 'amber'),
  CHANGES_REQUESTED: lbl('Changes requested', 'amber'),
  PUBLISHED: lbl('Live', 'green'),
  REJECTED: lbl('Not approved', 'amber'),
  WITHDRAWN: lbl('Withdrawn'),
  SOLD: lbl('Sold', 'blue'),
};
export const ORDER_STATUS: Record<string, Label> = {
  PENDING_PAYMENT: lbl('Awaiting payment', 'amber'),
  PAID: lbl('Paid', 'green'),
  FAILED: lbl('Payment failed', 'amber'),
  CANCELED: lbl('Canceled'),
  REFUNDED: lbl('Refunded', 'blue'),
  PARTIALLY_REFUNDED: lbl('Partially refunded', 'blue'),
};
export const DEAL_STATUS: Record<string, Label> = {
  PENDING: lbl('Pending', 'amber'),
  AGREEMENT_PENDING: lbl('Agreement pending', 'amber'),
  DUE_DILIGENCE: lbl('Due diligence', 'blue'),
  TRANSFER_IN_PROGRESS: lbl('Transfer in progress', 'blue'),
  IN_ESCROW: lbl('In escrow', 'blue'),
  COMPLETED: lbl('Completed', 'green'),
  CANCELED: lbl('Canceled'),
  REFUNDED: lbl('Refunded'),
};
export const OFFER_STATUS: Record<string, Label> = {
  SUBMITTED: lbl('Submitted', 'amber'),
  COUNTERED: lbl('Countered', 'blue'),
  ACCEPTED: lbl('Accepted', 'green'),
  DECLINED: lbl('Declined'),
  WITHDRAWN: lbl('Withdrawn'),
};
export const INTRO_STATUS: Record<string, Label> = {
  PENDING: lbl('Awaiting seller', 'amber'),
  APPROVED: lbl('Introduction accepted', 'green'),
  DECLINED: lbl('Declined'),
};
export const INQUIRY_STATUS: Record<string, Label> = { OPEN: lbl('Open', 'amber'), REPLIED: lbl('Replied', 'green'), CLOSED: lbl('Closed') };
export const CASE_STATUS: Record<string, Label> = {
  OPEN: lbl('Open', 'amber'),
  UNDER_REVIEW: lbl('Under review', 'blue'),
  APPROVED: lbl('Approved', 'green'),
  DENIED: lbl('Declined'),
  REFUNDED: lbl('Refunded', 'green'),
  CLOSED: lbl('Closed'),
};
export const CHECK_STATUS: Record<string, Label> = { NOT_STARTED: lbl('Not started'), PENDING: lbl('In review', 'amber'), APPROVED: lbl('Approved', 'green'), REJECTED: lbl('Not approved', 'amber') };
export const PAYOUT_STATUS: Record<string, Label> = {
  REQUESTED: lbl('Requested', 'amber'),
  APPROVED: lbl('Approved', 'blue'),
  PROCESSING: lbl('Processing', 'blue'),
  PAID: lbl('Paid', 'green'),
  FAILED: lbl('Failed', 'amber'),
  CANCELED: lbl('Canceled'),
};
export const SELLER_STATUS: Record<string, Label> = { ONBOARDING: lbl('Onboarding', 'amber'), ACTIVE: lbl('Active', 'green'), SUSPENDED: lbl('Suspended', 'amber') };
export const LEDGER_TYPE: Record<string, string> = { SALE: 'Sale', PLATFORM_FEE: 'Platform fee', REFUND: 'Refund', PAYOUT: 'Payout', PAYOUT_REVERSAL: 'Payout reversal', ADJUSTMENT: 'Adjustment' };
export const CHECK_KIND: Record<string, string> = { IDENTITY: 'Identity', BUSINESS: 'Business', PAYOUT: 'Payout account', OWNERSHIP: 'Ownership', TRAFFIC: 'Traffic', FINANCIAL: 'Financials', AI_SCREENING: 'AI screening' };

export const statusOf = (map: Record<string, Label>, key: string | null | undefined): Label => (key && map[key]) || { label: key ? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ') : '—' };

export type ListingCard = {
  id: string;
  slug: string | null;
  kind: ListingKind;
  title: string;
  assetType: AssetType;
  category: string | null;
  stage: string | null;
  summary: string;
  askingPriceMinor: number;
  currency: string;
  monthlyRevenueMinor: number | null;
  monthlyVisitors: number | null;
  aiGenerated: boolean;
  publishedAt: string | null;
  cover?: string | null;
  seller?: { id: string; displayName: string; identityVerified: boolean } | null;
  saved?: boolean;
};
export type BrowsePage = { items: ListingCard[]; total: number; page: number; pageSize: number };

export type PublicSeller = {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  memberSince: string;
  checks: { identity: boolean; business: boolean };
  liveListings: number;
  soldListings: number;
};

export type ListingDetail = ListingCard & {
  url: string | null;
  urlHidden: boolean;
  description: string;
  location: string | null;
  language: string | null;
  licenseTerms: string | null;
  aiDisclosure: string | null;
  highlights: string[];
  media: { id: string; url: string; contentType: string; filename: string }[];
  deliverables: { filename: string; sizeBytes: number; contentType: string }[];
  seller: PublicSeller | null;
  own: boolean;
  status?: ListingStatus;
  reviewNote?: string | null;
  viewCount?: number;
  viewer: {
    saved: boolean;
    inquiry: { id: string; status: string; introStatus: string } | null;
    purchasedOrderId: string | null;
    offer: { id: string; status: string } | null;
  } | null;
};

export type OwnListing = ListingCard & {
  url: string | null;
  urlVisibility: UrlVisibility;
  status: ListingStatus;
  reviewNote: string | null;
  viewCount: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inquiries?: number;
  offers?: number;
  saves?: number;
  files?: number;
};
export type ListingFile = { id: string; role: 'MEDIA' | 'DELIVERABLE'; filename: string; contentType: string; sizeBytes: number; createdAt: string };
export type MyListingDetail = Omit<OwnListing, 'files'> & {
  description: string;
  location: string | null;
  language: string | null;
  licenseTerms: string | null;
  aiDisclosure: string | null;
  highlights: string[];
  files: ListingFile[];
  analytics: { views: number; saves: number; inquiries: number; offers: number; sales: number };
};

export type InquiryRow = {
  id: string;
  listing: { id: string; title: string; status: ListingStatus; kind: ListingKind };
  message: string;
  reply: string | null;
  status: 'OPEN' | 'REPLIED' | 'CLOSED';
  introStatus: 'PENDING' | 'APPROVED' | 'DECLINED';
  buyerRole: string | null;
  budget: string | null;
  messages: number;
  createdAt: string;
  updatedAt: string;
  from?: string;
};
export type Thread = {
  id: string;
  role: 'BUYER' | 'SELLER';
  listing: { id: string; title: string; kind: ListingKind; status: ListingStatus; askingPriceMinor: number; currency: string };
  counterpart: string;
  message: string;
  buyerRole: string | null;
  budget: string | null;
  status: string;
  introStatus: string;
  canMessage: boolean;
  createdAt: string;
  offers: { id: string; status: string; amountMinor: number; currency: string; version: number }[];
  messages: { id: string; mine: boolean; body: string; createdAt: string; readAt: string | null }[];
};
export type Conversation = { id: string; listing: { id: string; title: string }; role: 'BUYER' | 'SELLER'; counterpart: string; status: string; lastMessage: { body: string; createdAt: string; mine: boolean } | null; unread: number; updatedAt: string };

export type Offer = {
  id: string;
  role: 'BUYER' | 'SELLER';
  listing: { id: string; title: string };
  status: string;
  version: number;
  amountMinor: number;
  currency: string;
  terms: string | null;
  awaitingMe: boolean;
  inquiryId: string;
  transaction: { id: string; status: string } | null;
  history: { version: number; action: string; amountMinor: number; terms: string | null; byMe: boolean; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
};
export type Deal = {
  id: string;
  kind: 'ACQUISITION';
  listing: { id: string; title: string };
  role: 'BUYER' | 'SELLER';
  amountMinor: number;
  currency: string;
  status: string;
  buyerAgreedAt: string | null;
  sellerAgreedAt: string | null;
  transferStartedAt: string | null;
  buyerConfirmedAt: string | null;
  completedAt: string | null;
  notes: { by: 'BUYER' | 'SELLER'; text: string; at: string }[];
  createdAt: string;
  updatedAt: string;
  cases?: { id: string; kind: string; status: string; reason: string; createdAt: string }[];
};
export type Order = { id: string; kind: 'DIGITAL_PRODUCT'; listing: { id: string; title: string; slug: string | null }; amountMinor: number; refundedMinor: number; currency: string; status: string; paidAt: string | null; createdAt: string; platformFeeMinor?: number };
export type OrderDetail = Order & {
  licenseTerms: string | null;
  licenseAcceptedAt: string | null;
  withdrawalConsentAt: string | null;
  downloads: { id: string; filename: string; sizeBytes: number; status: string }[];
  cases: { id: string; kind: string; status: string; reason: string; createdAt: string; decisionNote: string | null }[];
  reportingGuidelineUntil: string | null;
};
export type Download = { id: string; filename: string; sizeBytes: number; contentType: string; listing: { id: string; title: string }; orderId: string; state: 'AVAILABLE' | 'REVOKED' | 'UNAVAILABLE'; downloads: number; createdAt: string };
export type TransactionRow = { id: string; kind: 'DIGITAL_PRODUCT' | 'ACQUISITION'; listing: { id: string; title: string }; role: 'BUYER' | 'SELLER'; amountMinor: number; currency: string; status: string; createdAt: string };
export type Case = { id: string; kind: string; orderId: string | null; transactionId: string | null; reason: string; details: string; status: string; requestedAmountMinor: number | null; approvedAmountMinor: number | null; decisionNote: string | null; decidedAt: string | null; createdAt: string };

export type SellerProfile = {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  status: 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  checks: { identity: CheckStatus; business: CheckStatus; payout: CheckStatus };
  payoutsEnabled: boolean;
  payoutAccountConnected: boolean;
  verifications: { id: string; kind: string; status: string; listingId: string | null; decisionNote: string | null; files: string[]; createdAt: string; reviewedAt: string | null }[];
  createdAt: string;
};

export type Balance = {
  balances: { currency: string; grossSalesMinor: number; feesMinor: number; refundsMinor: number; paidOutMinor: number; adjustmentsMinor: number; pendingMinor: number; availableMinor: number; balanceMinor: number }[];
  payoutThresholdMinor: number;
  payoutsEnabled: boolean;
  openPayout: { id: string; status: string; amountMinor: number; currency: string } | null;
  canRequestPayout: boolean;
};
export type LedgerRow = { id: string; type: string; amountMinor: number; currency: string; memo: string | null; orderId: string | null; payoutId: string | null; listing: string | null; availableAt: string | null; createdAt: string };
export type Statement = { month: string; currency: string; salesMinor: number; feesMinor: number; refundsMinor: number; payoutsMinor: number; adjustmentsMinor: number };
export type Payout = { id: string; amountMinor: number; currency: string; status: string; failureReason: string | null; providerTransferId: string | null; approvedAt: string | null; paidAt: string | null; createdAt: string; entries?: { type: string; amountMinor: number; createdAt: string }[] };

export type MarketSummary = {
  marketplace: { publishedListings: number };
  buyer: { saved: number; activeInquiries: number; activeOffers: number; purchases: number; downloads: number; activeTransactions: number; unreadMessages: number };
  seller: {
    enabled: boolean;
    status: string | null;
    verification: { identity: CheckStatus; business: CheckStatus; payout: CheckStatus } | null;
    listings: number;
    byStatus: Partial<Record<ListingStatus, number>>;
    listingViews: number;
    pendingIntroductions: number;
    activeOffers: number;
    payoutThresholdMinor: number;
  };
};
export type MarketMeta = { categories: string[]; terms: { commissionBps: number; holdDays: number; reportingWindowDays: number; checkoutEnabled: boolean; payoutThresholdMinor: number; paymentsConfigured: boolean; payoutCountries?: string[] } };

export const money = (minor: number | null | undefined, currency: string) => (minor === null || minor === undefined ? '—' : formatMoney(String(minor), currency));
export const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** API media paths (`/marketplace/media/<id>`) are served to the browser through the web proxy. */
export function mediaSrc(url: string | null | undefined) {
  const id = url?.match(/media\/([0-9a-f-]{36})$/i)?.[1];
  return id ? `/api/market-media/${id}` : null;
}

export const listingHref = (l: { id: string; slug?: string | null }) => `/buyer/listings/${l.id}`;
export const publicListingHref = (l: { id: string; slug?: string | null }) => `/marketplace/listings/${l.slug ?? l.id}`;
