(() => {
  const WA = "593969093580";
  const REFERRAL = "https://www.starlink.com/ec/residential?referral=RC-481067-34312-6";

  const USOS = {
    hogar: "La casa, nomás",
    teletrabajo: "Teletrabajo o clases",
    negocio: "Un negocio",
    finca: "Finca o hacienda",
  };

  const FAQS = [
    { q: "¿Funciona si no hay fibra ni antenas cerca?", a: "Sí. Starlink se conecta a satélites de órbita baja, no a la red de tu operadora. Lo único que necesita es vista despejada al cielo y luz eléctrica." },
    { q: "¿Cuánto me demoro en tener internet?", a: "Casi siempre 48 horas desde que confirmas. Coordinamos la visita, montamos la antena, activamos el plan y hacemos la prueba de velocidad contigo mirando." },
    { q: "¿Y cuando llueve fuerte?", a: "La antena es resistente al agua. En un aguacero muy fuerte la señal puede bajar unos segundos y se recupera sola. En la sierra pasa poco." },
    { q: "¿Tengo que firmar contrato de permanencia?", a: "No. El plan es mes a mes: lo puedes pausar, subir, bajar o cancelar desde tu cuenta, y nosotros te ayudamos a hacerlo si no te sientes cómodo con la app." },
    { q: "¿El equipo va aparte del plan mensual?", a: "Sí. El kit es un pago único desde $200 e incluye antena, router, soporte y cables. El plan mensual lo pagas directo a Starlink con tarjeta." },
    { q: "¿Puedo llevarme la antena a otro lado?", a: "El Kit Mini es portátil y lo mueves sin problema. Si te mudas de forma definitiva, actualizas la dirección del servicio y listo." },
    { q: "¿Sirve para videollamadas y para jugar en línea?", a: "Sí. La latencia típica va de 20 a 60 ms, parecida a una buena fibra, así que aguanta reuniones, clases y juegos sin que te saque." },
  ];

  const ACTIVIDADES = [
    { id: "k4", label: "Pantallas en 4K", need: 25, color: "#21b5ea" },
    { id: "juego", label: "Jugando en línea", need: 15, color: "#4cc6f0" },
    { id: "hd", label: "Netflix o YouTube en HD", need: 6, color: "#7fd4f4" },
    { id: "clase", label: "Clases en línea con cámara", need: 3.5, color: "#c2ddb4" },
    { id: "video", label: "Videollamadas de trabajo", need: 2.5, color: "#dcecd3" },
  ];

  function waLink(text) {
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
  }

  // Generic WhatsApp links (header, hero, CTA, footer)
  const genericWa = waLink("Hola INEXT, quiero información sobre internet satelital Starlink.");
  document.querySelectorAll(".js-wa-generic").forEach((el) => { el.href = genericWa; });

  /* ---------------- Coverage wizard ---------------- */
  (() => {
    const state = { step: 1, provincia: "", sector: "", uso: "", tamano: "", nombre: "", telefono: "" };

    const el = {
      header: document.getElementById("cw-header"),
      stepLabel: document.getElementById("cw-step-label"),
      progress: document.getElementById("cw-progress"),
      step1: document.getElementById("cw-step1"),
      step2: document.getElementById("cw-step2"),
      step3: document.getElementById("cw-step3"),
      done: document.getElementById("cw-done"),
      err1: document.getElementById("cw-err1"),
      err2: document.getElementById("cw-err2"),
      err3: document.getElementById("cw-err3"),
      prov: document.getElementById("inx-prov"),
      sector: document.getElementById("inx-loc"),
      nombre: document.getElementById("inx-nom"),
      telefono: document.getElementById("inx-tel"),
      destino: document.getElementById("cw-destino"),
      recPlan: document.getElementById("cw-rec-plan"),
      recPrecio: document.getElementById("cw-rec-precio"),
      recPorque: document.getElementById("cw-rec-porque"),
      waLink: document.getElementById("cw-wa-link"),
    };

    function setError(panelErr, msg) {
      [el.err1, el.err2, el.err3].forEach((p) => { p.hidden = true; p.textContent = ""; });
      if (msg) { panelErr.textContent = msg; panelErr.hidden = false; }
    }

    function validate() {
      if (state.step === 1) {
        if (!state.provincia) return "Elige tu provincia para seguir.";
        if (state.sector.trim().length < 3) return "Escribe tu cantón, parroquia o sector.";
      }
      if (state.step === 2) {
        if (!state.uso) return "Cuéntanos para qué lo vas a usar.";
        if (!state.tamano) return "Falta cuántas personas se conectan.";
      }
      if (state.step === 3) {
        if (state.nombre.trim().length < 3) return "Escribe tu nombre completo.";
        if (state.telefono.replace(/\D/g, "").length < 9) return "Revisa tu número de WhatsApp.";
      }
      return "";
    }

    function recommend() {
      const { uso, tamano } = state;
      if (uso === "hogar" && tamano === "1-3") {
        return { plan: "Residencial Lite", precio: "$40 al mes", porque: "Con pocas personas y uso normal de video y redes te alcanza de sobra, y es la opción más barata." };
      }
      if (uso === "negocio" || uso === "finca" || tamano === "7+") {
        return { plan: "Residencial con Kit Estándar", precio: "$45 al mes", porque: "Vas a tener varios equipos conectados todo el día, y el Kit Estándar aguanta mejor ese ritmo que el Mini." };
      }
      return { plan: "Residencial", precio: "$45 al mes", porque: "No baja la velocidad en hora pico, así que las videollamadas y las clases no se te cortan cuando todo el barrio se conecta." };
    }

    function render() {
      const s = state;
      el.header.hidden = s.step >= 4;
      el.step1.hidden = s.step !== 1;
      el.step2.hidden = s.step !== 2;
      el.step3.hidden = s.step !== 3;
      el.done.hidden = s.step < 4;

      el.stepLabel.textContent = Math.min(s.step, 3) + "/3";
      el.progress.style.width = (Math.min(s.step, 3) / 3 * 100) + "%";

      document.querySelectorAll("#cw-usos [data-uso]").forEach((btn) => {
        const on = btn.dataset.uso === s.uso;
        btn.style.background = on ? "#0f2f3d" : "#232c32";
        btn.style.borderColor = on ? "#21b5ea" : "#3a464d";
      });
      document.querySelectorAll("#cw-tamanos [data-tamano]").forEach((btn) => {
        const on = btn.dataset.tamano === s.tamano;
        btn.setAttribute("aria-pressed", String(on));
        btn.style.background = on ? "#0f2f3d" : "#232c32";
        btn.style.borderColor = on ? "#21b5ea" : "#3a464d";
      });

      if (s.step >= 4) {
        const destino = s.sector.trim() || s.provincia || "tu zona";
        const rec = recommend();
        const usoLabel = (USOS[s.uso] || "").toLowerCase();
        const msg = "Hola INEXT, soy " + s.nombre.trim() + ". Vivo en " + destino + ", " + s.provincia +
          ". Lo necesito para: " + usoLabel + ". Nos conectamos " + s.tamano + " personas. Mi WhatsApp es " +
          s.telefono + ". Me interesa el plan " + rec.plan + ".";
        el.destino.textContent = destino;
        el.recPlan.textContent = rec.plan;
        el.recPrecio.textContent = rec.precio;
        el.recPorque.textContent = rec.porque;
        el.waLink.href = waLink(msg);
      }
    }

    el.prov.addEventListener("change", (e) => { state.provincia = e.target.value; });
    el.sector.addEventListener("input", (e) => { state.sector = e.target.value; });
    el.nombre.addEventListener("input", (e) => { state.nombre = e.target.value; });
    el.telefono.addEventListener("input", (e) => { state.telefono = e.target.value; });

    document.querySelectorAll("#cw-usos [data-uso]").forEach((btn) => {
      btn.addEventListener("click", () => { state.uso = btn.dataset.uso; render(); });
    });
    document.querySelectorAll("#cw-tamanos [data-tamano]").forEach((btn) => {
      btn.addEventListener("click", () => { state.tamano = btn.dataset.tamano; render(); });
    });

    function goNext(errEl) {
      const err = validate();
      setError(errEl, err);
      if (err) return;
      state.step += 1;
      render();
    }
    document.getElementById("cw-next1").addEventListener("click", () => goNext(el.err1));
    document.getElementById("cw-next2").addEventListener("click", () => goNext(el.err2));
    document.getElementById("cw-next3").addEventListener("click", () => goNext(el.err3));
    document.getElementById("cw-back2").addEventListener("click", () => { state.step = 1; setError(el.err1, ""); render(); });
    document.getElementById("cw-back3").addEventListener("click", () => { state.step = 2; setError(el.err2, ""); render(); });
    document.getElementById("cw-reset").addEventListener("click", () => {
      state.step = 1; state.provincia = ""; state.sector = ""; state.uso = ""; state.tamano = ""; state.nombre = ""; state.telefono = "";
      el.prov.value = ""; el.sector.value = ""; el.nombre.value = ""; el.telefono.value = "";
      setError(el.err1, "");
      render();
    });

    render();
  })();

  /* ---------------- Speed test / load calculator ---------------- */
  (() => {
    const state = { mbps: 100, carga: { k4: 1, juego: 1, hd: 2, clase: 1, video: 1 } };

    const el = {
      gaugeArc: document.getElementById("gauge-arc"),
      gaugeNeedle: document.getElementById("gauge-needle"),
      shown: document.getElementById("mbps-shown"),
      shown2: document.getElementById("mbps-shown-2"),
      subida: document.getElementById("stat-subida"),
      ping: document.getElementById("stat-ping"),
      perdida: document.getElementById("stat-perdida"),
      range: document.getElementById("mbps-range"),
      presets: document.getElementById("mbps-presets"),
      veredicto: document.getElementById("veredicto"),
      estadoTexto: document.getElementById("estado-texto"),
      segmentsBar: document.getElementById("segments-bar"),
      marker: document.getElementById("speed-marker"),
      markerLabel: document.getElementById("speed-marker-label"),
      activitiesList: document.getElementById("activities-list"),
    };

    // Build activity rows once.
    ACTIVIDADES.forEach((a) => {
      const row = document.createElement("div");
      row.className = "activity-row";
      row.innerHTML =
        '<span class="activity-dot" style="background:' + a.color + '"></span>' +
        '<div><div class="activity-label">' + a.label + '</div><div class="activity-detail" data-detail></div></div>' +
        '<span class="activity-subtotal" data-subtotal></span>' +
        '<div class="activity-controls">' +
        '<button type="button" class="icon-btn" data-dec aria-label="Quitar uno">−</button>' +
        '<span class="activity-count" data-count></span>' +
        '<button type="button" class="icon-btn" data-inc aria-label="Agregar uno">+</button>' +
        "</div>";
      row.querySelector("[data-detail]").textContent = a.need + " Mbps cada una";
      row.querySelector("[data-dec]").addEventListener("click", () => bump(a.id, -1));
      row.querySelector("[data-inc]").addEventListener("click", () => bump(a.id, 1));
      row.dataset.id = a.id;
      el.activitiesList.appendChild(row);
    });

    function bump(id, d) {
      state.carga[id] = Math.max(0, Math.min(9, (state.carga[id] || 0) + d));
      render();
    }

    function totalCarga() {
      return ACTIVIDADES.reduce((t, a) => t + (state.carga[a.id] || 0) * a.need, 0);
    }

    function veredicto(total, libre) {
      const m = state.mbps;
      if (libre < 0) return "Con esta velocidad no alcanza: alguien se va a quedar pegado. Sube el plan o quita actividades.";
      if (libre < m * 0.2) return "Justo, justo. Funciona hoy, pero el día que alguien más se conecte vas a sentirlo.";
      if (m <= 120) return "Le sobra espacio a lo que tienes puesto. Este es el rango del plan Lite, que en hora pico puede bajar un poco.";
      return "Aquí ya nadie nota que hay otros conectados, y todavía te queda margen para lo que venga. Ese es el plan Residencial.";
    }

    function render() {
      const s = state;
      const shown = s.mbps;
      const total = totalCarga();
      const libre = s.mbps - total;
      const base = Math.max(s.mbps, total, 1);

      el.shown.textContent = shown;
      el.shown2.textContent = shown;
      el.gaugeArc.style.strokeDashoffset = String(494.8 * (1 - Math.min(1, shown / 250)));
      el.gaugeNeedle.setAttribute("transform", "rotate(" + (135 + 270 * Math.min(1, shown / 250)).toFixed(1) + " 150 150)");
      el.subida.textContent = Math.max(2, Math.round(shown * 0.11));
      el.ping.textContent = shown <= 15 ? 120 : shown <= 60 ? 55 : 27;
      el.perdida.textContent = shown <= 15 ? "3.4" : shown <= 60 ? "1.1" : "0.2";

      el.veredicto.textContent = veredicto(total, libre);
      el.estadoTexto.textContent = libre < 0
        ? "Te faltan " + Number((-libre).toFixed(1)) + " Mbps"
        : "Te sobran " + Number(libre.toFixed(1)) + " Mbps";
      el.estadoTexto.style.color = libre < 0 ? "#ffa79b" : "#c2ddb4";

      el.segmentsBar.innerHTML = "";
      ACTIVIDADES.filter((a) => (s.carga[a.id] || 0) > 0).forEach((a) => {
        const seg = document.createElement("div");
        seg.style.height = "100%";
        seg.style.background = a.color;
        seg.style.transition = "width .3s ease";
        seg.style.width = ((s.carga[a.id] * a.need) / base * 100) + "%";
        el.segmentsBar.appendChild(seg);
      });

      const speedPct = (s.mbps / base * 100) + "%";
      el.marker.style.left = speedPct;
      el.markerLabel.style.left = speedPct;

      el.activitiesList.querySelectorAll(".activity-row").forEach((row) => {
        const id = row.dataset.id;
        const a = ACTIVIDADES.find((x) => x.id === id);
        const n = s.carga[id] || 0;
        row.querySelector("[data-count]").textContent = String(n);
        row.querySelector("[data-subtotal]").textContent = Number((n * a.need).toFixed(1)) + " Mbps";
      });

      el.range.value = String(s.mbps);
      el.presets.querySelectorAll("[data-preset]").forEach((btn) => {
        const on = Number(btn.dataset.preset) === s.mbps;
        btn.style.background = on ? "#0f2f3d" : "transparent";
        btn.style.borderColor = on ? "#21b5ea" : "#3a464d";
      });
    }

    el.range.addEventListener("input", (e) => {
      state.mbps = Number(e.target.value);
      render();
    });
    el.presets.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => { state.mbps = Number(btn.dataset.preset); render(); });
    });

    render();
  })();

  /* ---------------- FAQ accordion ---------------- */
  (() => {
    const list = document.getElementById("faq-list");
    let openIndex = 0;

    function render() {
      list.querySelectorAll(".faq-item").forEach((item, i) => {
        const answer = item.querySelector(".faq-answer");
        const sign = item.querySelector(".faq-sign");
        const btn = item.querySelector(".faq-question");
        const open = i === openIndex;
        answer.hidden = !open;
        sign.textContent = open ? "–" : "+";
        btn.setAttribute("aria-expanded", String(open));
      });
    }

    FAQS.forEach((f, i) => {
      const item = document.createElement("div");
      item.className = "faq-item";
      item.innerHTML =
        '<button type="button" class="faq-question hover-faq" aria-expanded="false">' +
        "<span>" + f.q + "</span><span class=\"faq-sign\">+</span></button>" +
        '<p class="faq-answer" hidden></p>';
      item.querySelector(".faq-answer").textContent = f.a;
      item.querySelector(".faq-question").addEventListener("click", () => {
        openIndex = openIndex === i ? -1 : i;
        render();
      });
      list.appendChild(item);
    });

    render();
  })();
})();
