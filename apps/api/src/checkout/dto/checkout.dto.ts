import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * A browser sends "" for an optional field the customer left alone, and
 * @IsOptional only skips null and undefined, so the blank must be normalised
 * before validation runs.
 */
const BlankIsAbsent = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );

export class AddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a 10-digit Indian mobile number' })
  phone: string;

  @BlankIsAbsent()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  line1: string;

  @BlankIsAbsent()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  line2?: string;

  @IsString()
  @MaxLength(60)
  city: string;

  @IsString()
  @MaxLength(60)
  state: string;

  @Matches(/^\d{6}$/, { message: 'Enter a 6-digit pincode' })
  pincode: string;
}

export const PAYMENT_METHODS = ['PREPAID', 'COD'] as const;

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];
}

export class VerifyPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}
