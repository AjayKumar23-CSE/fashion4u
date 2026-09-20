import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { StaffRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { AuthStaff } from './staff.js';

// Every /admin route: valid staff token, account still active, role allowed.
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { staff?: AuthStaff }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw this.unauthorized();

    let staffId: string;
    try {
      staffId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw this.unauthorized();
    }

    // Looked up on every request so a disabled account loses access at once.
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: staffId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!staff?.isActive) throw this.unauthorized();

    const allowed = this.reflector.getAllAndOverride<StaffRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && staff.role !== 'OWNER' && !allowed.includes(staff.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Your role cannot do this',
      });
    }

    request.staff = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    };
    return true;
  }

  private unauthorized() {
    return new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Sign in to continue',
    });
  }
}
