import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { ContactsService } from './contacts.service';
import { Contact } from './contact.model';

@UseGuards(TenantAccessGuard)
@Controller('tenants/:tenantId/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Roles('owner', 'admin', 'operator')
  @Post()
  create(
    @Param('tenantId') tenantId: string,
    @Body() body: { phoneE164: string; waId?: string; consentStatus?: string }
  ): Promise<Contact> {
    return this.contactsService.create({
      tenantId,
      phoneE164: body.phoneE164,
      waId: body.waId,
      consentStatus: body.consentStatus
    });
  }

  @Roles('owner', 'admin', 'operator')
  @Post('import-csv')
  importCsv(
    @Param('tenantId') tenantId: string,
    @Body() body: { csvContent: string }
  ): Promise<{ total: number; imported: number; invalid: number }> {
    return this.contactsService.importCsv({
      tenantId,
      csvContent: body.csvContent ?? ''
    });
  }

  @Get()
  list(@Param('tenantId') tenantId: string): Promise<Contact[]> {
    return this.contactsService.listByTenant(tenantId);
  }
}
