export function sessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (
    !value ||
    new TextEncoder().encode(value).length < 32 ||
    value === "development-only-change-me-32-bytes"
  )
    throw new Error("SESSION_SECRET must be explicitly configured with at least 32 bytes");
  return new TextEncoder().encode(value);
}

export function validateServerConfig(): void {
  sessionSecret();
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required in production");
}
