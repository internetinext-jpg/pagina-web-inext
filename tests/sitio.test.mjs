// Revisiones del sitio público de INEXT. Sin dependencias: `node --test`.
// Cada prueba nace de un problema real que ya pasó o que se descubrió en una auditoría.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (f) => readFileSync(join(RAIZ, f), "utf8");
const existe = (f) => existsSync(join(RAIZ, f));

const PAGINAS = ["index.html", "prueba-de-velocidad.html", "informacion-regulatoria.html", "404.html"];
const INDEXABLES = PAGINAS.filter((p) => p !== "404.html");
const DOMINIO = "https://pagina-web-inext.vercel.app";

function idsDe(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}
function scriptsLocales(html) {
  return [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]);
}

test("todas las páginas existen", () => {
  for (const p of PAGINAS) assert.ok(existe(p), `falta ${p}`);
});

test("nada público menciona Starlink, antenas ni satélite", () => {
  // El negocio es fibra óptica. El diseño original era de un revendedor
  // de Starlink y el cliente pidió explícitamente no usar nada de eso.
  const archivos = [...PAGINAS, "js/site.js", "js/mapa.js", "js/speedtest.js", "js/legal.js"];
  for (const f of archivos) {
    const t = leer(f).toLowerCase();
    for (const palabra of ["starlink", "satelital", "antena", "spacex"]) {
      assert.ok(!t.includes(palabra), `${f} menciona "${palabra}"`);
    }
  }
});

test("los archivos del diseño original no se publican", () => {
  // Se encontró INEXT Landing v3.dc.html sirviendo contenido de Starlink en producción.
  assert.ok(existe(".vercelignore"), "falta .vercelignore");
  const ignorados = leer(".vercelignore");
  for (const f of ["INEXT Landing v3.dc.html", "support.js", "image-slot.js", "_ds"]) {
    assert.ok(ignorados.includes(f), `.vercelignore no excluye ${f}`);
  }
});

test("cada página tiene lo necesario para buscadores y para compartir por WhatsApp", () => {
  for (const p of PAGINAS) {
    const h = leer(p);
    for (const [nombre, patron] of [
      ["title", /<title>[^<]{10,}<\/title>/],
      ["description", /<meta name="description" content="[^"]{40,}"/],
      ["theme-color", /<meta name="theme-color"/],
      ["og:title", /<meta property="og:title"/],
      ["og:description", /<meta property="og:description"/],
      ["og:image", /<meta property="og:image" content="https:\/\//],
      ["twitter:card", /<meta name="twitter:card"/],
    ]) {
      assert.match(h, patron, `${p}: falta ${nombre}`);
    }
  }
  for (const p of INDEXABLES) {
    assert.match(leer(p), /<link rel="canonical" href="https:\/\//, `${p}: falta canonical`);
  }
});

test("la imagen de vista previa existe y tiene el tamaño que pide WhatsApp/Facebook", () => {
  const img = leer("index.html").match(/og:image" content="https:\/\/[^/]+\/([^"]+)"/);
  assert.ok(img, "no hay og:image en la portada");
  assert.ok(existe(img[1]), `no existe ${img[1]}`);
  const png = readFileSync(join(RAIZ, img[1]));
  assert.equal(png.readUInt32BE(16), 1200, "og:image debe medir 1200 de ancho");
  assert.equal(png.readUInt32BE(20), 630, "og:image debe medir 630 de alto");
});

test("la portada declara el negocio con datos estructurados", () => {
  const m = leer("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "falta JSON-LD");
  const datos = JSON.parse(m[1]);
  assert.equal(datos.telephone, "+593969093580");
  assert.ok(datos.address && datos.address.addressLocality === "Otavalo");
});

test("robots.txt y sitemap.xml existen y el sitemap lista cada página", () => {
  assert.match(leer("robots.txt"), new RegExp(`Sitemap: ${DOMINIO}/sitemap.xml`));
  const mapa = leer("sitemap.xml");
  for (const p of INDEXABLES) {
    const url = p === "index.html" ? `${DOMINIO}/` : `${DOMINIO}/${p}`;
    assert.ok(mapa.includes(`<loc>${url}</loc>`), `sitemap no lista ${url}`);
  }
});

test("los enlaces internos llevan a algo que existe", () => {
  for (const p of PAGINAS) {
    const h = leer(p);
    for (const [, href] of h.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|#$)/.test(href)) continue;
      const [ruta, ancla] = href.split("#");
      const archivo = ruta.split("?")[0].replace(/^\//, "");
      const destino = archivo || (ruta.startsWith("/") ? "index.html" : p);
      assert.ok(existe(destino), `${p}: enlace roto a ${href}`);
      if (ancla && destino.endsWith(".html")) {
        assert.ok(idsDe(leer(destino)).has(ancla), `${p}: el ancla #${ancla} no existe en ${destino}`);
      }
    }
  }
});

test("todo id que buscan los scripts existe en la página que los carga", () => {
  for (const p of PAGINAS) {
    const h = leer(p);
    const ids = idsDe(h);
    for (const js of scriptsLocales(h)) {
      const codigo = leer(js);
      const buscados = [
        ...codigo.matchAll(/getElementById\("([^"]+)"\)/g),
        ...codigo.matchAll(/\$\("([^"]+)"\)/g),
      ].map((m) => m[1]);
      for (const id of buscados) assert.ok(ids.has(id), `${p} carga ${js}, que busca #${id}, y no existe`);
    }
  }
});

test("los encabezados no se saltan niveles", () => {
  for (const p of PAGINAS) {
    const niveles = [...leer(p).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < niveles.length; i++) {
      assert.ok(niveles[i] <= niveles[i - 1] + 1,
        `${p}: pasa de h${niveles[i - 1]} a h${niveles[i]} (encabezado número ${i + 1})`);
    }
  }
});

test("las imágenes tienen alt, ancho y alto", () => {
  for (const p of PAGINAS) {
    for (const [tag] of leer(p).matchAll(/<img\b[^>]*>/g)) {
      for (const attr of ["alt=", "width=", "height="]) assert.ok(tag.includes(attr), `${p}: ${tag} sin ${attr}`);
    }
  }
});

test("en celular hay un menú para llegar a las secciones", () => {
  // Por debajo de 1080px los enlaces del encabezado se ocultan; sin botón de menú
  // la única forma de llegar a las secciones era bajar hasta el pie de página.
  for (const p of INDEXABLES) {
    const h = leer(p);
    const boton = h.match(/<button[^>]*class="nav__toggle"[^>]*>/);
    assert.ok(boton, `${p}: falta el botón de menú`);
    assert.match(boton[0], /aria-expanded="false"/, `${p}: el botón de menú necesita aria-expanded`);
    const controla = boton[0].match(/aria-controls="([^"]+)"/);
    assert.ok(controla && idsDe(h).has(controla[1]), `${p}: aria-controls del menú apunta a nada`);
  }
});

test("cada css y js local lleva como versión la huella de su contenido", () => {
  // Tres veces en este proyecto el navegador sirvió un CSS o JS viejo porque
  // se editó el archivo y no se subió el ?v=. La versión ahora es el hash del
  // contenido: si cambias el archivo y no corres `npm run versionar`, esto falla.
  for (const p of PAGINAS) {
    for (const [, archivo, version] of leer(p).matchAll(/"\/?((?:css|js)\/[\w.-]+\.(?:css|js))\?v=([\w]+)"/g)) {
      const contenido = readFileSync(join(RAIZ, archivo), "utf8").replace(/\r\n/g, "\n");
      const hash = createHash("sha256").update(contenido).digest("hex").slice(0, 8);
      assert.equal(version, hash, `${p}: ${archivo}?v=${version} está desactualizado; corre npm run versionar`);
    }
  }
});
