import type { StaffRole } from '../generated/prisma/client.js';

// What the staff token carries and what guards attach to the request.
export interface AuthStaff {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
}
