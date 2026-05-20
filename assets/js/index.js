function copyIP(event) {
  const ip = "hytalewar.com.br:9000";
  const targetBtn = event.currentTarget;
  const originalText = targetBtn.innerHTML;

  const confirmarCopia = () => {
    const msg = document.getElementById("copy-msg");

    if (msg) {
      msg.style.opacity = "1";
      setTimeout(() => {
        msg.style.opacity = "0";
      }, 3000);
    }

    targetBtn.innerHTML = "<i class='fas fa-check'></i> COPIADO!";
    setTimeout(() => {
      targetBtn.innerHTML = originalText;
    }, 2000);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(ip)
      .then(confirmarCopia)
      .catch(() => {
        copiarComFallback(ip);
        confirmarCopia();
      });
    return;
  }

  copiarComFallback(ip);
  confirmarCopia();
}

function copiarComFallback(texto) {
  const input = document.createElement("textarea");
  input.value = texto;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function atualizarEstadoNav() {
  const nav = document.querySelector("nav");

  if (!nav) {
    return;
  }

  nav.classList.toggle("bg-slate-950", window.scrollY > 100);
  nav.classList.toggle("border-yellow-500/40", window.scrollY > 100);
  nav.classList.toggle("shadow-2xl", window.scrollY > 100);
  nav.classList.toggle("bg-slate-900/80", window.scrollY <= 100);
}

function fecharMenuMobile() {
  const menu = document.getElementById("mobile-menu");
  const botao = document.getElementById("mobile-menu-button");

  if (!menu || !botao) {
    return;
  }

  menu.classList.add("hidden");
  botao.setAttribute("aria-expanded", "false");
  botao.querySelector("i")?.classList.replace("fa-xmark", "fa-bars");
}

function configurarMenuMobile() {
  const menu = document.getElementById("mobile-menu");
  const botao = document.getElementById("mobile-menu-button");

  if (!menu || !botao) {
    return;
  }

  botao.addEventListener("click", () => {
    const aberto = menu.classList.toggle("hidden") === false;
    botao.setAttribute("aria-expanded", String(aberto));
    const icone = botao.querySelector("i");

    if (icone) {
      icone.classList.toggle("fa-bars", !aberto);
      icone.classList.toggle("fa-xmark", aberto);
    }
  });
}

function configurarRolagemSuave() {
  document.querySelectorAll('nav a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      const alvo = document.querySelector(id);

      if (!alvo) {
        return;
      }

      event.preventDefault();
      fecharMenuMobile();
      const topo = alvo.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: topo, behavior: "smooth" });
    });
  });
}

function openModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);

  if (!modal) {
    return;
  }

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "auto";
}

window.addEventListener("scroll", atualizarEstadoNav, { passive: true });

window.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
    event.target.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "auto";
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "auto";
    fecharMenuMobile();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  atualizarEstadoNav();
  configurarMenuMobile();
  configurarRolagemSuave();
});
