// Sirve el sitio en local aplicando las cabeceras de vercel.json (incluida la
// política de seguridad), para probar cambios igual que en producción.
// Uso: npm run servir   →   http://localhost:8970
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, extname } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.PUERTO || 8970);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".woff2": "font/woff2", ".json": "application/json",
};
const reglas = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf8")).headers;

createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  if (ruta.endsWith("/")) ruta += "index.html";
  let archivo = join(RAIZ, ruta);
  let estado = 200;
  if (!archivo.startsWith(RAIZ) || !existsSync(archivo) || statSync(archivo).isDirectory()) {
    archivo = join(RAIZ, "404.html");
    estado = 404;
  }
  for (const r of reglas) {
    if (!new RegExp("^" + r.source.replace(/\.\*/g, ".*") + "$").test(ruta)) continue;
    // Localhost no es https: upgrade-insecure-requests subiría lo local a https y no cargaría.
    for (const h of r.headers) res.setHeader(h.key, h.value.replace(/;\s*upgrade-insecure-requests/, ""));
  }
  res.writeHead(estado, { "Content-Type": TIPOS[extname(archivo)] || "application/octet-stream" });
  res.end(readFileSync(archivo));
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`));
