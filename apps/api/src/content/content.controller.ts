import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service.js';

@ApiTags('Content')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('content/home')
  getHome() {
    return this.content.getHome();
  }

  @Get('content/offers')
  getOffers() {
    return this.content.getOffers();
  }

  @Get('content/menu')
  getMenu() {
    return this.content.getMenu();
  }

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.content.getPage(slug);
  }
}
