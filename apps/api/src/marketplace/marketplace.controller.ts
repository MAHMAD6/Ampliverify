import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceAssetType, MarketplaceListingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { MarketplaceService } from './marketplace.service';

const MAX_MINOR = 100_000_000_000; // 1 billion in major units

class ListingDto {
  @IsUUID() workspaceId: string;
  @IsString() @MinLength(5) @MaxLength(160) title: string;
  @IsEnum(MarketplaceAssetType) assetType: MarketplaceAssetType;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsString() @MinLength(20) @MaxLength(300) summary: string;
  @IsString() @MinLength(50) @MaxLength(10_000) description: string;
  @IsInt() @Min(100) @Max(MAX_MINOR) askingPriceMinor: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) monthlyRevenueMinor?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) monthlyVisitors?: number | null;
}

class UpdateListingDto {
  @IsOptional() @IsBoolean() withdraw?: boolean;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(160) title?: string;
  @IsOptional() @IsEnum(MarketplaceAssetType) assetType?: MarketplaceAssetType;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MinLength(50) @MaxLength(10_000) description?: string;
  @IsOptional() @IsInt() @Min(100) @Max(MAX_MINOR) askingPriceMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) monthlyRevenueMinor?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) monthlyVisitors?: number | null;
}

class InquiryDto {
  @IsUUID() workspaceId: string;
  @IsString() @MinLength(10) @MaxLength(4_000) message: string;
}

class ReplyDto {
  @IsString() @MinLength(2) @MaxLength(4_000) message: string;
}

class ReviewDto {
  @IsIn(['APPROVE', 'REJECT']) decision: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1_000) note?: string;
}

class BrowseQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(MarketplaceAssetType) type?: MarketplaceAssetType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

@Controller('user/marketplace')
export class MarketplaceController {
  constructor(private readonly market: MarketplaceService) {}

  @Get('summary')
  summary(@CurrentActor() a: AuthenticatedActor) {
    return this.market.summary(a.userId);
  }

  @Get('listings')
  browse(@Query() q: BrowseQuery) {
    return this.market.browse({ q: q.q, assetType: q.type, page: q.page });
  }

  @Get('listings/:id')
  listing(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.listing(a.userId, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('listings')
  create(@CurrentActor() a: AuthenticatedActor, @Body() dto: ListingDto) {
    return this.market.createListing(a.userId, dto);
  }

  @Get('my/listings')
  myListings(@CurrentActor() a: AuthenticatedActor) {
    return this.market.myListings(a.userId);
  }

  @Patch('my/listings/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.market.updateListing(a.userId, id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('listings/:id/inquiries')
  inquire(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InquiryDto) {
    return this.market.inquire(a.userId, id, dto);
  }

  @Get('my/inquiries')
  inquiries(@CurrentActor() a: AuthenticatedActor, @Query('role') role?: string) {
    return this.market.inquiries(a.userId, role === 'sent' ? 'sent' : 'received');
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('inquiries/:id/reply')
  reply(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.market.reply(a.userId, id, dto.message);
  }

  @Post('inquiries/:id/close')
  close(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.market.closeInquiry(a.userId, id);
  }

  @Get('my/purchases')
  purchases(@CurrentActor() a: AuthenticatedActor) {
    return this.market.transactions(a.userId, 'buyer');
  }

  @Get('my/transactions')
  transactions(@CurrentActor() a: AuthenticatedActor) {
    return this.market.transactions(a.userId, 'all');
  }
}

@Controller('admin/marketplace')
export class MarketplaceAdminController {
  constructor(private readonly market: MarketplaceService) {}

  @Get('listings')
  list(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.market.adminList(a.userId, status && status in MarketplaceListingStatus ? (status as MarketplaceListingStatus) : undefined);
  }

  @Post('listings/:id/review')
  review(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.market.review(a.userId, id, dto.decision, dto.note);
  }
}
