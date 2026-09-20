import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { AuditService } from './audit.service.js';
import { AdminCategoriesController } from './categories/admin-categories.controller.js';
import { AdminCategoriesService } from './categories/admin-categories.service.js';
import { AdminProductsController } from './products/admin-products.controller.js';
import { AdminProductsService } from './products/admin-products.service.js';
import { UploadsController } from './uploads.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [
    UploadsController,
    AdminCategoriesController,
    AdminProductsController,
  ],
  providers: [AuditService, AdminCategoriesService, AdminProductsService],
})
export class AdminModule {}
