import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CartService } from '../cart/cart.service.js';
import { CART_TOKEN_HEADER } from '../cart/cart.controller.js';
import { CheckoutService } from './checkout.service.js';
import { CreateOrderDto, VerifyPaymentDto } from './dto/checkout.dto.js';

@ApiTags('Checkout')
@Controller()
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly cart: CartService,
  ) {}

  @Post('checkout/orders')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createOrder(
    @Req() req: Request,
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Send an Idempotency-Key header so a retry cannot order twice',
      });
    }
    const cart = await this.cart.resolve(
      req.header(CART_TOKEN_HEADER) ?? undefined,
    );
    return this.checkout.createOrder(cart.id, body, idempotencyKey);
  }

  @Post('checkout/verify')
  verify(@Body() body: VerifyPaymentDto) {
    return this.checkout.verifyPayment(body);
  }

  @Get('orders/:orderNo')
  getOrder(@Param('orderNo') orderNo: string) {
    return this.checkout.getOrder(orderNo);
  }
}
