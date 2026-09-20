import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

// One customer cannot take the whole stock of a size in a single order.
export const MAX_QTY_PER_ITEM = 10;

export class AddCartItemDto {
  @IsString()
  variantId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_ITEM)
  qty: number = 1;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_ITEM)
  qty: number;
}

export class ApplyCouponDto {
  @IsString()
  @MinLength(1)
  code: string;
}
