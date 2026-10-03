import { AppError } from '../../domain/errors/AppError.js';
import { toPublicUser, type PublicUser } from '../../domain/entities/User.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { LoginThrottle } from '../ports/LoginThrottle.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { TokenService } from '../ports/TokenService.js';

const blockedMessage = (minutes: number) =>
  `Juda ko‘p noto‘g‘ri urinish. ${minutes} daqiqadan keyin qayta urinib ko‘ring.`;

export class AuthService {
  /** Mavjud bo'lmagan login uchun ham parol tekshiriladi — javob vaqtidan loginlarni aniqlab bo'lmasin */
  private dummyHash: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly throttle: LoginThrottle,
  ) {
    this.dummyHash = hasher.hash('timing-equalizer-not-a-password');
  }

  async login(username: string, password: string, ip: string): Promise<{ token: string; user: PublicUser }> {
    const login = username.trim().toLowerCase();
    const blocked = this.throttle.blockedFor(login, ip);
    if (blocked) throw AppError.tooManyRequests(blockedMessage(blocked));

    const user = await this.users.findByUsername(login);
    const ok = await this.hasher.compare(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !ok) {
      this.throttle.recordFailure(login, ip);
      throw AppError.unauthorized('Login yoki parol noto\'g\'ri');
    }
    this.throttle.reset(login);
    return { token: this.tokens.sign({ sub: user.id, role: user.role, ver: user.tokenVersion }), user: toPublicUser(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    return toPublicUser(user);
  }

  /**
   * Parolni almashtiradi. Boshqa qurilmalardagi barcha sessiyalar bekor bo'ladi,
   * joriy qurilma uchun yangi token qaytariladi.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip: string): Promise<{ token: string }> {
    const key = `pwd:${userId}`;
    const blocked = this.throttle.blockedFor(key, ip);
    if (blocked) throw AppError.tooManyRequests(blockedMessage(blocked));

    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    if (!(await this.hasher.compare(currentPassword, user.passwordHash))) {
      this.throttle.recordFailure(key, ip);
      throw AppError.badRequest('Joriy parol noto\'g\'ri');
    }
    if (currentPassword === newPassword) throw AppError.badRequest('Yangi parol eskisidan farq qilishi kerak');
    this.throttle.reset(key);

    const updated = (await this.users.setPassword(userId, await this.hasher.hash(newPassword)))!;
    return { token: this.tokens.sign({ sub: updated.id, role: updated.role, ver: updated.tokenVersion }) };
  }
}
