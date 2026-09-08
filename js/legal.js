(() => {
  "use strict";
  const WA = "593969093580";
  const href = "https://wa.me/" + WA + "?text=" +
    encodeURIComponent("Hola INEXT, tengo una consulta sobre el servicio.");
  document.querySelectorAll(".js-wa-generic").forEach((a) => { a.href = href; });
})();
