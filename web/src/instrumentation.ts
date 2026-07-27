export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.LINK_FILTER_WORKER !== "false"
  ) {
    const { startLinkFilterWorker } = await import("@/lib/link-filter");
    startLinkFilterWorker();
  }
}
