import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = process.argv[2]; const out = process.argv[3];
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "POST") { const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => { fs.writeFileSync(path.join(out, path.basename(u.pathname)), Buffer.concat(chunks)); res.end("ok"); }); return; }
  const f = path.join(root, path.normalize(u.pathname));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  const type = f.endsWith(".html") ? "text/html" : f.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  res.setHeader("content-type", type); fs.createReadStream(f).pipe(res);
}).listen(8765, "127.0.0.1", () => console.log("listening 8765"));
