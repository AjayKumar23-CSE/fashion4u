import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from './password.js';
import type { AuthStaff } from './staff.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const staff = await this.prisma.staffUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Same error for unknown email, wrong password and disabled account.
    const valid =
      staff?.isActive && (await verifyPassword(password, staff.passwordHash));
    if (!staff || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }

    const profile: AuthStaff = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    };
    return {
      token: await this.jwt.signAsync({ sub: staff.id }),
      staff: profile,
    };
  }
}
