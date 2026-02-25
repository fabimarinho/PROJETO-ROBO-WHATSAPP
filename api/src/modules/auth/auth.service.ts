import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { sign, verify } from 'jsonwebtoken';
import { PostgresService } from '../../shared/database/postgres.service';
import { AuthUser, RefreshTokenPayload, TenantMembership, UserRole } from '../../shared/auth/auth.types';

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

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
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
    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      memberships
    };

    return {
      accessToken: this.issueAccessToken(authUser),
      refreshToken: await this.issueRefreshToken(user.id),
      user: authUser
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new InternalServerErrorException('JWT refresh secret is not configured');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = verify(refreshToken, refreshSecret) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh' || !payload.tokenId || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenRes = await this.db.query<{ id: string; token_hash: string }>(
      `select id, token_hash
       from refresh_tokens
       where id = $1 and user_id = $2 and revoked_at is null and expires_at > now()
       limit 1`,
      [payload.tokenId, payload.sub]
    );

    const tokenRow = tokenRes.rows[0];
    if (!tokenRow) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const valid = await compare(refreshToken, tokenRow.token_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.db.query('update refresh_tokens set revoked_at = now() where id = $1', [payload.tokenId]);

    const user = await this.getUserOrThrow(payload.sub);
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.userId),
      user
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

  private issueAccessToken(user: AuthUser): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    return sign(
      {
        sub: user.userId,
        email: user.email,
        memberships: user.memberships,
        typ: 'access'
      },
      jwtSecret,
      { expiresIn: this.resolveAccessTtlInSeconds() }
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new InternalServerErrorException('JWT refresh secret is not configured');
    }

    const tokenId = randomUUID();
    const refreshToken = sign(
      {
        sub: userId,
        tokenId,
        typ: 'refresh'
      },
      refreshSecret,
      { expiresIn: this.resolveRefreshTtlInSeconds() }
    );

    const tokenHash = await hash(refreshToken, 10);
    await this.db.query(
      `insert into refresh_tokens (id, user_id, token_hash, expires_at)
       values ($1, $2, $3, now() + ($4 || ' seconds')::interval)`,
      [tokenId, userId, tokenHash, this.resolveRefreshTtlInSeconds()]
    );

    return refreshToken;
  }

  private resolveRefreshTtlInSeconds(): number {
    const raw = process.env.JWT_REFRESH_TTL_SECONDS;
    if (!raw) {
      return 30 * 24 * 60 * 60;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 30 * 24 * 60 * 60;
  }

  private resolveAccessTtlInSeconds(): number {
    const raw = process.env.JWT_ACCESS_TTL_SECONDS;
    if (!raw) {
      return 8 * 60 * 60;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 8 * 60 * 60;
  }

  private async ensureBootstrapUser(): Promise<void> {
    if (this.bootstrapReady) {
      return;
    }

    const bootstrapEnabled = process.env.BOOTSTRAP_ADMIN_ENABLED === 'true';
    if (!bootstrapEnabled) {
      this.bootstrapReady = true;
      return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new InternalServerErrorException('Bootstrap admin is enabled but credentials are missing');
    }

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
