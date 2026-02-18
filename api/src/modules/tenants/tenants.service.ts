import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';
import { Tenant } from './tenant.model';

type DbTenant = {
  id: string;
  name: string;
  plan_code: string;
  status: 'active' | 'inactive';
  created_at: string;
};

@Injectable()
export class TenantsService {
  constructor(private readonly db: PostgresService) {}

  async create(input: { name: string; planCode: string }): Promise<Tenant> {
    const id = randomUUID();

    const res = await this.db.query<DbTenant>(
      `insert into tenants (id, name, plan_code, status)
       values ($1, $2, $3, 'active')
       returning id, name, plan_code, status, created_at`,
      [id, input.name, input.planCode]
    );

    return this.toTenant(res.rows[0]);
  }

  async listByUserId(userId: string): Promise<Tenant[]> {
    const res = await this.db.query<DbTenant>(
      `select t.id, t.name, t.plan_code, t.status, t.created_at
       from tenants t
       inner join tenant_users tu on tu.tenant_id = t.id
       where tu.user_id = $1 and tu.status = 'active'
       order by t.created_at desc`,
      [userId]
    );

    return res.rows.map((row) => this.toTenant(row));
  }

  async getOrThrow(id: string): Promise<Tenant> {
    const res = await this.db.query<DbTenant>(
      'select id, name, plan_code, status, created_at from tenants where id = $1 limit 1',
      [id]
    );

    const tenant = res.rows[0];
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.toTenant(tenant);
  }

  private toTenant(row: DbTenant): Tenant {
    return {
      id: row.id,
      name: row.name,
      planCode: row.plan_code,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
