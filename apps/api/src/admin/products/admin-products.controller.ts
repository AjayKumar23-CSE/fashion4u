import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../auth/current-staff.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { StaffAuthGuard } from '../../auth/staff-auth.guard.js';
import type { AuthStaff } from '../../auth/staff.js';
import { AdminProductsService } from './admin-products.service.js';
import {
  CreateProductDto,
  ListAdminProductsDto,
  UpdateProductDto,
} from './dto/product.dto.js';

@ApiTags('Admin products')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('CATALOG_MANAGER')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(@Query() query: ListAdminProductsDto) {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Post()
  create(@Body() body: CreateProductDto, @CurrentStaff() staff: AuthStaff) {
    return this.products.create(body, staff);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.products.update(id, body, staff);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentStaff() staff: AuthStaff) {
    return this.products.remove(id, staff);
  }
}
