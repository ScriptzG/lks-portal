export interface EmailService {
  send(params: { to: string; subject: string; body: string }): Promise<void>;
}
