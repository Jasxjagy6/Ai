export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLinkFilterWorker } = await import("@/lib/link-filter");
    startLinkFilterWorker();
  }
}
