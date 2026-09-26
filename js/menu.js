/* Menú de celular: un botón que abre y cierra el panel de enlaces.
   Se cierra al elegir un enlace, con Escape o tocando fuera. */
(() => {
  "use strict";
  const boton = document.querySelector(".nav__toggle");
  if (!boton) return;
  const panel = document.getElementById(boton.getAttribute("aria-controls"));
  if (!panel) return;

  function poner(abierto) {
    boton.setAttribute("aria-expanded", String(abierto));
    boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    panel.hidden = !abierto;
  }

  boton.addEventListener("click", () => poner(boton.getAttribute("aria-expanded") !== "true"));
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) poner(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) { poner(false); boton.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !boton.contains(e.target)) poner(false);
  });
})();
