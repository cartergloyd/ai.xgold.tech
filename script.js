const menuButton = document.querySelector(".menu-button");
const siteMenu = document.querySelector("#site-menu");

menuButton.addEventListener("click", () => {
  const isOpen = siteMenu.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

siteMenu.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    siteMenu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});
