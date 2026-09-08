(() => {
  const WA = "593969093580";

  const USOS = {
    hogar: "en mi casa",
    teletrabajo: "teletrabajo o clases",
    negocio: "en mi negocio",
    local: "oficina o varios locales",
  };

  const FAQS = [
    { q: "¿Qué gano con fibra óptica frente a lo que tengo ahora?", a: "La fibra lleva la señal en luz por un cable dedicado hasta tu casa. No se degrada con la distancia como el cobre ni se reparte entre los vecinos como el internet por radio, y la latencia es más baja y más estable: eso es justo lo que se siente en videollamadas, clases y juegos en línea." },
    { q: "¿Tengo que firmar contrato de permanencia?", a: "No. El servicio es mes a mes. Si te mudas o ya no lo necesitas, nos avisas y listo, sin penalidades ni letra chica." },
    { q: "¿Cuánto se demora la instalación?", a: "Apenas confirmamos que la red llega a tu dirección coordinamos la visita contigo y te damos la fecha exacta en ese momento. No te dejamos esperando una llamada que nunca llega." },
    { q: "¿Sirve para teletrabajo, clases en línea y juegos?", a: "Sí, es justamente para lo que mejor rinde la fibra. La latencia baja y estable es lo que evita que se te congele la videollamada o que el juego te saque en el peor momento." },
    { q: "¿Lo puedo tener en mi negocio?", a: "Sí. Instalamos en casas, locales y oficinas. Cuéntanos cuántos equipos se conectan y qué necesitas que funcione siempre (punto de venta, cámaras, facturación) y te decimos qué plan te sirve." },
    { q: "¿Qué pasa si se va la luz?", a: "El router necesita energía, así que sin luz en tu casa no hay WiFi aunque la red esté bien. Si necesitas seguir conectado durante los cortes, un UPS pequeño para el router resuelve el problema y te ayudamos a elegirlo." },
    { q: "¿Y si todavía no llegan a mi sector?", a: "Déjanos tus datos igual. La red crece barrio por barrio y priorizamos las zonas donde ya hay gente esperando, así que registrarte sí ayuda a que lleguemos antes. Te avisamos apenas tengamos red ahí." },
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
  const genericWa = waLink("Hola INEXT, quiero información sobre sus planes de internet.");
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
      summary: document.getElementById("cw-summary"),
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

    // No afirmamos cobertura ni recomendamos un plan concreto: con fibra la
    // cobertura se confirma dirección por dirección, así que el formulario
    // recoge los datos y la confirmación llega por WhatsApp.
    function summaryRows() {
      const s = state;
      return [
        ["Dirección", [s.sector.trim(), s.provincia].filter(Boolean).join(", ")],
        ["Lo necesita", USOS[s.uso] || "—"],
        ["Se conectan", s.tamano + " personas"],
        ["WhatsApp", s.telefono],
      ];
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
        btn.classList.toggle("is-on", btn.dataset.uso === s.uso);
      });
      document.querySelectorAll("#cw-tamanos [data-tamano]").forEach((btn) => {
        const on = btn.dataset.tamano === s.tamano;
        btn.setAttribute("aria-pressed", String(on));
        btn.classList.toggle("is-on", on);
      });

      if (s.step >= 4) {
        const destino = s.sector.trim() || s.provincia || "tu zona";
        const nombre = s.nombre.trim().split(" ")[0] || "gracias";
        const msg = "Hola INEXT, soy " + s.nombre.trim() + ". Quiero internet de fibra en " +
          destino + (s.provincia ? ", " + s.provincia : "") + ". Lo necesito " + (USOS[s.uso] || "") +
          " y nos conectamos " + s.tamano + " personas. Mi WhatsApp es " + s.telefono +
          ". ¿La red ya llega a mi dirección?";
        el.destino.textContent = nombre;
        el.waLink.href = waLink(msg);

        const rows = summaryRows();
        el.summary.innerHTML = rows.map(() =>
          '<div class="summary__row"><span class="summary__k"></span><span class="summary__v"></span></div>').join("");
        el.summary.querySelectorAll(".summary__row").forEach((row, i) => {
          row.querySelector(".summary__k").textContent = rows[i][0];
          row.querySelector(".summary__v").textContent = rows[i][1];
        });
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
        '<div><div class="activity-label"></div><div class="activity-detail" data-detail></div></div>' +
        '<span class="activity-subtotal" data-subtotal></span>' +
        '<div class="activity-controls">' +
        '<button type="button" class="icon-btn" data-dec aria-label="Quitar uno">−</button>' +
        '<span class="activity-count" data-count></span>' +
        '<button type="button" class="icon-btn" data-inc aria-label="Agregar uno">+</button>' +
        "</div>";
      row.querySelector(".activity-label").textContent = a.label;
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
      if (m <= 120) return "Le sobra espacio a lo que tienes puesto. Es un rango cómodo para una casa que no exige todo al mismo tiempo.";
      return "Aquí ya nadie nota que hay otros conectados, y todavía te queda margen para lo que venga.";
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
        btn.classList.toggle("is-on", Number(btn.dataset.preset) === s.mbps);
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
        const open = i === openIndex;
        item.classList.toggle("is-open", open);
        item.querySelector(".faq-answer").hidden = !open;
        item.querySelector(".faq-question").setAttribute("aria-expanded", String(open));
      });
    }

    FAQS.forEach((f, i) => {
      const item = document.createElement("div");
      item.className = "faq-item";
      item.innerHTML =
        '<button type="button" class="faq-question" aria-expanded="false">' +
        '<span data-q></span><span class="faq-sign" aria-hidden="true"></span></button>' +
        '<p class="faq-answer" hidden></p>';
      item.querySelector("[data-q]").textContent = f.q;
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
