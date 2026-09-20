import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CartService } from './cart.service.js';
import {
  AddCartItemDto,
  ApplyCouponDto,
  UpdateCartItemDto,
} from './dto/cart.dto.js';
import type { PaymentChoice } from '../pricing/totals.js';

export const CART_TOKEN_HEADER = 'x-cart-token';

@ApiTags('Cart')
@ApiHeader({
  name: CART_TOKEN_HEADER,
  required: false,
  description:
    'Guest cart token; returned on the first request and sent back thereafter.',
})
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  // Every response echoes the token so a guest keeps the same bag.
  private async respond(
    req: Request,
    res: Response,
    run: (cartId: string) => Promise<unknown>,
  ) {
    const cart = await this.cart.resolve(
      req.header(CART_TOKEN_HEADER) ?? undefined,
    );
    const body = await run(cart.id);
    if (cart.guestToken) res.setHeader(CART_TOKEN_HEADER, cart.guestToken);
    return res.json(body);
  }

  @Get()
  get(
    @Req() req: Request,
    @Res() res: Response,
    @Query('payment') payment?: PaymentChoice,
  ) {
    return this.respond(req, res, (id) =>
      this.cart.view(id, payment === 'COD' ? 'COD' : 'PREPAID'),
    );
  }

  @Post('items')
  addItem(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: AddCartItemDto,
  ) {
    return this.respond(req, res, (id) =>
      this.cart.addItem(id, body.variantId, body.qty),
    );
  }

  @Patch('items/:itemId')
  updateItem(
    @Req() req: Request,
    @Res() res: Response,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.respond(req, res, (id) =>
      this.cart.updateItem(id, itemId, body.qty),
    );
  }

  @Delete('items/:itemId')
  removeItem(
    @Req() req: Request,
    @Res() res: Response,
    @Param('itemId') itemId: string,
  ) {
    return this.respond(req, res, (id) => this.cart.removeItem(id, itemId));
  }

  @Post('coupon')
  applyCoupon(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: ApplyCouponDto,
  ) {
    return this.respond(req, res, (id) => this.cart.applyCoupon(id, body.code));
  }

  @Delete('coupon')
  removeCoupon(@Req() req: Request, @Res() res: Response) {
    return this.respond(req, res, (id) => this.cart.removeCoupon(id));
  }
}
