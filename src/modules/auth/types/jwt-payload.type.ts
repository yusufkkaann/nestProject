import { UserRole } from '../../users/schemas/user.schema';

/** JWT icine imzalanan veri */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Guard dogruladiktan sonra request.user icine konan veri */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}
