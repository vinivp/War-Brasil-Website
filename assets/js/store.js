document.addEventListener("DOMContentLoaded", carregarLojaDinamica);

const STORE_ASSET_BASE =
  "https://lezyskkgqzzuqycngsod.supabase.co/storage/v1/object/public/war-assets/img/";

const VIP_INFO = {
  "vip-campones": {
    groups: [
      {
        items: [
          "Ferramentas basicas de Prata",
          "Arma inicial de Prata (Espada)",
          "Bloco de Pedra x50",
          "30 Madeira",
          "5 Paes",
        ],
        title: "Diário",
      },
      {
        items: [
          "40 Arco + Flechas",
          "1 Escudo de Ferro",
          "4 Baus",
          "10 Paes",
          "20 Tochas",
          "2 Fornalhas",
          "Armadura de Ferro",
        ],
        title: "Semanal",
      },
      {
        items: [
          "64 Cobre",
          "60 Ferro",
          "20 Ouro",
          "1 Estacao Avancada de Trabalho",
          "30 Couro",
          "15 Pao",
          "15 Saco de Veneno",
          "5 Sementes de Trigo",
          "5 Cenoura",
        ],
        title: "Mensal",
      },
    ],
    title: "Kits: VIP Camponês",
  },
  "vip-imperador": {
    groups: [
      {
        items: [
          "Ferramentas basicas de Adamantina",
          "20 Flechas",
          "100 Bloco de Pedra",
          "100 Madeira",
          "12 Paes",
        ],
        title: "Diário",
      },
      {
        items: [
          "Adagas de Adamantina",
          "40 Flechas",
          "Escudo de Adamantina",
          "1 Armadura de Adamantina",
          "80 Cobre",
          "50 Ferro",
          "50 Ouro",
          "20 Cobalto",
          "20 Torio",
          "10 Adamantine",
          "25 Pao",
          "36 Potion de Vida",
          "15 Potion de Mana",
        ],
        title: "Semanal",
      },
      {
        items: [
          "Espada Longa Flamejante",
          "Machado de Adamantina",
          "100 Cobre",
          "100 Ferro",
          "100 Ouro",
          "90 Cobalto",
          "50 Torio",
          "10 Adamantine",
          "Estacao Avancada de Trabalho x1",
          "Bigorna do Ferreiro x1",
          "30 Couro Leve",
          "20 Couro Medio",
          "50 Pao",
          "15 Saco de Veneno",
          "40 Sementes de Trigo",
          "40 Cenoura",
          "20 Essencia de Fogo",
          "40 Essencia de Gelo",
          "100 Essencia do Vazio",
          "40 Sucata",
          "20 Fragmento de osso",
          "3 Coracao do vazio",
          "70 Sturdy Chitin",
        ],
        title: "Mensal",
      },
    ],
    title: "Kits: VIP Imperador",
  },
  "vip-nobre": {
    groups: [
      {
        items: [
          "Ferramentas basicas de Cobalto",
          "Arma inicial de Cobalto",
          "100 Bloco de Pedra",
          "60 Madeira",
          "10 Paes",
        ],
        title: "Diário",
      },
      {
        items: [
          "1 Adagas",
          "1 Arco de Cobalto + Flechas",
          "1 Escudo de Cobalto",
          "1 Armadura de Cobalto",
          "15 Paes",
          "16 Potion de Vida",
          "6 Potion de Mana",
        ],
        title: "Semanal",
      },
      {
        items: [
          "Espada de Fogo Lendaria",
          "100 Cobre",
          "80 Ferro",
          "40 Ouro",
          "40 Cobalto",
          "25 Torio",
          "Estacao Avancada de Trabalho x1",
          "30 Couro",
          "25 Pao",
          "15 Saco de Veneno",
          "20 Sementes de Trigo",
          "20 Cenoura",
          "20 Essencia de Fogo",
          "40 Essencia de Gelo",
          "100 Essencia do Vazio",
        ],
        title: "Mensal",
      },
    ],
    title: "Kits: VIP Nobre",
  },
};

async function carregarLojaDinamica() {
  const container = document.getElementById("dynamic-store");
  const staticStore = document.getElementById("static-store");

  if (!container || !window.warSupabase) {
    return;
  }

  const [
    { data: categories, error: categoryError },
    { data: products, error },
  ] = await Promise.all([
    warSupabase
      .from("categories")
      .select("id, name, slug, description, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    warSupabase
      .from("products")
      .select(
        "id, category_id, name, slug, description, price_cents, image_url",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (categoryError || error || !products?.length) {
    return;
  }

  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const categoriesWithProducts = (categories || [])
    .map((category) => ({
      ...category,
      products: products.filter(
        (product) => product.category_id === category.id,
      ),
    }))
    .filter((category) => category.products.length);

  container.innerHTML = `${categoriesWithProducts.map(renderCategory).join("")}${renderVipInfoModal()}`;
  container.classList.remove("hidden");
  staticStore?.classList.add("hidden");

  container.addEventListener("click", (event) => {
    const infoButton = event.target.closest("[data-vip-info]");

    if (infoButton) {
      abrirVipInfo(infoButton.dataset.vipInfo);
      return;
    }

    const button = event.target.closest("[data-add-product]");

    if (!button) {
      return;
    }

    const product = productsById.get(button.dataset.addProduct);

    if (!product) {
      return;
    }

    adicionarAoCarrinho(
      product.name,
      product.price_cents / 100,
      product.image_url || `${STORE_ASSET_BASE}logo-oficial.webp`,
      product.id,
    );
  });
}

function renderCategory(category) {
  return `
    <div class="category-header border-l-4 border-yellow-500 pl-4 mb-8">
      <h2 class="font-fantasy text-3xl text-yellow-500 uppercase tracking-normal">${escapeHtml(category.name)}</h2>
      <p class="text-gray-500">${escapeHtml(category.description || "Produtos cadastrados pela staff")}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
      ${category.products.map((product) => renderProduct(product, category)).join("")}
    </div>`;
}

function renderProduct(product, category) {
  const price = formatarMoeda(product.price_cents / 100);
  const infoKey = getVipInfoKey(product, category);

  return `
    <article class="shop-card border-2 border-yellow-500/50 shadow-lg">
      <img src="${escapeAttr(product.image_url || `${STORE_ASSET_BASE}logo-oficial.webp`)}" alt="${escapeAttr(product.name)}" loading="lazy" class="w-full h-48 object-cover" />
      <div class="p-5 flex flex-col flex-grow text-center">
        <h3 class="font-fantasy text-xl text-yellow-500 uppercase">${escapeHtml(product.name)}</h3>
        <p class="text-gray-400 text-xs italic mb-4 flex-grow mt-2 whitespace-pre-line">${escapeHtml(product.description || "")}</p>
        <div class="flex items-center ${infoKey ? "justify-between" : "justify-center"} gap-4 mb-4">
          <div class="text-yellow-500 font-bold text-2xl">${price}</div>
          ${
            infoKey
              ? `<button type="button" data-vip-info="${escapeAttr(infoKey)}" class="text-[10px] bg-slate-800 border border-yellow-600/30 text-yellow-500 px-4 py-2 rounded-full hover:bg-yellow-600 hover:text-black transition-all font-bold uppercase">
                  + INFO
                </button>`
              : ""
          }
        </div>
        <button type="button" data-add-product="${escapeAttr(product.id)}" class="w-full bg-yellow-600 hover:bg-yellow-500 text-black py-3 rounded-lg font-bold transition text-xs uppercase">
          Adicionar ao carrinho
        </button>
      </div>
    </article>`;
}

function getVipInfoKey(product, category) {
  const isVipCategory = criarSlug(
    category?.name || category?.slug || "",
  ).includes("assinaturas-vip");
  const slug = product.slug || criarSlug(product.name);

  if (!isVipCategory || !VIP_INFO[slug]) {
    return "";
  }

  return slug;
}

function renderVipInfoModal() {
  return `
    <div id="dynamic-vip-info-modal" class="modal" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="modal-content animate-modal w-[95%] lg:max-w-[1000px] flex flex-col">
        <button type="button" onclick="closeModal('dynamic-vip-info-modal')" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl z-10" aria-label="Fechar">
          &times;
        </button>
        <div class="border-b border-yellow-500/20 pb-4 mb-4">
          <h3 id="dynamic-vip-info-title" class="font-fantasy text-2xl text-yellow-500"></h3>
          <p class="text-gray-400 text-sm">Itens exclusivos</p>
        </div>
        <div id="dynamic-vip-info-content" class="kit-scroll overflow-y-auto pr-2 custom-scrollbar"></div>
        <button type="button" onclick="closeModal('dynamic-vip-info-modal')" class="modal-btn-close mt-6">
          Fechar janela
        </button>
      </div>
    </div>`;
}

function abrirVipInfo(key) {
  const info = VIP_INFO[key];
  const title = document.getElementById("dynamic-vip-info-title");
  const content = document.getElementById("dynamic-vip-info-content");

  if (!info || !title || !content) {
    return;
  }

  title.textContent = info.title;
  content.innerHTML = info.groups
    .map(
      (group) => `
        <section class="mb-5">
          <h4 class="font-fantasy text-lg text-white mb-3">${escapeHtml(group.title)}</h4>
          <ul class="grid gap-2 text-sm text-gray-300">
            ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>`,
    )
    .join("");
  openModal("dynamic-vip-info-modal");
}

function criarSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
