import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CurrentStaff } from './current-staff.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { StaffAuthGuard } from './staff-auth.guard.js';
import type { AuthStaff } from './staff.js';

@ApiTags('Admin auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 5 attempts a minute per IP.
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(StaffAuthGuard)
  me(@CurrentStaff() staff: AuthStaff) {
    return staff;
  }
}
