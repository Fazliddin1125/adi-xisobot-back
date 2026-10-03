import type { Role } from '../../domain/entities/User.js';

export interface TokenPayload {
  sub: string;
  role: Role;
  /** Foydalanuvchining tokenVersion'i — parol o'zgarsa mos kelmay qoladi */
  ver: number;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
