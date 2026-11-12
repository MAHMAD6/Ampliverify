import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceAssetType, MarketplaceCaseKind, MarketplaceListingKind, MarketplaceListingStatus, MarketplaceUrlVisibility, SellerCheckStatus, SellerLedgerType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { CommerceService, MarketTerms } from './commerce.service';
import { DealsService } from './deals.service';
import { LISTING_CATEGORIES, MarketplaceService } from './marketplace.service';

const MAX_MINOR = 100_000_000_000; // 1 billion in major units

class ListingDto {
  @IsOptional() @IsUUID() workspaceId?: string;
  @IsOptional() @IsEnum(MarketplaceListingKind) kind?: MarketplaceListingKind;
  @IsString() @MinLength(5) @MaxLength(120) title: string;
  @IsEnum(MarketplaceAssetType) assetType: MarketplaceAssetType;
  @IsOptional() @IsString() @MaxLength(60) category?: string | null;
  @IsOptional() @IsString() @MaxLength(40) stage?: string | null;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsOptional() @IsEnum(MarketplaceUrlVisibility) urlVisibility?: MarketplaceUrlVisibility;
  @IsOptional() @IsString() @MaxLength(80) location?: string | null;
  @IsOptional() @IsString() @MaxLength(40) language?: string | null;
  @IsString() @MinLength(20) @MaxLength(300) summary: string;
  @IsString() @MinLength(50) @MaxLength(10_000) description: string;
  @IsInt() @Min(100) @Max(MAX_MINOR) askingPriceMinor: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) monthlyRevenueMinor?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) monthlyVisitors?: number | null;
  @IsOptional() @IsBoolean() aiGenerated?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) aiDisclosure?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) licenseTerms?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(140, { each: true }) highlights?: string[] | null;
}

class UpdateListingDto {
  @IsOptional() @IsBoolean() withdraw?: boolean;
  @IsOptional() @IsEnum(MarketplaceListingKind) kind?: MarketplaceListingKind;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(120) title?: string;
  @IsOptional() @IsEnum(MarketplaceAssetType) assetType?: MarketplaceAssetType;
  @IsOptional() @IsString() @MaxLength(60) category?: string | null;
  @IsOptional() @IsString() @MaxLength(40) stage?: string | null;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsOptional() @IsEnum(MarketplaceUrlVisibility) urlVisibility?: MarketplaceUrlVisibility;
  @IsOptional() @IsString() @MaxLength(80) location?: string | null;
  @IsOptional() @IsString() @MaxLength(40) language?: string | null;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MinLength(50) @MaxLength(10_000) description?: string;
  @IsOptional() @IsInt() @Min(100) @Max(MAX_MINOR) askingPriceMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) monthlyRevenueMinor?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) monthlyVisitors?: number | null;
  @IsOptional() @IsBoolean() aiGenerated?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) aiDisclosure?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) licenseTerms?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(140, { each: true }) highlights?: string[] | null;
}

class InquiryDto {
  @IsOptional() @IsUUID() workspaceId?: string;
  @IsString() @MinLength(10) @MaxLength(4_000) message: string;
  @IsOptional() @IsString() @MaxLength(80) buyerRole?: string;
  @IsOptional() @IsString() @MaxLength(80) budget?: string;
}

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(4_000) message: string;
}

class IntroDecisionDto {
  @IsIn(['APPROVE', 'DECLINE']) decision: 'APPROVE' | 'DECLINE';
  @IsOptional() @IsString() @MaxLength(4_000) message?: string;
}

class SaveDto {
  @IsBoolean() saved: boolean;
}

class OfferDto {
  @IsInt() @Min(100) @Max(MAX_MINOR) amountMinor: number;
  @IsOptional() @IsString() @MaxLength(4_000) terms?: string;
}

class OfferMoveDto {
  @IsIn(['COUNTER', 'ACCEPT', 'DECLINE', 'WITHDRAW']) action: 'COUNTER' | 'ACCEPT' | 'DECLINE' | 'WITHDRAW';
  @IsInt() @Min(1) expectedVersion: number;
  @IsOptional() @IsInt() @Min(100) @Max(MAX_MINOR) amountMinor?: number;
  @IsOptional() @IsString() @MaxLength(4_000) terms?: string;
}

class DealMoveDto {
  @IsIn(['AGREE', 'START_TRANSFER', 'CONFIRM_RECEIPT', 'CANCEL', 'NOTE']) action: 'AGREE' | 'START_TRANSFER' | 'CONFIRM_RECEIPT' | 'CANCEL' | 'NOTE';
  @IsOptional() @IsString() @MaxLength(2_000) note?: string;
}

class SellerProfileDto {
  @IsString() @MinLength(2) @MaxLength(80) displayName: string;
  @IsOptional() @IsString() @MaxLength(140) headline?: string;
  @IsOptional() @IsString() @MaxLength(2_000) bio?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(80) location?: string;
}

class CheckoutDto {
  @IsBoolean() license: boolean;
  @IsBoolean() refundPolicy: boolean;
  @IsOptional() @IsBoolean() withdrawalWaiver?: boolean;
}

class PayoutAccountDto {
  /** ISO 3166-1 alpha-2 country of the seller's bank account. */
  @IsOptional() @IsString() @Length(2, 2) country?: string;
}

class CaseDto {
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsUUID() transactionId?: string;
  @IsIn(['REFUND', 'ISSUE']) kind: MarketplaceCaseKind;
  @IsString() @MinLength(3) @MaxLength(200) reason: string;
  @IsString() @MinLength(20) @MaxLength(5_000) details: string;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_MINOR) amountMinor?: number;
}

class ReviewDto {
  @IsIn(['APPROVE', 'REQUEST_CHANGES', 'REJECT'])
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1_000) note?: string;
}

class DecisionDto {
  @IsIn(['APPROVE', 'REJECT']) decision: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1_000) note?: string;
}

class SellerStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED';
  @IsString() @MinLength(3) @MaxLength(1_000) note: string;
}

class PayoutActionDto {
  @IsIn(['APPROVE', 'PROCESS', 'CANCEL']) action: 'APPROVE' | 'PROCESS' | 'CANCEL';
  @IsOptional() @IsString() @MaxLength(1_000) note?: string;
}

class CaseResolveDto {
  @IsIn(['REVIEW', 'APPROVE_REFUND', 'DENY', 'CLOSE']) decision: 'REVIEW' | 'APPROVE_REFUND' | 'DENY' | 'CLOSE';
  @IsOptional() @IsString() @MaxLength(2_000) note?: string;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_MINOR) amountMinor?: number;
}

class TermsDto implements Partial<MarketTerms> {
  @IsOptional() @IsInt() @Min(0) @Max(5000) commissionBps?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) holdDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) reportingWindowDays?: number;
  @IsOptional() @IsBoolean() checkoutEnabled?: boolean;
}

class AdjustDto {
  @IsUUID() sellerUserId: string;
  @IsInt() @Min(-MAX_MINOR) @Max(MAX_MINOR) amountMinor: number;
  @IsString() @Length(3, 3) currency: string;
  @IsString() @MinLength(3) @MaxLength(200) reason: string;
}

class BrowseQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(MarketplaceAssetType) type?: MarketplaceAssetType;
  @IsOptional() @IsEnum(MarketplaceListingKind) kind?: MarketplaceListingKind;
  @IsOptional() @IsIn(LISTING_CATEGORIES) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) sort?: 'newest' | 'price_asc' | 'price_desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

type Upload = { buffer: Buffer; originalname: string; size: number };

function sendFile(res: Response, f: { signedUrl?: string; body?: Buffer; filename?: string; contentType?: string }, inline = false) {
  res.setHeader('cache-control', 'private, no-store');
  if (f.signedUrl) return res.redirect(302, f.signedUrl);
  res.setHeader('content-type', f.contentType ?? 'application/octet-stream');
  res.setHeader('content-disposition', `${inline ? 'inline' : 'attachment'}; filename="${(f.filename ?? 'file').replace(/["\\\r\n]/g, '')}"`);
  res.setHeader('x-content-type-options', 'nosniff');
  return res.send(f.body);
}

const browseFilters = (q: BrowseQuery) => ({ q: q.q, assetType: q.type, kind: q.kind, category: q.category, minPrice: q.minPrice, maxPrice: q.maxPrice, sort: q.sort, page: q.page });

/** Public Marketplace reads: published listings and seller profiles only. */
@Public()
@Controller('public/marketplace')
export class MarketplacePublicController {
  constructor(
    private readonly market: MarketplaceService,
    private readonly commerce: CommerceService,
  ) {}

  @Get('listings')
  browse(@Query() q: BrowseQuery) {
    return this.market.browse(browseFilters(q));
  }

  @Get('listings/:slug')
  listing(@Param('slug') slug: string) {
    return this.market.listing(null, slug.slice(0, 100));
  }

  @Get('sellers/:id')
  seller(@Param('id', ParseUUIDPipe) id: string) {
    return this.market.sellerPage(id);
  }

  @Get('media/:id')
  async media(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    return sendFile(res, await this.market.mediaFile(id, null), true);
  }

  @Get('meta')
  async meta() {
    return { categories: LISTING_CATEGORIES, terms: await this.commerce.publicTerms() };
  }
}

@Controller('user/marketplace')
export class MarketplaceController {
  constructor(
    private readonly market: MarketplaceService,
    private readonly deals: DealsService,
    private readonly commerce: CommerceService,
  ) {}

  @Get('summary')
  summary(@CurrentActor() a: AuthenticatedActor) {
    return this.market.summary(a.userId);
  }

  // Browse
  @Get('listings')
  browse(@CurrentActor() a: AuthenticatedActor, @Query() q: BrowseQuery) {
    return this.market.browse(browseFilters(q), a.userId);
  }

  @Get('listings/:id')
  listing(@CurrentActor() a: AuthenticatedActor, @Param('id') id: string) {
    return this.market.listing(a.userId, id.slice(0, 100));
  }

  @Put('listings/:id/save')
  save(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDto) {
    return this.market.save(a.userId, id, dto.saved);
  }

  @Get('saved')
  saved(@CurrentActor() a: AuthenticatedActor) {
    return this.market.savedListings(a.userId);
  }

  // Selling
  @Get('seller')
  seller(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.sellerProfile(a.userId);
  }

  @Put('seller')
  upsertSeller(@CurrentActor() a: AuthenticatedActor, @Body() dto: SellerProfileDto) {
    return this.commerce.upsertSellerProfile(a.userId, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('seller/verifications/:kind')
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 15 * 1024 * 1024 } }))
  verify(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Body() body: Record<string, string>, @UploadedFiles() files: Upload[]) {
    const k = kind.toUpperCase();
    return this.commerce.submitVerification(a.userId, (k === 'BUSINESS' ? 'BUSINESS' : k === 'IDENTITY' ? 'IDENTITY' : 'OTHER') as never, body ?? {}, files ?? []);
  }

  @Post('seller/payout-account')
  payoutAccount(@CurrentActor() a: AuthenticatedActor, @Body() dto: PayoutAccountDto) {
    return this.commerce.payoutOnboarding(a.userId, dto.country ?? 'US');
  }

  @Post('seller/payout-account/refresh')
  refreshPayoutAccount(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.refreshPayoutAccount(a.userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('listings')
  create(@CurrentActor() a: AuthenticatedActor, @Body() dto: ListingDto) {
    return this.market.createListing(a.userId, dto);
  }

  @Get('my/listings')
  myListings(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.market.myListings(a.userId, status && status in MarketplaceListingStatus ? (status as MarketplaceListingStatus) : undefined);
  }

  @Get('my/listings/:id')
  myListing(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.myListing(a.userId, id);
  }

  @Patch('my/listings/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    const { withdraw, ...rest } = dto;
    return withdraw ? this.market.withdrawListing(a.userId, id) : this.market.updateListing(a.userId, id, rest);
  }

  @Post('my/listings/:id/submit')
  submit(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.submitListing(a.userId, id);
  }

  @Delete('my/listings/:id')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.deleteDraft(a.userId, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('my/listings/:id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body('role') role: string, @UploadedFile() file: Upload) {
    return this.market.uploadFile(a.userId, id, role, file);
  }

  @Delete('my/listings/:id/files/:fileId')
  removeFile(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.market.deleteFile(a.userId, id, fileId);
  }

  @Get('media/:id')
  async media(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    return sendFile(res, await this.market.mediaFile(id, a.userId), true);
  }

  // Introductions, inquiries, messages
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('listings/:id/inquiries')
  inquire(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InquiryDto) {
    return this.market.inquire(a.userId, id, dto);
  }

  @Get('my/inquiries')
  inquiries(@CurrentActor() a: AuthenticatedActor, @Query('role') role?: string) {
    return this.market.inquiries(a.userId, role === 'sent' ? 'sent' : 'received');
  }

  @Get('inquiries/:id')
  thread(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.thread(a.userId, id);
  }

  @Post('inquiries/:id/introduction')
  intro(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IntroDecisionDto) {
    return this.market.decideIntroduction(a.userId, id, dto.decision === 'APPROVE', dto.message);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('inquiries/:id/messages')
  message(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.market.sendMessage(a.userId, id, dto.message);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('inquiries/:id/reply')
  reply(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.market.reply(a.userId, id, dto.message);
  }

  @Post('inquiries/:id/close')
  close(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.closeInquiry(a.userId, id);
  }

  @Get('messages')
  conversations(@CurrentActor() a: AuthenticatedActor) {
    return this.market.conversations(a.userId);
  }

  // Offers and acquisition deals
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('listings/:id/offers')
  offer(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferDto) {
    return this.deals.createOffer(a.userId, id, dto);
  }

  @Get('my/offers')
  offers(@CurrentActor() a: AuthenticatedActor, @Query('role') role?: string) {
    return this.deals.offers(a.userId, role === 'seller' ? 'seller' : 'buyer');
  }

  @Get('offers/:id')
  offerDetail(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.offer(a.userId, id);
  }

  @Post('offers/:id')
  moveOffer(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferMoveDto) {
    if (dto.action === 'COUNTER') return this.deals.counter(a.userId, id, { expectedVersion: dto.expectedVersion, amountMinor: dto.amountMinor ?? 0, terms: dto.terms });
    if (dto.action === 'ACCEPT') return this.deals.accept(a.userId, id, dto.expectedVersion);
    return this.deals.decline(a.userId, id, dto.expectedVersion, dto.action === 'WITHDRAW');
  }

  @Get('my/deals')
  deals_(@CurrentActor() a: AuthenticatedActor, @Query('role') role?: string) {
    return this.deals.transactions(a.userId, role === 'buyer' ? 'buyer' : role === 'seller' ? 'seller' : 'all');
  }

  @Get('deals/:id')
  deal(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.transaction(a.userId, id);
  }

  @Post('deals/:id')
  moveDeal(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DealMoveDto) {
    return this.deals.advance(a.userId, id, dto.action, dto.note);
  }

  // Purchases, downloads, cases
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('listings/:id/checkout')
  checkout(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckoutDto) {
    return this.commerce.checkout(a.userId, id, { license: dto.license, refundPolicy: dto.refundPolicy, withdrawalWaiver: !!dto.withdrawalWaiver });
  }

  @Get('my/purchases')
  purchases(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.orders(a.userId);
  }

  @Get('orders/:id')
  order(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.commerce.order(a.userId, id);
  }

  @Get('my/downloads')
  downloads(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.downloads(a.userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('downloads/:id/file')
  async download(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
    return sendFile(res, await this.commerce.downloadFile(a.userId, id, req.ip));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cases')
  openCase(@CurrentActor() a: AuthenticatedActor, @Body() dto: CaseDto) {
    return this.commerce.openCase(a.userId, dto);
  }

  @Get('my/cases')
  cases(@CurrentActor() a: AuthenticatedActor, @Query('role') role?: string) {
    return this.commerce.cases(a.userId, role === 'seller' ? 'seller' : 'buyer');
  }

  /** Purchases and sales in one list: digital orders plus acquisition deals. */
  @Get('my/transactions')
  async transactions(@CurrentActor() a: AuthenticatedActor) {
    const [orders, sales, deals] = await Promise.all([this.commerce.orders(a.userId), this.commerce.sales(a.userId), this.deals.transactions(a.userId, 'all')]);
    return [
      ...orders.map((o) => ({ id: o.id, kind: o.kind, listing: o.listing, role: 'BUYER', amountMinor: o.amountMinor, currency: o.currency, status: o.status, createdAt: o.createdAt })),
      ...sales.map((o) => ({ id: o.id, kind: o.kind, listing: o.listing, role: 'SELLER', amountMinor: o.amountMinor, currency: o.currency, status: o.status, createdAt: o.createdAt })),
      ...deals.map((d) => ({ id: d.id, kind: d.kind, listing: d.listing, role: d.role, amountMinor: d.amountMinor, currency: d.currency, status: d.status, createdAt: d.createdAt })),
    ].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  }

  // Seller finances
  @Get('finances/balance')
  balance(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.balance(a.userId);
  }

  @Get('finances/ledger')
  ledger(@CurrentActor() a: AuthenticatedActor, @Query('month') month?: string, @Query('type') type?: string) {
    return this.commerce.ledger(a.userId, { month, type: type && type in SellerLedgerType ? (type as SellerLedgerType) : undefined });
  }

  @Get('finances/statements')
  statements(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.statements(a.userId);
  }

  @Get('finances/sales')
  sales(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.sales(a.userId);
  }

  @Get('finances/payouts')
  payouts(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.payouts(a.userId);
  }

  @Get('finances/payouts/:id')
  payout(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.commerce.payout(a.userId, id);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('finances/payouts')
  requestPayout(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.requestPayout(a.userId);
  }
}

@Controller('admin/marketplace')
export class MarketplaceAdminController {
  constructor(
    private readonly market: MarketplaceService,
    private readonly commerce: CommerceService,
  ) {}

  @Get('overview')
  overview(@CurrentActor() a: AuthenticatedActor) {
    return this.market.adminOverview(a.userId);
  }

  @Get('listings')
  list(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.market.adminList(a.userId, status && status in MarketplaceListingStatus ? (status as MarketplaceListingStatus) : undefined);
  }

  @Post('listings/:id/review')
  review(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.market.review(a.userId, id, dto.decision, dto.note);
  }

  @Get('sellers')
  sellers(@CurrentActor() a: AuthenticatedActor, @Query('q') q?: string) {
    return this.commerce.adminSellers(a.userId, q?.slice(0, 120));
  }

  @Post('sellers/:id/status')
  sellerStatus(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SellerStatusDto) {
    return this.commerce.adminSetSellerStatus(a.userId, id, dto.status, dto.note);
  }

  @Get('verifications')
  verifications(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.adminVerifications(a.userId, status && status in SellerCheckStatus ? (status as SellerCheckStatus) : undefined);
  }

  @Get('verifications/:id/files/:index')
  async evidence(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('index', ParseIntPipe) index: number, @Res() res: Response) {
    return sendFile(res, await this.commerce.adminEvidenceFile(a.userId, id, index), true);
  }

  @Post('verifications/:id/decision')
  decideVerification(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.commerce.adminDecideVerification(a.userId, id, dto.decision === 'APPROVE', dto.note);
  }

  @Get('transactions')
  transactions(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.adminTransactions(a.userId);
  }

  @Get('payouts')
  payouts(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.adminPayouts(a.userId, status && /^[A-Z_]{3,20}$/.test(status) ? status : undefined);
  }

  @Post('payouts/:id/action')
  payoutAction(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayoutActionDto) {
    return this.commerce.adminPayoutAction(a.userId, id, dto.action, dto.note);
  }

  @Post('ledger/adjustments')
  adjust(@CurrentActor() a: AuthenticatedActor, @Body() dto: AdjustDto) {
    return this.commerce.adminAdjust(a.userId, dto.sellerUserId, dto.amountMinor, dto.currency, dto.reason);
  }

  @Get('cases')
  cases(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.adminCases(a.userId, status && /^[A-Z_]{3,20}$/.test(status) ? status : undefined);
  }

  @Post('cases/:id/resolve')
  resolve(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CaseResolveDto) {
    return this.commerce.adminResolveCase(a.userId, id, dto.decision, { note: dto.note, amountMinor: dto.amountMinor });
  }

  @Get('settings')
  async settings(@CurrentActor() a: AuthenticatedActor) {
    return this.commerce.adminTerms(a.userId);
  }

  @Put('settings')
  setSettings(@CurrentActor() a: AuthenticatedActor, @Body() dto: TermsDto) {
    return this.commerce.setTerms(a.userId, dto);
  }
}
