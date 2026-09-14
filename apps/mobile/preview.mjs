import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("./dist/web/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cache-Control", "no-cache");
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      let target = path.resolve(root, `.${pathname}`);
      const relative = path.relative(root, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      } catch {
        if (path.extname(pathname)) {
          res.writeHead(404);
          res.end();
          return;
        }
        target = path.join(root, "index.html");
      }
      res.setHeader("Content-Type", types[path.extname(target)] ?? "application/octet-stream");
      res.end(await readFile(target));
    } catch {
      res.writeHead(500);
      res.end("Preview unavailable. Export the web bundle first.");
    }
  })
  .listen(8082, "127.0.0.1", () => console.log("Ownday app preview: http://127.0.0.1:8082"));
