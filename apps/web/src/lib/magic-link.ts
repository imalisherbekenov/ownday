export interface MagicLinkSender {
  send(input: { email: string; url: string }): Promise<void>;
}
export class StubMagicLinkSender implements MagicLinkSender {
  async send(input: { email: string; url: string }) {
    if (process.env.NODE_ENV !== "test")
      console.info(`Magic link for ${input.email}: ${input.url}`);
  }
}
export class ResendMagicLinkSender implements MagicLinkSender {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(input: { email: string; url: string }) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [input.email],
        subject: "Вход в Ownday",
        html: `<p><a href="${input.url}">Войти в Ownday</a></p><p>Ссылка действует 10 минут.</p>`,
      }),
    });
    if (!response.ok) throw new Error(`Resend request failed with status ${response.status}`);
  }
}

export function createMagicLinkSender(): MagicLinkSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return new StubMagicLinkSender();
  return new ResendMagicLinkSender(
    apiKey,
    process.env.MAGIC_LINK_FROM ?? "Ownday <onboarding@resend.dev>",
  );
}
