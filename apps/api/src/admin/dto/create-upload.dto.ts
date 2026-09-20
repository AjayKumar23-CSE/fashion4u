import { IsIn } from 'class-validator';
import {
  IMAGE_TYPES,
  UPLOAD_FOLDERS,
  type UploadFolder,
} from '../../storage/storage.service.js';

export class CreateUploadDto {
  @IsIn(UPLOAD_FOLDERS)
  folder: UploadFolder;

  @IsIn(Object.keys(IMAGE_TYPES))
  contentType: string;
}
