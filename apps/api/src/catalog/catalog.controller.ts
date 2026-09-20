import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { ListProductsDto } from './dto/list-products.dto.js';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  getCategories() {
    return this.catalog.getCategoryTree();
  }

  @Get('products')
  listProducts(@Query() query: ListProductsDto) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }

  @Get('search/suggest')
  suggest(@Query('q') q: string = '') {
    return this.catalog.suggest(q);
  }
}
