import type { Role } from '../../domain/entities/User.js';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
