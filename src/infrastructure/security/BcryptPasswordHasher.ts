import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../application/ports/PasswordHasher.js';

export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string) {
    return bcrypt.hash(plain, 10);
  }
  compare(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }
}
