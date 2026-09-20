import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '../generated/prisma/client.js';

export const ROLES_KEY = 'staffRoles';

// Roles allowed on a route besides OWNER, who can do everything.
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
