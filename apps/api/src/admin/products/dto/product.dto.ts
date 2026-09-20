import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE'] as const;

export class ProductImageDto {
  @IsString()
  @MinLength(1)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsString()
  colour?: string | null;
}

export class ProductVariantDto {
  // Present when editing an existing variant; absent for a new one.
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  size: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  colour: string;

  // Generated from slug, colour and size when omitted.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number | null;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug may only contain lowercase letters, numbers and hyphens',
  })
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Money is integer paise.
  @IsInt()
  @Min(1)
  mrp: number;

  @IsInt()
  @Min(1)
  salePrice: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fabricTag?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fit?: string | null;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  hsnCode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(28)
  gstRate?: number;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;

  // In display order; the first image is the listing thumbnail.
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ListAdminProductsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Default kept small: a staff member scanning a list wants a short page.
  // The admin UI offers a fixed set of sizes; the API stays flexible.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;
}
