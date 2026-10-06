import { Controller, DefaultValuePipe, Get, Param, ParseEnumPipe, ParseIntPipe, Query } from '@nestjs/common';
import { CmsContentType } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { PublicContentService } from './public-content.service';

/** Unauthenticated, read-only endpoints for the marketing site. */
@Controller('public')
@Public()
export class PublicContentController {
  constructor(private readonly content: PublicContentService) {}

  @Get('categories')
  categories(@Query('type', new ParseEnumPipe(CmsContentType)) type: CmsContentType) {
    return this.content.listCategories(type);
  }

  @Get('blog')
  blog(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit?: number,
  ) {
    return this.content.listBlogPosts({ q, category, limit });
  }

  @Get('blog/:slug')
  blogPost(@Param('slug') slug: string) {
    return this.content.getBlogPost(slug);
  }

  @Get('guides')
  guides(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit?: number,
  ) {
    return this.content.listGuides({ q, category, limit });
  }

  @Get('guides/:slug')
  guide(@Param('slug') slug: string) {
    return this.content.getGuide(slug);
  }

  @Get('help')
  help(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit?: number,
  ) {
    return this.content.listHelpArticles({ q, category, limit });
  }

  @Get('help/:slug')
  helpArticle(@Param('slug') slug: string) {
    return this.content.getHelpArticle(slug);
  }

  @Get('careers')
  careers() {
    return this.content.listJobOpenings();
  }

  @Get('careers/:slug')
  job(@Param('slug') slug: string) {
    return this.content.getJobOpening(slug);
  }

  @Get('plans')
  plans() {
    return this.content.listPlans();
  }

  @Get('geo-platforms')
  geoPlatforms() {
    return this.content.listGeoPlatforms();
  }

  @Get('integrations')
  integrations() {
    return this.content.listIntegrations();
  }
}
