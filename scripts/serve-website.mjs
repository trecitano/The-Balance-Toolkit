// Serves the local website/ directory as static files, read from disk on every request.
// Usage: bun scripts/serve-website.mjs [port]   (default 8000)
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../website");
const port = Number(process.argv[2] ?? process.env.PORT ?? 8000);

const server = Bun.serve({
  port,
  async fetch(request) {
    let pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) {
      return new Response("Forbidden", { status: 403 });
    }
    const file = Bun.file(path);
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

console.log(`Serving website/ at http://localhost:${server.port}`);
