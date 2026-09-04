import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import type { EmailService } from "./EmailService.js";
import { ResendEmailService } from "./ResendEmailService.js";

/** Instead of sending real email, writes to the sent_emails outbox so admins can review it in Settings. */
export class MockEmailService implements EmailService {
  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    await prisma.sentEmail.create({ data: params });
  }
}

// MOCK_SERVICES=false + a real RESEND_API_KEY switches every email in the app (invites, password
// resets, ticket/message notifications, publish requests) over to actually sending — no other
// code change needed, every call site already goes through this one `emailService` singleton.
export const emailService: EmailService =
  !env.mockServices && env.resendApiKey ? new ResendEmailService() : new MockEmailService();
