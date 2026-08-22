export interface MagicLinkSender {
  send(input: { email: string; url: string }): Promise<void>;
}
export class StubMagicLinkSender implements MagicLinkSender {
  async send(input: { email: string; url: string }) {
    if (process.env.NODE_ENV !== "test")
      console.info(`Magic link for ${input.email}: ${input.url}`);
  }
}
