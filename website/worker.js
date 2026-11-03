// The Worker in front of the static site. It only does one thing: when a client asks
// for the home page as Markdown (Accept: text/markdown), it serves index.md instead of
// index.html. Everything else is served from the assets as before.
//
// Cloudflare's own "Markdown for Agents" does this conversion at the edge, but only on
// paid plans, so the Markdown version is kept by hand next to index.html.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((url.pathname === "/" || url.pathname === "/index.html") && prefersMarkdown(request.headers.get("accept"))) {
      const md = await env.ASSETS.fetch(new Request(new URL("/index.md", url), request));
      if (md.ok) {
        const headers = new Headers(md.headers);
        headers.set("content-type", "text/markdown; charset=utf-8");
        headers.set("vary", "accept");
        return new Response(md.body, { status: 200, headers });
      }
    }
    return env.ASSETS.fetch(request);
  },
};

// Whether an Accept header prefers text/markdown over text/html.
// Follows the same rules as Cloudflare's Markdown for Agents: an explicit text/markdown or
// text/* wins over an equally weighted text/html; */* alone keeps HTML.
function prefersMarkdown(accept) {
  if (!accept) return false;
  let markdown = { q: 0, rank: -1 };
  let html = { q: 0, rank: -1 };
  for (const part of accept.split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k === "q") q = Number.parseFloat(v);
    }
    if (!(q > 0)) continue;
    const rank = type === "*/*" ? 0 : type === "text/*" ? 1 : 2; // specificity
    if (type === "text/markdown" || type === "text/*") markdown = better(markdown, { q, rank });
    if (type === "text/html" || type === "text/*" || type === "*/*") html = better(html, { q, rank });
  }
  if (markdown.q === 0) return false;
  if (markdown.q !== html.q) return markdown.q > html.q;
  return markdown.rank >= html.rank;
}

function better(a, b) {
  return b.rank > a.rank || (b.rank === a.rank && b.q > a.q) ? b : a;
}
