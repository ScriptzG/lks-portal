import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import type { EmailService } from "./EmailService.js";

/**
 * Sends real email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Also writes to the same `sent_emails` outbox MockEmailService uses, so Settings → Mock email
 * outbox keeps working as a real delivery log once this is live, not just during local dev.
 *
 * Needs `RESEND_API_KEY` set and `MOCK_SERVICES=false` — see server/.env.example. The "from"
 * address (`EMAIL_FROM`) must be on a domain verified in the Resend dashboard, or every send
 * will be rejected — this is the #1 thing to check first if sends start failing after going live.
 */
export class ResendEmailService implements EmailService {
  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: params.to,
        subject: params.subject,
        text: params.body,
      }),
    });

    await prisma.sentEmail.create({ data: params });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend API error (${res.status}): ${detail || res.statusText}`);
    }
  }
}
