import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsAppCloudClient {
  async sendTemplateMessage(input: {
    to: string;
    templateName: string;
    languageCode: string;
  }): Promise<{ providerMessageId: string }> {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const graphVersion = process.env.META_GRAPH_VERSION ?? 'v20.0';

    if (!token || !phoneNumberId) {
      return { providerMessageId: `mock-${Date.now()}` };
    }

    const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.languageCode }
        }
      })
    });

    const payload = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number | string; message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'meta_request_failed');
    }

    const providerMessageId = payload.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new Error('meta_missing_message_id');
    }

    return { providerMessageId };
  }
}
