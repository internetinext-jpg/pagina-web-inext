/* Selector de ubicación del formulario de cobertura.
   Con fibra la cobertura es por dirección, no por cantón: un pin en el mapa
   vale más que un campo de texto, y de paso nos dice hacia dónde crece la red.

   Mapa: Leaflet sobre teselas de OpenStreetMap (atribución obligatoria, abajo).
   Búsqueda y dirección inversa: Nominatim. Su política pide como máximo una
   consulta por segundo y prohíbe el autocompletado por cada tecla, así que aquí
   se busca al pulsar Buscar o Enter, nunca mientras se escribe. */
window.INEXT_MAPA = (() => {
  "use strict";

  const OTAVALO = [0.2340, -78.2610];   // parque central de Otavalo
  const ZOOM_INICIAL = 14;
  const ZOOM_ELEGIDO = 17;
  const NOMINATIM = "https://nominatim.openstreetmap.org";

  const $ = (id) => document.getElementById(id);
  let map = null, marker = null, listeners = [];
  const elegido = { lat: null, lng: null, direccion: "", referencia: "" };

  function emitir() {
    listeners.forEach((fn) => fn({ ...elegido }));
  }

  function fmtCoord(v) {
    return Number(v).toFixed(6);
  }

  function pintarElegido() {
    const caja = $("inx-picked");
    if (elegido.lat === null) { caja.hidden = true; return; }
    caja.hidden = false;
    $("inx-direccion").textContent = elegido.direccion || "Ubicación marcada en el mapa";
    $("inx-coords").textContent = fmtCoord(elegido.lat) + ", " + fmtCoord(elegido.lng);
  }

  // El pin vive fijo en el centro: el usuario mueve el mapa, no el pin. En
  // celular arrastrar un marcador con el dedo tapa justamente lo que se mira.
  function centroCambiado() {
    const c = map.getCenter();
    elegido.lat = c.lat;
    elegido.lng = c.lng;
    elegido.direccion = "";
    pintarElegido();
    emitir();
    reverso(c.lat, c.lng);
  }

  let reversoPedido = 0;
  function reverso(lat, lon) {
    const mio = ++reversoPedido;
    fetch(NOMINATIM + "/reverse?format=jsonv2&zoom=18&accept-language=es&lat=" +
          encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || mio !== reversoPedido) return;   // llegó tarde: ya movieron el mapa
        const a = d.address || {};
        const partes = [
          [a.road, a.house_number].filter(Boolean).join(" "),
          a.neighbourhood || a.suburb || a.village || a.hamlet,
          a.town || a.city || a.county,
        ].filter(Boolean);
        elegido.direccion = partes.length ? partes.join(", ") : (d.display_name || "");
        pintarElegido();
        emitir();
      })
      .catch(() => { /* sin dirección: quedan las coordenadas, que es lo que importa */ });
  }

  function irA(lat, lon, etiqueta) {
    map.setView([lat, lon], ZOOM_ELEGIDO);
    elegido.lat = lat;
    elegido.lng = lon;
    if (etiqueta) elegido.direccion = etiqueta;
    pintarElegido();
    emitir();
    if (!etiqueta) reverso(lat, lon);
  }

  function pintarResultados(lista) {
    const caja = $("inx-resultados");
    caja.innerHTML = "";
    if (!lista.length) {
      caja.hidden = false;
      const vacio = document.createElement("p");
      vacio.className = "searchresults__empty mono";
      vacio.textContent = "No encontramos esa dirección. Muévete en el mapa hasta tu casa.";
      caja.appendChild(vacio);
      return;
    }
    lista.slice(0, 5).forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "searchresults__item";
      b.textContent = r.display_name;
      b.addEventListener("click", () => {
        irA(parseFloat(r.lat), parseFloat(r.lon), r.display_name.split(",").slice(0, 3).join(",").trim());
        caja.hidden = true;
        $("inx-buscar").value = "";
      });
      caja.appendChild(b);
    });
    caja.hidden = false;
  }

  function buscar() {
    const q = $("inx-buscar").value.trim();
    if (q.length < 3) return;
    const btn = $("inx-buscar-btn");
    btn.disabled = true;
    btn.textContent = "Buscando…";
    // Sesga la búsqueda a Imbabura sin excluir el resto del país.
    fetch(NOMINATIM + "/search?format=jsonv2&limit=6&countrycodes=ec&accept-language=es" +
          "&viewbox=-78.75,0.75,-77.85,0.05&bounded=0&q=" + encodeURIComponent(q))
      .then((r) => (r.ok ? r.json() : []))
      .then(pintarResultados)
      .catch(() => pintarResultados([]))
      .finally(() => { btn.disabled = false; btn.textContent = "Buscar"; });
  }

  function miUbicacion() {
    const btn = $("inx-geo");
    if (!navigator.geolocation) {
      btn.textContent = "Tu navegador no comparte la ubicación";
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        irA(pos.coords.latitude, pos.coords.longitude);
        btn.disabled = false;
        btn.innerHTML = original;
      },
      () => {
        btn.disabled = false;
        btn.textContent = "No pudimos obtenerla. Búscala o muévete en el mapa";
        setTimeout(() => { btn.innerHTML = original; }, 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function iniciar() {
    const lienzo = $("inx-mapa");
    if (!lienzo || typeof L === "undefined") return;

    map = L.map(lienzo, { zoomControl: true, scrollWheelZoom: false })
      .setView(OTAVALO, ZOOM_INICIAL);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);

    map.on("moveend", centroCambiado);
    $("inx-buscar-btn").addEventListener("click", buscar);
    $("inx-buscar").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); buscar(); }
    });
    $("inx-geo").addEventListener("click", miUbicacion);
    $("inx-ref").addEventListener("input", (e) => {
      elegido.referencia = e.target.value;
      emitir();
    });

    // El mapa arranca dentro de un panel que puede estar oculto o recién montado.
    setTimeout(() => map.invalidateSize(), 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  return {
    alElegir(fn) { listeners.push(fn); },
    valor() { return { ...elegido }; },
    limpiar() {
      elegido.lat = null; elegido.lng = null; elegido.direccion = ""; elegido.referencia = "";
      const ref = $("inx-ref"); if (ref) ref.value = "";
      const res = $("inx-resultados"); if (res) res.hidden = true;
      pintarElegido();
      if (map) map.setView(OTAVALO, ZOOM_INICIAL);
      emitir();
    },
    enlaceMapa() {
      if (elegido.lat === null) return "";
      return "https://maps.google.com/?q=" + fmtCoord(elegido.lat) + "," + fmtCoord(elegido.lng);
    },
  };
})();
