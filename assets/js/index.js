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

const LINEAGE_ACCENTS = {
  blue: {
    badge: "bg-blue-600 text-white",
    glow: "bg-blue-500",
    hover: "hover:border-blue-500/50",
    ring: "border-blue-500",
  },
  green: {
    badge: "bg-green-600 text-white",
    glow: "bg-green-500",
    hover: "hover:border-green-500/50",
    ring: "border-green-500",
  },
  purple: {
    badge: "bg-purple-600 text-white",
    glow: "bg-purple-500",
    hover: "hover:border-purple-500/50",
    ring: "border-purple-500",
  },
  red: {
    badge: "bg-red-700 text-white",
    glow: "bg-red-700",
    hover: "hover:border-red-500/50",
    ring: "border-red-700",
  },
  slate: {
    badge: "bg-slate-600 text-white",
    glow: "bg-slate-400",
    hover: "hover:border-slate-400/50",
    ring: "border-slate-400",
  },
  yellow: {
    badge: "bg-yellow-600 text-black",
    glow: "bg-yellow-500",
    hover: "hover:border-yellow-500/50",
    ring: "border-yellow-500",
  },
};

async function carregarLinhagemReal() {
  const dynamicGrid = document.getElementById("staff-lineage-dynamic");
  const staticGrid = document.getElementById("staff-lineage-static");

  if (!dynamicGrid || !staticGrid || !window.warSupabase) {
    return;
  }

  const { data, error } = await warSupabase
    .from("staff_lineage")
    .select("display_name, role_label, tagline, image_url, accent, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error || !data?.length) {
    return;
  }

  dynamicGrid.innerHTML = [
    ...data.map(renderizarCardLinhagem),
    renderizarCardVagaStaff(),
  ].join("");
  dynamicGrid.classList.remove("hidden");
  staticGrid.classList.add("hidden");
}

function renderizarCardLinhagem(member) {
  const accent = LINEAGE_ACCENTS[member.accent] || LINEAGE_ACCENTS.yellow;
  const name = escapeLineageHtml(member.display_name || "Staff");
  const role = escapeLineageHtml(member.role_label || "Staff");
  const tagline = escapeLineageHtml(member.tagline || "Guardião do Reino");
  const imageUrl = escapeLineageAttr(
    member.image_url ||
      "https://lezyskkgqzzuqycngsod.supabase.co/storage/v1/object/public/war-assets/img/logo-oficial.webp",
  );

  return `
    <div class="group relative bg-slate-900/40 border border-yellow-600/10 p-8 rounded-2xl text-center transition-all ${accent.hover} hover:-translate-y-2 backdrop-blur-sm flex flex-col items-center">
      <div class="relative w-32 h-32 mb-6 flex items-center justify-center">
        <div class="absolute inset-0 ${accent.glow} rounded-full blur-xl opacity-10 group-hover:opacity-30 transition-opacity"></div>
        <div class="relative w-full h-full rounded-full border-2 ${accent.ring} p-1 bg-slate-800 flex items-center justify-center">
          <img
            src="${imageUrl}"
            alt="Avatar ${name}"
            class="h-full w-full rounded-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        </div>
        <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 ${accent.badge} text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">${role}</span>
      </div>
      <h3 class="font-fantasy text-xl text-white mb-1 tracking-wider">${name}</h3>
      <p class="text-gray-500 text-sm mb-4 italic">"${tagline}"</p>
    </div>`;
}

function renderizarCardVagaStaff() {
  return `
    <div class="group relative bg-slate-950/20 border-2 border-dashed border-gray-800 p-8 rounded-2xl text-center transition-all hover:border-yellow-600/30 flex flex-col justify-center items-center overflow-hidden h-full min-h-[350px]">
      <div class="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md"></div>
      <div class="relative w-24 h-24 mb-6 flex items-center justify-center rounded-full bg-slate-900/70 border-2 border-gray-700 shadow-inner">
        <i class="fas fa-plus text-4xl text-gray-700 group-hover:text-yellow-600 transition-colors"></i>
      </div>
      <h3 class="font-fantasy text-xl text-gray-500 group-hover:text-white transition-colors tracking-wider uppercase mb-2 relative z-10">O Próximo Herói?</h3>
      <p class="text-gray-600 text-xs px-2 leading-relaxed mb-6 font-light group-hover:text-gray-400 transition-colors relative z-10">
        Se candidate-se assim que abrirmos novas vagas para a staff.
        <br /><br />
        Sua jornada começa aqui.
      </p>
      <a href="/assets/pages/vagas.html" class="text-[10px] font-bold text-yellow-600 border border-yellow-600/20 px-4 py-2 rounded uppercase hover:bg-yellow-600 hover:text-black transition-all shadow-md group-hover:-translate-y-1 relative z-10">
        Verificar Vagas
      </a>
    </div>`;
}

function escapeLineageHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeLineageAttr(value) {
  return escapeLineageHtml(value).replaceAll("`", "&#096;");
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
  carregarLinhagemReal();
});
