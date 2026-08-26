// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted, потому что vi.mock уезжает наверх файла и обычную константу не увидит.
const session = vi.hoisted(() => ({
  readOAuthTransaction: vi.fn(),
  clearOAuthTransaction: vi.fn(),
  issueSession: vi.fn(),
}));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/services", () => ({ services: { ensureUserFromOAuth: vi.fn() } }));

import { GET } from "./route";

const callback = (query: string) => new Request(`https://ownday.test/auth/google/callback${query}`);

describe("/auth/google/callback", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("APP_URL", "https://ownday.test");
    session.readOAuthTransaction.mockResolvedValue({
      state: "correct",
      nonce: "nonce",
      timezone: "UTC",
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // Ровно этим `state` и защищён от подделки: чужой запрос не знает куки. Проверка
  // обязана быть до любого обращения к Google, иначе она не защищает ничего.
  it("refuses a state that does not match the cookie", async () => {
    const response = await GET(callback("?state=forged&code=whatever"));
    expect(response.headers.get("location")).toBe("https://ownday.test/auth/login?error=state");
    expect(session.issueSession).not.toHaveBeenCalled();
  });

  it("refuses a return with no transaction cookie at all", async () => {
    session.readOAuthTransaction.mockResolvedValue({});
    const response = await GET(callback("?state=correct&code=whatever"));
    expect(response.headers.get("location")).toBe("https://ownday.test/auth/login?error=state");
  });

  // Транзакция одноразовая: кука гасится до разбора, иначе один перехваченный state
  // работал бы столько раз, сколько его предъявят.
  it("burns the transaction even when the return is refused", async () => {
    await GET(callback("?state=forged"));
    expect(session.clearOAuthTransaction).toHaveBeenCalled();
  });

  // Нажатие «Отмена» у Google — не поломка: человек возвращается на страницу входа
  // без объяснений, за которые никто не извинялся.
  it("sends a cancelled sign-in back to the login page without a complaint", async () => {
    const response = await GET(callback("?error=access_denied&state=correct"));
    expect(response.headers.get("location")).toBe("https://ownday.test/auth/login");
  });

  it("answers plainly when the deployment has no Google credentials", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const response = await GET(callback("?state=correct&code=whatever"));
    expect(response.status).toBe(500);
  });
});
