import type { Role } from '../domain/entities/User.js';

/** So'rov yuborgan (tizimga kirgan) foydalanuvchi */
export interface Actor {
  id: string;
  role: Role;
  departmentId?: string;
}
