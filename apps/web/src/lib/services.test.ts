import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ readSession: vi.fn(async () => null) }));

// redirect() в Next бросает собственное исключение и наружу не возвращается.
// Здесь повторяем это поведение и заодно ловим адрес: тест обязан краснеть не только
// когда аноним получает доступ, но и когда его уводят не туда.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

describe("getCurrentUserId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "postgresql://user:password@localhost:5432/ownday"])(
    "requires authentication in production when DATABASE_URL is %s",
    async (databaseUrl) => {
      vi.stubEnv("DATABASE_URL", databaseUrl);

      const { getCurrentUserId } = await import("./services");
      await expect(getCurrentUserId()).rejects.toThrow("NEXT_REDIRECT:/auth/required");
    },
  );
});
