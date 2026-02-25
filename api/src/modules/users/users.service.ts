import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { UserRole } from '../../shared/auth/auth.types';
import { PostgresService } from '../../shared/database/postgres.service';

type DbTenantUser = {
  user_id: string;
  email: string;
  role: UserRole;
  status: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly db: PostgresService) {}

  async listByTenant(tenantId: string): Promise<
    Array<{ userId: string; email: string; role: UserRole; status: string }>
  > {
    const res = await this.db.queryForTenant<DbTenantUser>(
      tenantId,
      `select tu.user_id, u.email, tu.role, tu.status
       from tenant_users tu
       inner join users u on u.id = tu.user_id
       where tu.tenant_id = $1 and tu.deleted_at is null
       order by u.email asc`,
      [tenantId]
    );

    return res.rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
      status: row.status
    }));
  }

  async invite(input: { tenantId: string; email: string; role: UserRole; temporaryPassword: string }): Promise<void> {
    const userId = randomUUID();
    const passwordHash = await hash(input.temporaryPassword, 10);

    await this.db.query(
      `insert into users (id, email, password_hash, status, mfa_enabled)
       values ($1, $2, $3, 'invited', false)
       on conflict (email)
       do update set status = 'invited'`,
      [userId, input.email, passwordHash]
    );

    await this.db.queryForTenant(
      input.tenantId,
      `insert into tenant_users (tenant_id, user_id, role, status)
       select $1, u.id, $3, 'active'
       from users u
       where u.email = $2
       on conflict (tenant_id, user_id)
       do update set role = excluded.role, status = 'active'`,
      [input.tenantId, input.email, input.role]
    );
  }
}
