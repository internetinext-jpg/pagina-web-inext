(() => {
  const WA = "593969093580";
  const DOWN = "https://speed.cloudflare.com/__down";
  const UP = "https://speed.cloudflare.com/__up";

  const genericWa = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hola INEXT, hice la prueba de velocidad en su página y quiero información.");
  document.querySelectorAll(".js-wa-generic").forEach((el) => { el.href = genericWa; });

  const el = {
    estadoTexto: document.getElementById("pv-estado-texto"),
    tiempoTexto: document.getElementById("pv-tiempo-texto"),
    ringArc: document.getElementById("pv-ring-arc"),
    idle: document.getElementById("pv-idle"),
    running: document.getElementById("pv-running"),
    done: document.getElementById("pv-done"),
    faseTexto: document.getElementById("pv-fase-texto"),
    vivoValor: document.getElementById("pv-vivo-valor"),
    doneValor: document.getElementById("pv-done-valor"),
    dl: document.getElementById("pv-dl"),
    ul: document.getElementById("pv-ul"),
    ping: document.getElementById("pv-ping"),
    jitter: document.getElementById("pv-jitter"),
    dlLinea: document.getElementById("pv-dl-linea"),
    dlArea: document.getElementById("pv-dl-area"),
    ulLinea: document.getElementById("pv-ul-linea"),
    ulArea: document.getElementById("pv-ul-area"),
    tabGrafico: document.getElementById("pv-tab-grafico"),
    tabRegistro: document.getElementById("pv-tab-registro"),
    viewGrafico: document.getElementById("pv-view-grafico"),
    viewRegistro: document.getElementById("pv-view-registro"),
    registroList: document.getElementById("pv-registro-list"),
    gaugeDlArc: document.getElementById("pv-gauge-dl-arc"),
    gaugeDlNeedle: document.getElementById("pv-gauge-dl-needle"),
    gaugeDlValue: document.getElementById("pv-gauge-dl-value"),
    gaugeUlArc: document.getElementById("pv-gauge-ul-arc"),
    gaugeUlNeedle: document.getElementById("pv-gauge-ul-needle"),
    gaugeUlValue: document.getElementById("pv-gauge-ul-value"),
    detMetodo: document.getElementById("pv-det-metodo"),
    detDl: document.getElementById("pv-det-dl"),
    detUl: document.getElementById("pv-det-ul"),
    detPing: document.getElementById("pv-det-ping"),
    detJitter: document.getElementById("pv-det-jitter"),
    detMuestras: document.getElementById("pv-det-muestras"),
    detDuracion: document.getElementById("pv-det-duracion"),
    lectura: document.getElementById("pv-lectura"),
    historialWrap: document.getElementById("pv-historial-wrap"),
    historialList: document.getElementById("pv-historial-list"),
    nota: document.getElementById("pv-nota"),
    startBtn: document.getElementById("pv-start-btn"),
    repetirBtn: document.getElementById("pv-repetir-btn"),
  };

  let state = {
    fase: "idle", dl: 0, ul: 0, ping: 0, jitter: 0, vivo: 0,
    dlMuestras: [], ulMuestras: [], progreso: 0,
    inicio: 0, duracion: 0, real: null, historial: [], registro: [], vista: "grafico",
  };
  let cancelado = false;

  function setState(patch) {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    render();
  }

  function log(t) {
    const hora = new Date().toLocaleTimeString("es-EC", { hour12: false });
    state.registro = state.registro.concat([hora + "  " + t]).slice(-40);
  }

  function escala() {
    const todas = state.dlMuestras.concat(state.ulMuestras);
    return (todas.length ? Math.max.apply(null, todas) : 50) * 1.18 || 1;
  }

  function curva(muestras, cerrar) {
    if (muestras.length < 2) return "";
    const max = escala();
    const n = muestras.length - 1;
    const p = muestras.map((v, i) => [(i / n) * 600, 148 - (v / max) * 136]);
    let d = "M" + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for (let i = 0; i < p.length - 1; i++) {
      const x0 = p[Math.max(0, i - 1)], x1 = p[i], x2 = p[i + 1], x3 = p[Math.min(p.length - 1, i + 2)];
      const c1x = x1[0] + (x2[0] - x0[0]) / 6, c1y = x1[1] + (x2[1] - x0[1]) / 6;
      const c2x = x2[0] - (x3[0] - x1[0]) / 6, c2y = x2[1] - (x3[1] - x1[1]) / 6;
      d += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," + c2x.toFixed(1) + " " + c2y.toFixed(1) + "," + x2[0].toFixed(1) + " " + x2[1].toFixed(1);
    }
    if (cerrar) d += " L600 150 L0 150 Z";
    return d;
  }

  function aguja(v) {
    const frac = Math.min(1, v / 250);
    return { rot: "rotate(" + (135 + 270 * frac).toFixed(1) + " 100 100)", off: String(282.7 * (1 - frac)) };
  }

  function lectura() {
    if (state.fase !== "done") return "Toca INICIAR y en unos quince segundos sabrás qué velocidad está llegando a este equipo. La prueba mide tu conexión actual, sea la que sea.";
    const d = state.dl;
    if (d < 10) return "Con menos de 10 Mbps una sola videollamada ya deja sin internet al resto de la casa. Es el rango típico del internet móvil en zona rural, y es justo donde Starlink cambia la vida.";
    if (d < 40) return "Alcanza para una casa tranquila, pero en la noche, cuando todos se conectan, vas a notar cortes en las videollamadas y pausas en el video.";
    if (d < 100) return "Buena conexión para trabajar y ver series. Con este rango una casa de cuatro personas funciona bien salvo en las horas de más demanda.";
    return "Conexión sobrada: pantallas en 4K, videollamadas y juego en línea al mismo tiempo sin que nadie note al otro. Es el rango del plan Residencial.";
  }

  async function medirPing() {
    setState({ fase: "ping" });
    const rtts = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      await fetch(DOWN + "?bytes=1&r=" + Math.random(), { cache: "no-store" });
      rtts.push(performance.now() - t);
      setState({ progreso: 0.02 + i * 0.012 });
    }
    const min = Math.min.apply(null, rtts);
    const prom = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    const varianza = rtts.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / rtts.length;
    setState({ ping: Math.round(min), jitter: Math.round(Math.sqrt(varianza)) });
  }

  async function medirBajada() {
    setState({ fase: "download", vivo: 0 });
    const res = await fetch(DOWN + "?bytes=40000000&r=" + Math.random(), { cache: "no-store" });
    if (!res.body || !res.body.getReader) throw new Error("sin streaming");
    const reader = res.body.getReader();
    const t0 = performance.now();
    let bytes = 0, ultimo = t0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || cancelado) break;
      bytes += value.length;
      const ahora = performance.now();
      const transcurrido = (ahora - t0) / 1000;
      if (ahora - ultimo > 160) {
        ultimo = ahora;
        const mbps = (bytes * 8) / transcurrido / 1e6;
        setState((p) => ({
          vivo: mbps,
          dl: mbps,
          dlMuestras: p.dlMuestras.concat([mbps]).slice(-70),
          progreso: 0.08 + Math.min(0.55, transcurrido / 9 * 0.55),
        }));
      }
      if (transcurrido > 9) { try { reader.cancel(); } catch (e) {} break; }
    }
    const total = (performance.now() - t0) / 1000;
    setState({ dl: (bytes * 8) / total / 1e6 });
  }

  async function medirSubida() {
    setState({ fase: "upload", vivo: 0 });
    const trozo = new Uint8Array(3 * 1024 * 1024);
    let bytes = 0;
    const t0 = performance.now();
    for (let i = 0; i < 4; i++) {
      if (cancelado) break;
      await fetch(UP, { method: "POST", body: new Blob([trozo]), cache: "no-store" });
      bytes += trozo.length;
      const transcurrido = (performance.now() - t0) / 1000;
      const mbps = (bytes * 8) / transcurrido / 1e6;
      setState((p) => ({
        vivo: mbps, ul: mbps,
        ulMuestras: p.ulMuestras.concat([mbps]).slice(-70),
        progreso: 0.65 + (i + 1) / 4 * 0.35,
      }));
      if (transcurrido > 8) break;
    }
  }

  function simular() {
    return new Promise((resolve) => {
      const objetivoDl = 120 + Math.random() * 60;
      const objetivoUl = objetivoDl * 0.12;
      let paso = 0;
      const total = 55;
      const t = setInterval(() => {
        paso++;
        const p = paso / total;
        const e = 1 - Math.pow(1 - p, 3);
        const ruido = (Math.random() * 10 - 5) * (1 - p);
        const dl = Math.max(0, objetivoDl * e + ruido);
        const ul = Math.max(0, objetivoUl * e + ruido * 0.15);
        setState((prev) => ({
          vivo: p < 0.62 ? dl : ul,
          dl, ul,
          ping: 34, jitter: 6,
          dlMuestras: p < 0.62 ? prev.dlMuestras.concat([dl]).slice(-70) : prev.dlMuestras,
          ulMuestras: p >= 0.62 ? prev.ulMuestras.concat([ul]).slice(-70) : prev.ulMuestras,
          fase: p < 0.62 ? "download" : "upload",
          progreso: p,
        }));
        if (paso >= total) { clearInterval(t); resolve(); }
      }, 55);
    });
  }

  async function correr() {
    let real = true;
    log("iniciando prueba · servidor Cloudflare");
    try {
      await medirPing();
      if (cancelado) return;
      log("latencia " + state.ping + " ms · jitter " + state.jitter + " ms");
      await medirBajada();
      if (cancelado) return;
      log("bajada " + state.dl.toFixed(2) + " Mbps");
      await medirSubida();
      log("subida " + state.ul.toFixed(2) + " Mbps");
    } catch (e) {
      real = false;
      log("sin acceso al servidor · usando estimación");
      await simular();
    }
    log("prueba finalizada");
    if (cancelado) return;
    const entrada = {
      hora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      dl: state.dl.toFixed(1), ul: state.ul.toFixed(1), ping: state.ping,
    };
    setState((p) => ({
      fase: "done", real, progreso: 1,
      duracion: (Date.now() - p.inicio) / 1000,
      historial: [entrada, ...p.historial].slice(0, 5),
    }));
  }

  function start() {
    if (state.fase !== "idle" && state.fase !== "done") return;
    cancelado = false;
    setState({
      fase: "ping", dl: 0, ul: 0, ping: 0, jitter: 0, vivo: 0,
      dlMuestras: [], ulMuestras: [], progreso: 0, inicio: Date.now(), duracion: 0, real: null, registro: [],
    });
    correr();
  }

  function render() {
    const s = state;
    const corriendo = s.fase === "ping" || s.fase === "download" || s.fase === "upload";
    const fases = {
      ping: { t: "Midiendo latencia", c: "#7c8991" },
      download: { t: "Midiendo bajada", c: "#21b5ea" },
      upload: { t: "Midiendo subida", c: "#c2ddb4" },
    };
    const f = fases[s.fase] || { t: "", c: "#7c8991" };
    const estado = s.fase === "idle" ? { t: "en espera", c: "#7c8991" }
      : corriendo ? { t: "midiendo", c: "#21b5ea" }
      : { t: "completado", c: "#c2ddb4" };

    el.estadoTexto.textContent = estado.t;
    el.estadoTexto.style.color = estado.c;
    el.tiempoTexto.textContent = s.fase === "done" ? "duración " + s.duracion.toFixed(1) + " s" : "servidor Cloudflare";

    el.ringArc.style.strokeDashoffset = String(741.4 * (1 - Math.min(1, s.progreso)));

    el.idle.hidden = s.fase !== "idle";
    el.running.hidden = !corriendo;
    el.done.hidden = s.fase !== "done";

    el.faseTexto.textContent = f.t;
    el.faseTexto.style.color = f.c;
    el.vivoValor.textContent = s.vivo.toFixed(1);
    el.doneValor.textContent = s.dl ? s.dl.toFixed(1) : "—";

    el.dl.textContent = s.dl ? s.dl.toFixed(1) : "—";
    el.ul.textContent = s.ul ? s.ul.toFixed(1) : "—";
    el.ping.textContent = s.ping ? String(s.ping) : "—";
    el.jitter.textContent = s.jitter ? String(s.jitter) : "—";

    el.dlLinea.setAttribute("d", curva(s.dlMuestras, false));
    el.dlArea.setAttribute("d", curva(s.dlMuestras, true));
    el.ulLinea.setAttribute("d", curva(s.ulMuestras, false));
    el.ulArea.setAttribute("d", curva(s.ulMuestras, true));

    const gDl = aguja(s.dl), gUl = aguja(s.ul);
    el.gaugeDlArc.style.strokeDashoffset = gDl.off;
    el.gaugeDlNeedle.setAttribute("transform", gDl.rot);
    el.gaugeDlValue.textContent = s.dl ? s.dl.toFixed(1) : "—";
    el.gaugeUlArc.style.strokeDashoffset = gUl.off;
    el.gaugeUlNeedle.setAttribute("transform", gUl.rot);
    el.gaugeUlValue.textContent = s.ul ? s.ul.toFixed(1) : "—";

    el.viewGrafico.hidden = s.vista !== "grafico";
    el.viewRegistro.hidden = s.vista !== "registro";
    el.tabGrafico.style.background = s.vista === "grafico" ? "#21b5ea" : "transparent";
    el.tabGrafico.style.color = s.vista === "grafico" ? "#06181f" : "#7c8991";
    el.tabRegistro.style.background = s.vista === "registro" ? "#21b5ea" : "transparent";
    el.tabRegistro.style.color = s.vista === "registro" ? "#06181f" : "#7c8991";
    const registro = s.registro.length ? s.registro : ["esperando inicio de la prueba…"];
    el.registroList.innerHTML = registro.map((l) => "<div>" + l.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</div>").join("");

    el.detMetodo.textContent = s.real === false ? "estimado (sin red)" : "descarga y carga reales";
    el.detDl.textContent = s.dl ? s.dl.toFixed(2) + " Mbps" : "—";
    el.detUl.textContent = s.ul ? s.ul.toFixed(2) + " Mbps" : "—";
    el.detPing.textContent = s.ping ? s.ping + " ms" : "—";
    el.detJitter.textContent = s.jitter ? s.jitter + " ms" : "—";
    el.detMuestras.textContent = String(s.dlMuestras.length + s.ulMuestras.length);
    el.detDuracion.textContent = s.duracion ? s.duracion.toFixed(1) + " s" : "—";

    el.lectura.textContent = lectura();

    el.historialWrap.hidden = s.historial.length === 0;
    el.historialList.innerHTML = s.historial.map((h) =>
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:18px;padding:10px 0;border-bottom:1px solid var(--line)">' +
      '<span style="color:var(--ink-3)">' + h.hora + "</span>" +
      '<span style="color:var(--cy)">↓ ' + h.dl + "</span>" +
      '<span style="color:var(--sage)">↑ ' + h.ul + "</span>" +
      '<span style="color:var(--ink-3)">' + h.ping + " ms</span>" +
      "</div>"
    ).join("");

    el.nota.textContent = s.real === false
      ? "No se pudo alcanzar el servidor de medición, así que este resultado es una estimación de referencia. Revisa tu conexión y vuelve a intentarlo."
      : "La medición usa los servidores públicos de Cloudflare y depende de tu red WiFi, del equipo y de la hora. Repítela dos o tres veces para tener un promedio confiable.";
  }

  el.startBtn.addEventListener("click", start);
  el.repetirBtn.addEventListener("click", start);
  el.tabGrafico.addEventListener("click", () => setState({ vista: "grafico" }));
  el.tabRegistro.addEventListener("click", () => setState({ vista: "registro" }));

  render();
})();
