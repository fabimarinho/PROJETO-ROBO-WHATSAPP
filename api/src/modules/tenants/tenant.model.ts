export type Tenant = {
  id: string;
  name: string;
  planCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
};
