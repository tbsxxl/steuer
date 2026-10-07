// Design vor dem ersten Rendern setzen (kein helles Aufblitzen im Dunkelmodus).
// Gespeicherte Wahl gewinnt, sonst folgt die App der Systemeinstellung.
(function () {
  var t = null;
  try { t = localStorage.getItem("stb_theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") {
    t = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", t);
})();
