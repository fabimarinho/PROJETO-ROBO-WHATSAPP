import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { PostgresService } from '../../shared/database/postgres.service';
import { AuthUser, TenantMembership, UserRole } from '../../shared/auth/auth.types';

type DbUser = {
  id: string;
  email: string;
  password_hash: string;
};

type DbMembership = {
  tenant_id: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  private bootstrapReady = false;

  constructor(private readonly db: PostgresService) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    await this.ensureBootstrapUser();

    const userRes = await this.db.query<DbUser>(
      'select id, email, password_hash from users where email = $1 limit 1',
      [email]
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.getMemberships(user.id);

    const token = sign(
      {
        sub: user.id,
        email: user.email,
        memberships
      },
      process.env.JWT_SECRET ?? 'dev-secret',
      { expiresIn: '8h' }
    );

    return {
      accessToken: token,
      user: {
        userId: user.id,
        email: user.email,
        memberships
      }
    };
  }

  async addMembership(userId: string, tenantId: string, role: UserRole): Promise<void> {
    await this.db.query(
      `insert into tenant_users (tenant_id, user_id, role, status)
       values ($1, $2, $3, 'active')
       on conflict (tenant_id, user_id)
       do update set role = excluded.role, status = 'active'`,
      [tenantId, userId, role]
    );
  }

  async getUserOrThrow(userId: string): Promise<AuthUser> {
    const userRes = await this.db.query<{ id: string; email: string }>(
      'select id, email from users where id = $1 limit 1',
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const memberships = await this.getMemberships(user.id);

    return {
      userId: user.id,
      email: user.email,
      memberships
    };
  }

  private async getMemberships(userId: string): Promise<TenantMembership[]> {
    const membershipRes = await this.db.query<DbMembership>(
      `select tenant_id, role
       from tenant_users
       where user_id = $1 and status = 'active'`,
      [userId]
    );

    return membershipRes.rows.map((item) => ({
      tenantId: item.tenant_id,
      role: item.role
    }));
  }

  private async ensureBootstrapUser(): Promise<void> {
    if (this.bootstrapReady) {
      return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@demo.com';
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'admin123';

    const existsRes = await this.db.query<{ id: string }>('select id from users where email = $1 limit 1', [email]);

    if (existsRes.rows.length === 0) {
      const passwordHash = await hash(password, 10);
      await this.db.query(
        'insert into users (id, email, password_hash, mfa_enabled) values ($1, $2, $3, false)',
        [randomUUID(), email, passwordHash]
      );
    }

    this.bootstrapReady = true;
  }
}
