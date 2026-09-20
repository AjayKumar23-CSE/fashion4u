import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../auth/current-staff.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { StaffAuthGuard } from '../../auth/staff-auth.guard.js';
import type { AuthStaff } from '../../auth/staff.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@ApiTags('Admin categories')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('CATALOG_MANAGER')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() body: CreateCategoryDto, @CurrentStaff() staff: AuthStaff) {
    return this.categories.create(body, staff);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @CurrentStaff() staff: AuthStaff,
  ) {
    return this.categories.update(id, body, staff);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentStaff() staff: AuthStaff) {
    return this.categories.remove(id, staff);
  }
}
