// Pone a cada css/js local una versión igual a la huella de su contenido
// (?v=<8 primeros caracteres del sha256>). Si el archivo cambia, la dirección
// cambia, y el navegador no puede quedarse con la copia vieja.
// Uso: npm run versionar
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
// Los saltos de línea se normalizan: Git los convierte a CRLF en Windows y a LF en
// Linux (GitHub, Vercel), y la huella no debe depender de dónde se revisa.
const huella = (archivo) =>
  createHash("sha256")
    .update(readFileSync(join(RAIZ, archivo), "utf8").replace(/\r\n/g, "\n"))
    .digest("hex").slice(0, 8);

let cambios = 0;
for (const pagina of readdirSync(RAIZ).filter((f) => f.endsWith(".html") && !f.endsWith(".dc.html"))) {
  const ruta = join(RAIZ, pagina);
  const antes = readFileSync(ruta, "utf8");
  const despues = antes.replace(
    /"(\/?)((?:css|js)\/[\w.-]+\.(?:css|js))\?v=[\w]+"/g,
    (_, barra, archivo) => `"${barra}${archivo}?v=${huella(archivo)}"`
  );
  if (despues !== antes) {
    writeFileSync(ruta, despues);
    cambios++;
    console.log("actualizado", pagina);
  }
}
console.log(cambios ? `${cambios} página(s) actualizadas` : "todo al día");
