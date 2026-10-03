import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { AppError } from '../../domain/errors/AppError.js';
import type { TokenPayload, TokenService } from '../../application/ports/TokenService.js';

/** Faqat HS256 qabul qilinadi — algoritmni almashtirish hujumlaridan himoya */
const ALGORITHM = 'HS256';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { algorithm: ALGORITHM, expiresIn: this.expiresIn as SignOptions['expiresIn'] });
  }

  verify(token: string): TokenPayload {
    try {
      const { sub, role, ver } = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] }) as JwtPayload & TokenPayload;
      // Bu o'zgarishdan oldin berilgan tokenlarda ver yo'q — 0 deb olinadi
      return { sub, role, ver: typeof ver === 'number' ? ver : 0 };
    } catch {
      throw AppError.unauthorized('Sessiya tugagan, qayta kiring');
    }
  }
}
