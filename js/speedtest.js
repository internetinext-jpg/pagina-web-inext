/* Prueba de velocidad INEXT — medición real contra los servidores públicos de Cloudflare.
   Usa varias conexiones TCP en paralelo, porque un solo stream no satura un enlace de gigabit
   y el resultado saldría muy por debajo de la velocidad contratada. */
(() => {
  "use strict";

  const DOWN = "https://speed.cloudflare.com/__down";
  const UP = "https://speed.cloudflare.com/__up";
  const WA = "593969093580";

  const CFG = {
    pingSamples: 14,
    pingWarmup: 2,
    downStreams: 6,
    downChunk: 60 * 1024 * 1024,
    downMs: 10000,
    downCap: 3.0e9,
    upStreams: 4,
    upChunk: 24 * 1024 * 1024,
    upMs: 9000,
    upCap: 1.5e9,
    sampleMs: 100,
    warmupMs: 2000,
    loadedPingMs: 350,
    percentile: 0.9,
  };

  // Escala del velocímetro: tramos de igual arco, para que 20 Mbps y 1.5 Gbps
  // se lean bien en la misma esfera.
  const STOPS = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2000];
  const ARC_LEN = 706.9;
  const R_ARC = 150;

  const $ = (id) => document.getElementById(id);
  const el = {
    gauge: $("gauge-wrap"), arc: $("g-arc"), ticks: $("g-ticks"), tip: $("g-tip"),
    phase: $("phase"), value: $("value"), unitArrow: $("unit-arrow"),
    start: $("start"), again: $("again"), steps: $("steps"), progress: $("progress"),
    dlValue: $("dl-value"), dlPeak: $("dl-peak"), dlData: $("dl-data"),
    ulValue: $("ul-value"), ulPeak: $("ul-peak"), ulData: $("ul-data"),
    dlSparkLine: $("dl-spark-line"), dlSparkArea: $("dl-spark-area"),
    ulSparkLine: $("ul-spark-line"), ulSparkArea: $("ul-spark-area"),
    ping: $("ping"), jitter: $("jitter"), latDl: $("lat-dl"), latUl: $("lat-ul"),
    loss: $("loss"), grade: $("grade"), gradeCard: $("grade-card"), gradeNote: $("grade-note"),
    chartDlLine: $("chart-dl-line"), chartDlArea: $("chart-dl-area"),
    chartUlLine: $("chart-ul-line"), chartUlArea: $("chart-ul-area"),
    chartMax: $("chart-max"), tabChart: $("tab-chart"), tabLog: $("tab-log"),
    viewChart: $("view-chart"), viewLog: $("view-log"), log: $("log"),
    cIsp: $("c-isp"), cIp: $("c-ip"), cLoc: $("c-loc"), cServer: $("c-server"),
    quality: $("quality"), qgrid: $("qgrid"), detail: $("detail"), reading: $("reading"),
    history: $("history"), historyList: $("history-list"), note: $("note"),
  };

  const state = {
    fase: "idle",
    dl: 0, ul: 0, dlPeak: 0, ulPeak: 0,
    dlBytes: 0, ulBytes: 0,
    ping: 0, jitter: 0, latDl: 0, latUl: 0,
    loss: null, tcpRtt: 0, grade: "",
    dlSamples: [], ulSamples: [],
    tcp: new Map(),
    started: 0, duracion: 0,
    conn: { isp: "", ip: "", city: "", region: "", country: "", colo: "", asn: "" },
    historial: [],
    real: null,
  };

  /* ── utilidades ── */
  const rand = () => Math.random().toString(36).slice(2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fmt(v) {
    if (!v) return "—";
    if (v >= 1000) return v.toFixed(0);
    if (v >= 100) return v.toFixed(1);
    return v.toFixed(2);
  }
  function fmtLive(v) {
    return v >= 100 ? v.toFixed(0) : v.toFixed(1);
  }
  function fmtBytes(b) {
    if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB";
    if (b >= 1e6) return (b / 1e6).toFixed(0) + " MB";
    return (b / 1e3).toFixed(0) + " kB";
  }
  function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[clamp(Math.ceil(p * s.length) - 1, 0, s.length - 1)];
  }
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Media móvil: las muestras de 100 ms son muy dentadas porque los 6 streams
  // entregan a ráfagas. Suavizarlas antes del percentil evita inflar el resultado.
  function smoothSeries(vals, k) {
    if (vals.length <= k || k < 2) return vals.slice();
    const out = [];
    let sum = 0;
    for (let i = 0; i < vals.length; i++) {
      sum += vals[i];
      if (i >= k) sum -= vals[i - k];
      if (i >= k - 1) out.push(sum / k);
    }
    return out;
  }

  // Velocidad sostenida: descarta el arranque de TCP y toma el percentil 90
  // de la serie suavizada, como hacen las pruebas profesionales.
  function computeSpeed(samples) {
    if (!samples.length) return { best: 0, peak: 0 };
    const t0 = samples[0].t;
    let usable = samples.filter((s) => s.t - t0 > CFG.warmupMs).map((s) => s.mbps);
    if (usable.length < 8) usable = samples.map((s) => s.mbps);
    const k = clamp(Math.floor(usable.length / 4), 1, 5);
    const sm = smoothSeries(usable, k);
    if (!sm.length) return { best: 0, peak: 0 };
    return { best: percentile(sm, CFG.percentile), peak: Math.max.apply(null, sm) };
  }

  /* Estadísticas TCP del propio servidor (cabecera Server-Timing "cfL4").
     Vienen del kernel de Cloudflare: paquetes enviados, perdidos y RTT real.
     Es la única forma de ver pérdida de paquetes de verdad desde el navegador. */
  function parseCfL4(headerValue) {
    const m = /cfL4;desc="([^"]+)"/.exec(headerValue || "");
    if (!m) return null;
    const q = new URLSearchParams(m[1].replace(/^\?/, ""));
    const num = (k) => (q.get(k) == null ? null : Number(q.get(k)));
    const cid = q.get("cid");
    if (!cid) return null;
    return { cid, minRtt: num("min_rtt"), sent: num("sent"), lost: num("lost"), retrans: num("retrans") };
  }

  function recordTcp(res) {
    try {
      const s = parseCfL4(res.headers.get("server-timing"));
      if (!s || !s.sent) return;
      // Los contadores son acumulativos por conexión: guarda la lectura más alta.
      const prev = state.tcp.get(s.cid);
      if (!prev || s.sent > prev.sent) state.tcp.set(s.cid, s);
    } catch (e) { /* la cabecera puede no estar expuesta */ }
  }

  function tcpSummary() {
    let sent = 0, lost = 0, retrans = 0;
    const rtts = [];
    state.tcp.forEach((s) => {
      sent += s.sent || 0;
      lost += s.lost || 0;
      retrans += s.retrans || 0;
      // Una conexión recién abierta reporta un min_rtt sin asentar: la mediana
      // entre conexiones evita que ese valor atípico mande.
      if (s.minRtt && s.minRtt > 1000) rtts.push(s.minRtt);
    });
    if (!sent) return null;
    const perdidos = Math.max(lost, retrans);
    return {
      loss: (perdidos / sent) * 100,
      rtt: rtts.length ? Math.round(median(rtts) / 1000) : 0,
      sent: sent,
    };
  }

  // Bufferbloat: cuánto sube la latencia cuando la línea se llena. Es lo que
  // hace que una videollamada se corte aunque el "número grande" sea enorme.
  function gradeFor(deltaMs) {
    if (deltaMs < 5) return { g: "A+", t: "la latencia casi no se mueve" };
    if (deltaMs < 30) return { g: "A", t: "aguanta bien la carga" };
    if (deltaMs < 60) return { g: "B", t: "sube un poco al cargarse" };
    if (deltaMs < 150) return { g: "C", t: "se nota en videollamadas" };
    if (deltaMs < 400) return { g: "D", t: "el router se satura" };
    return { g: "F", t: "bufferbloat severo" };
  }

  function speedToFrac(v) {
    if (v <= 0) return 0;
    const last = STOPS.length - 1;
    if (v >= STOPS[last]) return 1;
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i]) {
        const within = (v - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]);
        return (i - 1 + within) / last;
      }
    }
    return 1;
  }

  function polar(frac, radius) {
    const deg = 135 + 270 * frac;
    const rad = (deg * Math.PI) / 180;
    return { x: 200 + radius * Math.cos(rad), y: 200 + radius * Math.sin(rad) };
  }

  function log(text) {
    const hora = new Date().toLocaleTimeString("es-EC", { hour12: false });
    const line = document.createElement("div");
    line.className = "log__line";
    line.textContent = hora + "  " + text;
    if (el.log.firstElementChild && el.log.children.length === 1 &&
        el.log.firstElementChild.textContent.indexOf("esperando") === 0) {
      el.log.innerHTML = "";
    }
    el.log.appendChild(line);
    el.log.scrollTop = el.log.scrollHeight;
  }

  /* ── velocímetro ── */
  function drawTicks() {
    const ns = "http://www.w3.org/2000/svg";
    STOPS.forEach((stop) => {
      const frac = speedToFrac(stop);
      const a = polar(frac, R_ARC + 10);
      const b = polar(frac, R_ARC + 18);
      const t = polar(frac, R_ARC + 31);
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", a.x.toFixed(1)); line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", b.x.toFixed(1)); line.setAttribute("y2", b.y.toFixed(1));
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", t.x.toFixed(1)); label.setAttribute("y", t.y.toFixed(1));
      label.textContent = stop >= 1000 ? stop / 1000 + "G" : String(stop);
      el.ticks.appendChild(line);
      el.ticks.appendChild(label);
    });
  }

  let shown = 0;
  function setGauge(v, immediate) {
    shown = immediate ? v : shown * 0.7 + v * 0.3;
    const frac = speedToFrac(shown);
    el.arc.style.strokeDashoffset = String(ARC_LEN * (1 - frac));
    const p = polar(frac, R_ARC);
    el.tip.setAttribute("cx", p.x.toFixed(1));
    el.tip.setAttribute("cy", p.y.toFixed(1));
    el.value.textContent = fmtLive(shown);
  }

  function setPhase(key, texto) {
    state.fase = key;
    el.phase.textContent = texto;
    el.gauge.classList.toggle("is-live", key === "ping" || key === "download" || key === "upload");
    el.gauge.classList.toggle("is-up", key === "upload");
    el.unitArrow.textContent = key === "upload" ? "↑" : key === "download" ? "↓" : "";
    el.steps.querySelectorAll(".step").forEach((s) => {
      const order = ["ping", "download", "upload"];
      const mine = order.indexOf(s.dataset.step);
      const now = order.indexOf(key);
      s.classList.toggle("is-on", mine === now);
      s.classList.toggle("is-done", now > mine || key === "done");
    });
  }

  function setProgress(f) {
    el.progress.style.width = (clamp(f, 0, 1) * 100).toFixed(1) + "%";
  }

  /* ── curvas ── */
  function curve(points, width, height, closeIt) {
    if (points.length < 2) return "";
    let d = "M" + points[0][0].toFixed(1) + " " + points[0][1].toFixed(1);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)], p1 = points[i];
      const p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," + c2x.toFixed(1) + " " +
           c2y.toFixed(1) + "," + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    if (closeIt) d += " L" + width + " " + height + " L0 " + height + " Z";
    return d;
  }

  function drawSpark(samples, lineEl, areaEl) {
    if (samples.length < 2) { lineEl.setAttribute("d", ""); areaEl.setAttribute("d", ""); return; }
    const vals = samples.map((s) => s.mbps);
    // Escala por percentil: una sola ráfaga no debe aplastar toda la curva.
    const max = percentile(vals, 0.98) * 1.15 || 1;
    const n = vals.length - 1;
    const pts = vals.map((v, i) => [(i / n) * 260, clamp(44 - (v / max) * 40, 2, 44)]);
    lineEl.setAttribute("d", curve(pts, 260, 46, false));
    areaEl.setAttribute("d", curve(pts, 260, 46, true));
  }

  function drawChart() {
    const all = state.dlSamples.concat(state.ulSamples);
    if (!all.length) return;
    const max = percentile(all.map((s) => s.mbps), 0.98) * 1.15 || 1;
    const span = CFG.downMs + CFG.upMs + 2500;
    const t0 = state.chartT0 || 0;
    const toPoints = (samples) => samples.map((s) => [
      clamp((s.t - t0) / span, 0, 1) * 600,
      clamp(168 - (s.mbps / max) * 160, 4, 168),
    ]);
    const dl = toPoints(state.dlSamples);
    const ul = toPoints(state.ulSamples);
    el.chartDlLine.setAttribute("d", curve(dl, 600, 170, false));
    el.chartDlArea.setAttribute("d", curve(dl, 600, 170, true));
    el.chartUlLine.setAttribute("d", curve(ul, 600, 170, false));
    el.chartUlArea.setAttribute("d", curve(ul, 600, 170, true));
    el.chartMax.textContent = fmt(max);
  }

  /* ── datos de la conexión ── */
  const COLOS = {
    UIO: "Quito", GYE: "Guayaquil", BOG: "Bogotá", LIM: "Lima", SCL: "Santiago",
    PTY: "Panamá", MDE: "Medellín", MIA: "Miami", ATL: "Atlanta", DFW: "Dallas",
    LAX: "Los Ángeles", IAD: "Washington", EWR: "Newark", GRU: "São Paulo",
    EZE: "Buenos Aires", MEX: "Ciudad de México", QRO: "Querétaro", SJO: "San José",
  };

  async function loadConnInfo() {
    try {
      const res = await fetch(DOWN + "?bytes=1&r=" + rand(), { cache: "no-store" });
      const ip = res.headers.get("cf-meta-ip");
      const colo = res.headers.get("cf-meta-colo");
      const city = res.headers.get("cf-meta-city");
      if (ip) { state.conn.ip = ip; el.cIp.textContent = ip; }
      if (colo) {
        state.conn.colo = colo;
        el.cServer.textContent = "Cloudflare · " + (COLOS[colo] || colo);
      }
      if (city && !state.conn.city) state.conn.city = city;
    } catch (e) { /* sin conexión: se resuelve en el test */ }

    try {
      const r = await fetch("https://ipwho.is/", { cache: "no-store" });
      const d = await r.json();
      if (d && d.success) {
        const c = d.connection || {};
        state.conn.isp = c.isp || c.org || "";
        state.conn.asn = c.asn ? "AS" + c.asn : "";
        state.conn.city = d.city || state.conn.city;
        state.conn.region = d.region || "";
        state.conn.country = d.country || "";
        if (!state.conn.ip && d.ip) { state.conn.ip = d.ip; el.cIp.textContent = d.ip; }
      }
    } catch (e) { /* opcional */ }

    el.cIsp.textContent = state.conn.isp || "no disponible";
    const loc = [state.conn.city, state.conn.region, state.conn.country].filter(Boolean);
    el.cLoc.textContent = loc.length ? loc.join(", ") : "no disponible";
  }

  /* ── latencia ── */
  async function pingOnce(signal) {
    const t0 = performance.now();
    const res = await fetch(DOWN + "?bytes=1&r=" + rand(), { cache: "no-store", signal });
    const rtt = performance.now() - t0;
    recordTcp(res);
    return rtt;
  }

  async function measureIdleLatency() {
    setPhase("ping", "midiendo latencia");
    setGauge(0, true);
    const rtts = [];
    for (let i = 0; i < CFG.pingSamples; i++) {
      const rtt = await pingOnce();
      if (i >= CFG.pingWarmup) rtts.push(rtt);
      setProgress((i + 1) / CFG.pingSamples * 0.1);
      el.value.textContent = Math.round(rtt);
      el.phase.textContent = "midiendo latencia · " + (i + 1) + "/" + CFG.pingSamples;
    }
    const jitters = [];
    for (let i = 1; i < rtts.length; i++) jitters.push(Math.abs(rtts[i] - rtts[i - 1]));
    state.ping = Math.round(median(rtts));
    state.jitter = Math.round(median(jitters));
    el.ping.textContent = state.ping;
    el.jitter.textContent = state.jitter;
    log("latencia en reposo " + state.ping + " ms · jitter " + state.jitter + " ms");
  }

  /* ── muestreo compartido ── */
  function makeSampler(kind, deadline, opts) {
    const updateCard = !opts || opts.updateCard !== false;
    const bucket = { bytes: 0, lastBytes: 0, lastT: performance.now() };
    const samples = kind === "dl" ? state.dlSamples : state.ulSamples;
    const lat = [];
    let latTimer = 0;
    // Marca de bytes/tiempo al terminar el arranque: permite calcular el caudal
    // aunque el navegador estrangule los temporizadores (pestaña en segundo plano).
    const phaseStartT = performance.now();
    let warmBytes = null, warmT = 0;

    const timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - bucket.lastT) / 1000;
      if (dt <= 0) return;
      const delta = bucket.bytes - bucket.lastBytes;
      bucket.lastBytes = bucket.bytes;
      bucket.lastT = now;
      const mbps = (delta * 8) / dt / 1e6;
      if (warmBytes === null && now - phaseStartT >= CFG.warmupMs) {
        warmBytes = bucket.bytes;
        warmT = now;
      }
      samples.push({ t: now, mbps });
      setGauge(mbps);
      const res = computeSpeed(samples);
      if (kind === "dl") {
        state.dl = res.best;
        state.dlPeak = res.peak;
        state.dlBytes = bucket.bytes;
        el.dlValue.textContent = fmt(res.best);
        el.dlPeak.textContent = fmt(res.peak);
        el.dlData.textContent = fmtBytes(bucket.bytes);
        drawSpark(samples, el.dlSparkLine, el.dlSparkArea);
      } else {
        state.ulBytes = bucket.bytes;
        if (updateCard) {
          state.ul = res.best;
          state.ulPeak = res.peak;
          el.ulValue.textContent = fmt(res.best);
          el.ulPeak.textContent = fmt(res.peak);
        }
        el.ulData.textContent = fmtBytes(bucket.bytes);
        drawSpark(samples, el.ulSparkLine, el.ulSparkArea);
      }
      drawChart();
      const phaseStart = deadline.start;
      setProgress(deadline.base + clamp((now - phaseStart) / deadline.total, 0, 1) * deadline.share);
    }, CFG.sampleMs);

    // latencia con la línea cargada
    latTimer = setInterval(() => {
      pingOnce().then((rtt) => lat.push(rtt)).catch(() => {});
    }, CFG.loadedPingMs);

    return {
      onBytes: (n) => { bucket.bytes += n; },
      get bytes() { return bucket.bytes; },
      // Caudal sostenido medido por bytes acumulados, sin depender del muestreo.
      stableRate() {
        if (warmBytes === null) {
          const secs = (performance.now() - phaseStartT) / 1000;
          return secs > 0.5 ? (bucket.bytes * 8) / secs / 1e6 : 0;
        }
        const secs = (performance.now() - warmT) / 1000;
        return secs > 0.5 ? ((bucket.bytes - warmBytes) * 8) / secs / 1e6 : 0;
      },
      stop() {
        clearInterval(timer);
        clearInterval(latTimer);
        return lat.length ? Math.round(median(lat)) : 0;
      },
    };
  }

  /* ── descarga ── */
  async function downStream(signal, onBytes, limit) {
    while (!signal.aborted) {
      let res;
      try {
        res = await fetch(DOWN + "?bytes=" + CFG.downChunk + "&r=" + rand(), { cache: "no-store", signal });
      } catch (e) { return; }
      recordTcp(res);
      if (!res.body || !res.body.getReader) throw new Error("sin streaming");
      const reader = res.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onBytes(value.length);
          if (signal.aborted || limit()) { try { reader.cancel(); } catch (e) {} return; }
        }
      } catch (e) { return; }
    }
  }

  async function measureDownload() {
    setPhase("download", "midiendo descarga");
    setGauge(0, true);
    state.chartT0 = performance.now();
    const ctrl = new AbortController();
    const sampler = makeSampler("dl", { start: performance.now(), total: CFG.downMs, base: 0.1, share: 0.5 });
    const limit = () => sampler.bytes > CFG.downCap;
    log("descarga · " + CFG.downStreams + " conexiones en paralelo");

    const timeout = setTimeout(() => ctrl.abort(), CFG.downMs);
    const streams = [];
    for (let i = 0; i < CFG.downStreams; i++) streams.push(downStream(ctrl.signal, sampler.onBytes, limit));
    const capWatch = setInterval(() => { if (limit()) ctrl.abort(); }, 200);

    await Promise.allSettled(streams);
    clearTimeout(timeout);
    clearInterval(capWatch);
    ctrl.abort();
    state.latDl = sampler.stop();
    el.latDl.textContent = state.latDl || "—";

    const res = computeSpeed(state.dlSamples);
    const stable = sampler.stableRate();
    // Con pocas muestras (pestaña en segundo plano) el percentil no es fiable:
    // se usa el promedio sostenido, que solo depende de bytes y reloj.
    state.dl = state.dlSamples.length >= 20 ? res.best : (stable || res.best);
    state.dlPeak = Math.max(res.peak, state.dl);
    state.dlBytes = sampler.bytes;
    el.dlValue.textContent = fmt(state.dl);
    el.dlPeak.textContent = fmt(state.dlPeak);
    el.dlData.textContent = fmtBytes(state.dlBytes);
    log("descarga " + fmt(state.dl) + " Mbps · pico " + fmt(state.dlPeak) +
        " · " + fmtBytes(state.dlBytes) + " · latencia cargada " + state.latDl + " ms");

    const tcp = tcpSummary();
    if (tcp) {
      state.loss = tcp.loss;
      state.tcpRtt = tcp.rtt;
      el.loss.textContent = tcp.loss < 0.01 ? "0" : tcp.loss.toFixed(2);
      log("TCP · " + tcp.sent + " paquetes · pérdida " + tcp.loss.toFixed(2) +
          "% · RTT de red " + tcp.rtt + " ms");
    }
  }

  /* ── subida ── */
  function makePayload(size) {
    const buf = new Uint8Array(size);
    let x = 123456789;
    for (let i = 0; i < size; i += 4) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x |= 0;
      buf[i] = x & 255; buf[i + 1] = (x >> 8) & 255;
      buf[i + 2] = (x >> 16) & 255; buf[i + 3] = (x >> 24) & 255;
    }
    return buf;
  }

  function upOnce(payload, onBytes, xhrs, onComplete) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrs.push(xhr);
      let last = 0;
      xhr.upload.onprogress = (e) => {
        const d = e.loaded - last;
        last = e.loaded;
        if (d > 0) onBytes(d);
      };
      // Solo cuenta para la cifra final cuando el servidor respondió: onprogress
      // marca los bytes que el navegador metió al socket, no los que llegaron.
      xhr.onload = () => { onComplete(payload.byteLength); resolve(); };
      const fail = () => resolve();
      xhr.onerror = fail; xhr.onabort = fail; xhr.ontimeout = fail;
      xhr.open("POST", UP + "?r=" + rand(), true);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(payload);
    });
  }

  // Caudal real de subida: bytes de peticiones completadas agrupados en
  // ventanas de 1 s, descartando el arranque y la ventana final incompleta.
  function uploadRates(completions, winStart, now) {
    const buckets = new Map();
    completions.forEach((c) => {
      if (c.t <= winStart) return;
      const b = Math.floor((c.t - winStart) / 1000);
      buckets.set(b, (buckets.get(b) || 0) + c.bytes);
    });
    const lastBucket = Math.floor((now - winStart) / 1000);
    const rates = [];
    buckets.forEach((bytes, b) => {
      if (b < lastBucket) rates.push((bytes * 8) / 1e6);
    });
    return rates;
  }

  async function measureUpload() {
    setPhase("upload", "midiendo subida");
    setGauge(0, true);
    // Trozos dimensionados para que cada envío dure ~0.6 s en esta conexión:
    // así hay suficientes completados para medir, sin castigar enlaces lentos.
    const estUp = Math.max(2, state.dl * 0.15);
    const chunk = Math.round(clamp((estUp / 8) * 1e6 * 0.6, 512 * 1024, 12 * 1024 * 1024));
    const payload = makePayload(chunk);
    const phaseStart = performance.now();
    const winStart = phaseStart + CFG.warmupMs;
    const completions = [];
    const onComplete = (bytes) => { completions.push({ t: performance.now(), bytes }); };
    const sampler = makeSampler("ul", { start: phaseStart, total: CFG.upMs, base: 0.6, share: 0.4 },
      { updateCard: false });
    const xhrs = [];
    let stop = false;
    log("subida · " + CFG.upStreams + " conexiones · trozos de " + fmtBytes(chunk));

    const liveTimer = setInterval(() => {
      const rates = uploadRates(completions, winStart, performance.now());
      if (rates.length >= 1) {
        state.ul = percentile(rates, CFG.percentile);
        state.ulPeak = Math.max.apply(null, rates);
        el.ulValue.textContent = fmt(state.ul);
        el.ulPeak.textContent = fmt(state.ulPeak);
      }
    }, 500);

    const deadline = setTimeout(() => {
      stop = true;
      xhrs.forEach((x) => { try { x.abort(); } catch (e) {} });
    }, CFG.upMs);
    const capWatch = setInterval(() => {
      if (sampler.bytes > CFG.upCap) {
        stop = true;
        xhrs.forEach((x) => { try { x.abort(); } catch (e) {} });
      }
    }, 200);

    async function loop() {
      while (!stop) await upOnce(payload, sampler.onBytes, xhrs, onComplete);
    }
    const runners = [];
    for (let i = 0; i < CFG.upStreams; i++) runners.push(loop());
    await Promise.allSettled(runners);
    clearTimeout(deadline);
    clearInterval(capWatch);
    clearInterval(liveTimer);
    state.latUl = sampler.stop();
    el.latUl.textContent = state.latUl || "—";

    const rates = uploadRates(completions, winStart, performance.now());
    if (rates.length >= 2) {
      state.ul = percentile(rates, CFG.percentile);
      state.ulPeak = Math.max.apply(null, rates);
    } else if (completions.length) {
      const bytes = completions.reduce((a, c) => a + c.bytes, 0);
      const secs = (completions[completions.length - 1].t - phaseStart) / 1000;
      state.ul = secs > 0 ? (bytes * 8) / secs / 1e6 : 0;
      state.ulPeak = state.ul;
    } else {
      const res = computeSpeed(state.ulSamples);
      state.ul = res.best;
      state.ulPeak = res.peak;
    }
    state.ulBytes = sampler.bytes;
    el.ulValue.textContent = fmt(state.ul);
    el.ulPeak.textContent = fmt(state.ulPeak);
    el.ulData.textContent = fmtBytes(state.ulBytes);
    log("subida " + fmt(state.ul) + " Mbps · pico " + fmt(state.ulPeak) +
        " · " + fmtBytes(state.ulBytes) + " · latencia cargada " + state.latUl + " ms");
  }

  /* ── lectura de resultados ── */
  const ICONS = {
    video: '<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>',
    tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    game: '<rect x="2" y="6" width="20" height="12" rx="5"/><path d="M6.5 12h3.5M8.25 10.25v3.5"/><circle cx="16" cy="11" r="1.1"/><circle cx="18.4" cy="13.4" r="1.1"/>',
    work: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9.4 15.6a3.6 3.6 0 0 1 5.2 0"/>',
    upload: '<path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  };

  const USOS = [
    { name: "Videollamadas", icon: "video", need: (s) => Math.min(s.dl / 4, s.ul / 3), lat: 150,
      note: (s) => s.ul >= 3 ? "subida suficiente" : "subida justa" },
    { name: "Streaming 4K", icon: "tv", need: (s) => s.dl / 25, lat: 400,
      note: () => "25 Mbps por pantalla" },
    { name: "Juegos en línea", icon: "game", need: (s) => s.dl / 15, lat: 60,
      note: (s) => "ping " + s.ping + " ms" },
    { name: "Teletrabajo", icon: "work", need: (s) => Math.min(s.dl / 50, s.ul / 10), lat: 120,
      note: () => "varias personas a la vez" },
    { name: "Toda la casa", icon: "home", need: (s) => s.dl / 100, lat: 200,
      note: () => "6+ dispositivos" },
    { name: "Subir archivos", icon: "upload", need: (s) => s.ul / 25, lat: 500,
      note: (s) => fmt(s.ul) + " Mbps de subida" },
  ];

  function ratingFor(uso) {
    const ratio = uso.need(state);
    const lat = Math.max(state.latDl, state.ping);
    let level = ratio >= 3 ? 5 : ratio >= 1.6 ? 4 : ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;
    if (lat > uso.lat) level = Math.max(1, level - 1);
    return level;
  }

  function renderQuality() {
    el.quality.hidden = false;
    el.qgrid.innerHTML = "";
    USOS.forEach((uso) => {
      const level = ratingFor(uso);
      const card = document.createElement("article");
      card.className = "qcard";
      card.dataset.level = String(level);
      const dots = Array.from({ length: 5 }, (_, i) =>
        '<span class="dot' + (i < level ? " is-on" : "") + '"></span>').join("");
      card.innerHTML =
        '<div class="qcard__top">' +
        '<svg class="qcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONS[uso.icon] + "</svg>" +
        '<span class="qcard__name"></span></div>' +
        '<div class="qcard__dots">' + dots + "</div>" +
        '<p class="qcard__note"></p>';
      card.querySelector(".qcard__name").textContent = uso.name;
      card.querySelector(".qcard__note").textContent = uso.note(state);
      el.qgrid.appendChild(card);
    });
  }

  function renderDetail() {
    const rows = [
      ["servidor", "Cloudflare" + (state.conn.colo ? " · " + (COLOS[state.conn.colo] || state.conn.colo) : "")],
      ["método", state.real === false ? "sin conexión al servidor" : CFG.downStreams + " conexiones paralelas · percentil 90"],
      ["descarga", state.dl ? fmt(state.dl) + " Mbps" : "—"],
      ["pico de descarga", state.dlPeak ? fmt(state.dlPeak) + " Mbps" : "—"],
      ["subida", state.ul ? fmt(state.ul) + " Mbps" : "—"],
      ["pico de subida", state.ulPeak ? fmt(state.ulPeak) + " Mbps" : "—"],
      ["latencia en reposo", state.ping ? state.ping + " ms" : "—"],
      ["jitter", state.jitter ? state.jitter + " ms" : "—"],
      ["latencia con descarga", state.latDl ? state.latDl + " ms" : "—"],
      ["latencia con subida", state.latUl ? state.latUl + " ms" : "—"],
      ["estabilidad bajo carga", state.grade || "—"],
      ["pérdida bajo carga", state.loss === null ? "no disponible" : (state.loss < 0.01 ? "0" : state.loss.toFixed(2)) + " % de paquetes"],
      ["RTT de red (TCP)", state.tcpRtt ? state.tcpRtt + " ms" : "—"],
      ["proveedor", (state.conn.isp || "—") + (state.conn.asn ? " · " + state.conn.asn : "")],
      ["ubicación", [state.conn.city, state.conn.country].filter(Boolean).join(", ") || "—"],
      ["datos transferidos", fmtBytes(state.dlBytes + state.ulBytes)],
      ["muestras", String(state.dlSamples.length + state.ulSamples.length)],
      ["duración", state.duracion ? state.duracion.toFixed(1) + " s" : "—"],
    ];
    el.detail.innerHTML = rows.map((r) =>
      '<div class="detail__row"><span class="detail__k"></span><span class="detail__v"></span></div>').join("");
    el.detail.querySelectorAll(".detail__row").forEach((row, i) => {
      row.querySelector(".detail__k").textContent = rows[i][0];
      row.querySelector(".detail__v").textContent = rows[i][1];
    });
  }

  function readingText() {
    const d = state.dl, lat = state.latDl || state.ping;
    let base;
    if (d < 10) base = "Con menos de 10 Mbps una sola videollamada ya deja sin internet al resto de la casa. Es el rango típico del internet móvil en zona rural, y es justo donde Starlink cambia la vida.";
    else if (d < 40) base = "Alcanza para una casa tranquila, pero en la noche, cuando todos se conectan, vas a notar cortes en las videollamadas y pausas en el video.";
    else if (d < 100) base = "Buena conexión para trabajar y ver series. Una casa de cuatro personas funciona bien salvo en las horas de más demanda.";
    else if (d < 300) base = "Conexión sobrada: pantallas en 4K, videollamadas y juego en línea al mismo tiempo sin que nadie note al otro. Es el rango del plan Residencial.";
    else base = "Conexión de gama alta: " + fmt(d) + " Mbps aguantan varias pantallas en 4K, descargas grandes y toda la casa conectada sin que nadie se quede pegado.";
    if (lat && state.ping && lat > state.ping * 3 && lat > 120) {
      base += " Eso sí, la latencia sube a " + lat + " ms cuando la línea se llena: es la señal típica de un router que se satura y se siente en videollamadas y juegos.";
    }
    return base;
  }

  const HKEY = "inext-speedtest-historial";

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HKEY);
      if (raw) state.historial = JSON.parse(raw) || [];
    } catch (e) { state.historial = []; }
    if (state.historial.length) renderHistory();
  }

  function renderHistory() {
    el.history.hidden = false;
    el.historyList.innerHTML = state.historial.map(() =>
      '<div class="history__row"><span class="history__time"></span><span class="history__dl"></span>' +
      '<span class="history__ul"></span><span class="history__ping"></span></div>').join("");
    el.historyList.querySelectorAll(".history__row").forEach((row, i) => {
      const h = state.historial[i];
      row.querySelector(".history__time").textContent = (h.fecha ? h.fecha + " · " : "") + h.hora;
      row.querySelector(".history__dl").textContent = "↓ " + h.dl;
      row.querySelector(".history__ul").textContent = "↑ " + h.ul;
      row.querySelector(".history__ping").textContent = h.ping + " ms";
    });
  }

  function pushHistory() {
    const ahora = new Date();
    state.historial.unshift({
      fecha: ahora.toLocaleDateString("es-EC", { day: "2-digit", month: "short" }),
      hora: ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      dl: fmt(state.dl), ul: fmt(state.ul), ping: state.ping,
    });
    state.historial = state.historial.slice(0, 8);
    try { localStorage.setItem(HKEY, JSON.stringify(state.historial)); } catch (e) { /* modo privado */ }
    renderHistory();
  }

  function updateWaResult() {
    const loc = [state.conn.city, state.conn.country].filter(Boolean).join(", ");
    const msg = "Hola INEXT, hice la prueba de velocidad en su página.\n" +
      "Bajada: " + fmt(state.dl) + " Mbps\n" +
      "Subida: " + fmt(state.ul) + " Mbps\n" +
      "Ping: " + state.ping + " ms (jitter " + state.jitter + " ms)\n" +
      (state.loss !== null ? "Pérdida bajo carga: " + (state.loss < 0.01 ? "0" : state.loss.toFixed(2)) + " %\n" : "") +
      (state.grade ? "Estabilidad bajo carga: " + state.grade + "\n" : "") +
      (state.conn.isp ? "Proveedor actual: " + state.conn.isp + "\n" : "") +
      (loc ? "Ubicación: " + loc + "\n" : "") +
      "Quiero información sobre sus planes.";
    document.querySelectorAll(".js-wa-result").forEach((a) => {
      a.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg);
    });
  }

  /* ── ciclo principal ── */
  async function run() {
    if (state.fase !== "idle" && state.fase !== "done") return;
    el.start.hidden = true;
    el.again.hidden = true;
    el.gauge.classList.remove("is-idle");
    state.dl = 0; state.ul = 0; state.dlPeak = 0; state.ulPeak = 0;
    state.dlBytes = 0; state.ulBytes = 0; state.latDl = 0; state.latUl = 0;
    state.dlSamples = []; state.ulSamples = [];
    state.tcp = new Map(); state.loss = null; state.tcpRtt = 0; state.grade = "";
    state.started = Date.now();
    state.real = true;
    el.gradeCard.removeAttribute("data-grade");
    el.gradeNote.textContent = "bufferbloat";
    ["dlValue", "ulValue", "dlPeak", "ulPeak", "latDl", "latUl", "loss", "grade"].forEach((k) => { el[k].textContent = "—"; });
    el.dlData.textContent = "—"; el.ulData.textContent = "—";
    el.log.innerHTML = "";
    log("iniciando prueba");

    try {
      await measureIdleLatency();
      await measureDownload();
      await measureUpload();
    } catch (e) {
      state.real = false;
      log("error de red: " + (e && e.message ? e.message : e));
    }

    state.duracion = (Date.now() - state.started) / 1000;

    const cargada = Math.max(state.latDl, state.latUl);
    if (state.ping && cargada) {
      const g = gradeFor(cargada - state.ping);
      state.grade = g.g;
      el.grade.textContent = g.g;
      el.gradeCard.dataset.grade = g.g;
      el.gradeNote.textContent = g.t;
    }

    setPhase("done", "prueba completada");
    setProgress(1);
    setGauge(state.dl, true);
    el.value.textContent = fmtLive(state.dl);
    el.unitArrow.textContent = "↓";
    el.again.hidden = false;
    el.dlValue.textContent = fmt(state.dl);
    el.ulValue.textContent = fmt(state.ul);
    renderQuality();
    renderDetail();
    el.reading.textContent = state.real === false
      ? "No se pudo completar la medición contra el servidor. Revisa tu conexión y vuelve a intentarlo."
      : readingText();
    if (state.real === false) {
      el.note.textContent = "No se pudo alcanzar el servidor de medición. Revisa tu conexión a internet y repite la prueba.";
    }
    pushHistory();
    updateWaResult();
    log("prueba finalizada en " + state.duracion.toFixed(1) + " s");
  }

  /* ── arranque ── */
  drawTicks();
  setGauge(0, true);
  loadConnInfo();
  loadHistory();
  updateWaResult();

  const generic = "https://wa.me/" + WA + "?text=" +
    encodeURIComponent("Hola INEXT, quiero información sobre internet satelital Starlink.");
  document.querySelectorAll(".js-wa").forEach((a) => { a.href = generic; });

  el.start.addEventListener("click", run);
  el.again.addEventListener("click", run);
  el.tabChart.addEventListener("click", () => {
    el.tabChart.classList.add("is-on"); el.tabLog.classList.remove("is-on");
    el.viewChart.hidden = false; el.viewLog.hidden = true;
  });
  el.tabLog.addEventListener("click", () => {
    el.tabLog.classList.add("is-on"); el.tabChart.classList.remove("is-on");
    el.viewLog.hidden = false; el.viewChart.hidden = true;
  });
})();
