// Runs once when the server starts. Validating the environment here makes a
// misconfigured deployment fail fast with a clear message.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("./lib/env");
    env();
  }
}
