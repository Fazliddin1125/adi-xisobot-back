import { AppError } from '../../domain/errors/AppError.js';
import { toPublicUser, type PublicUser } from '../../domain/entities/User.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { TokenService } from '../ports/TokenService.js';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(username: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByUsername(username.trim().toLowerCase());
    if (!user || !(await this.hasher.compare(password, user.passwordHash))) {
      throw AppError.unauthorized('Login yoki parol noto\'g\'ri');
    }
    return { token: this.tokens.sign({ sub: user.id, role: user.role }), user: toPublicUser(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    return toPublicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    if (!(await this.hasher.compare(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Joriy parol noto\'g\'ri');
    }
    await this.users.update(userId, { passwordHash: await this.hasher.hash(newPassword) });
  }
}
