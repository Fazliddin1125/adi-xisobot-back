import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '../../domain/errors/AppError.js';
import type { TokenPayload, TokenService } from '../../application/ports/TokenService.js';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn as SignOptions['expiresIn'] });
  }

  verify(token: string): TokenPayload {
    try {
      const { sub, role } = jwt.verify(token, this.secret) as TokenPayload;
      return { sub, role };
    } catch {
      throw AppError.unauthorized('Sessiya tugagan, qayta kiring');
    }
  }
}
