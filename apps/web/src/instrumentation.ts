export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerConfig } = await import("./lib/config");
    validateServerConfig();
  }
}
