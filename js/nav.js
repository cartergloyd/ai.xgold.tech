// Mobile menu: full-screen panel under the nav bar.
(() => {
  const nav = document.querySelector(".nav");
  const toggle = nav && nav.querySelector(".nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (!nav || !toggle || !menu) return;

  const isOpen = () => nav.classList.contains("is-open");

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Menu");
  }

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  window.matchMedia("(max-width: 733px)").addEventListener("change", () => setOpen(false));
})();
