export class OutboundMessage {
  constructor(
    public readonly tenantId: string,
    public readonly campaignId: string,
    public readonly contactId: string,
    public readonly templateName: string,
    public readonly languageCode: string
  ) {}
}
