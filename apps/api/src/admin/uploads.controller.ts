import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { StaffAuthGuard } from '../auth/staff-auth.guard.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateUploadDto } from './dto/create-upload.dto.js';

@ApiTags('Admin uploads')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('CATALOG_MANAGER', 'MARKETING_SUPPORT')
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  // Returns a short-lived URL to PUT the file to, and the URL it will be served from.
  @Post()
  create(@Body() body: CreateUploadDto) {
    return this.storage.createUpload(body.folder, body.contentType);
  }
}
