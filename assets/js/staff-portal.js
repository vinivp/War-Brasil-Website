const staffState = {
  bans: [],
  categories: [],
  categoryEditingId: null,
  chat: {
    channel: null,
    messages: [],
    open: false,
    signedUrls: new Map(),
    unread: 0,
  },
  orders: [],
  productEditingId: null,
  products: [],
  profile: null,
};

const ASSET_BUCKET = "war-assets";
const CHAT_BUCKET = "staff-chat";
const CHAT_MAX_FILE_SIZE = 15 * 1024 * 1024;
const CHAT_FILE_TYPES = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["pdf", "application/pdf"],
  ["txt", "text/plain"],
  ["csv", "text/csv"],
  ["zip", "application/zip"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

document.addEventListener("DOMContentLoaded", iniciarPortalStaff);

async function iniciarPortalStaff() {
  const { data } = await warSupabase.auth.getSession();

  if (!data.session) {
    window.location.href = "/assets/pages/staff-login.html";
    return;
  }

  const { data: profile, error } = await warSupabase
    .from("staff_profiles")
    .select("id, display_name, role, active")
    .eq("id", data.session.user.id)
    .maybeSingle();

  if (error || !profile?.active) {
    await warSupabase.auth.signOut();
    window.location.href = "/assets/pages/staff-login.html";
    return;
  }

  staffState.profile = profile;
  document.getElementById("staff-name").textContent =
    `${profile.display_name} - ${profile.role}`;

  configurarTabs();
  configurarForms();
  configurarChatStaff();
  await Promise.all([
    carregarCategoriasProdutos(),
    carregarCompras(),
    carregarConsole(),
    carregarBanimentos(),
  ]);
  await carregarMensagensChat();
  configurarRealtimeChat();
}

function configurarTabs() {
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".staff-tab").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
      });
      document.querySelectorAll(".staff-tab-panel").forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== button.dataset.tabTarget);
      });
    });
  });

  document
    .getElementById("logout-button")
    .addEventListener("click", async () => {
      encerrarRealtimeChat();
      await warSupabase.auth.signOut();
      window.location.href = "/assets/pages/staff-login.html";
    });
}

function configurarForms() {
  document
    .getElementById("category-form")
    .addEventListener("submit", salvarCategoria);
  document
    .getElementById("category-cancel")
    .addEventListener("click", limparFormularioCategoria);

  document
    .getElementById("product-form")
    .addEventListener("submit", salvarProduto);
  document
    .getElementById("product-cancel")
    .addEventListener("click", limparFormularioProduto);
  document
    .getElementById("product-image")
    .addEventListener("input", atualizarPreviewProduto);
  document
    .getElementById("product-file")
    .addEventListener("change", atualizarPreviewArquivoProduto);

  document
    .getElementById("refresh-orders")
    .addEventListener("click", carregarCompras);

  document
    .getElementById("console-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const url = document.getElementById("console-url").value.trim();
      const { error } = await warSupabase.from("staff_links").upsert({
        key: "hytale_console",
        label: "Console da hospedagem Hytale",
        updated_by: staffState.profile.id,
        url,
      });

      if (error) {
        mostrarMensagem(error.message, true);
        return;
      }

      mostrarMensagem("Link do console salvo.");
      await carregarConsole();
    });

  document
    .getElementById("ban-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const { error } = await warSupabase.from("banned_players").insert({
        active: true,
        created_by: staffState.profile.id,
        discord_id: document.getElementById("ban-discord").value.trim(),
        player_name: document.getElementById("ban-player").value.trim(),
        reason: document.getElementById("ban-reason").value.trim(),
      });

      if (error) {
        mostrarMensagem(error.message, true);
        return;
      }

      event.target.reset();
      mostrarMensagem("Banimento adicionado.");
      await carregarBanimentos();
    });
}

async function salvarCategoria(event) {
  event.preventDefault();
  const name = document.getElementById("category-name").value.trim();
  const payload = {
    active: document.getElementById("category-active").checked,
    description: document.getElementById("category-description").value.trim(),
    name,
    slug: criarSlug(name),
    sort_order: Number(document.getElementById("category-order").value || 0),
  };

  if (!name) {
    mostrarMensagem("Informe o nome da categoria.", true);
    return;
  }

  const request = staffState.categoryEditingId
    ? warSupabase
        .from("categories")
        .update(payload)
        .eq("id", staffState.categoryEditingId)
    : warSupabase.from("categories").insert({
        ...payload,
        created_by: staffState.profile.id,
      });

  const { error } = await request;

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  mostrarMensagem(
    staffState.categoryEditingId
      ? "Categoria atualizada."
      : "Categoria criada.",
  );
  limparFormularioCategoria();
  await carregarCategoriasProdutos();
}

async function salvarProduto(event) {
  event.preventDefault();
  const name = document.getElementById("product-name").value.trim();
  const price = Number(document.getElementById("product-price").value || 0);
  let imageUrl = document.getElementById("product-image").value.trim();

  if (!name) {
    mostrarMensagem("Informe o nome do produto.", true);
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    mostrarMensagem("Informe um preço válido.", true);
    return;
  }

  try {
    imageUrl = (await subirImagemProduto(name)) || imageUrl;
  } catch (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  const payload = {
    active: document.getElementById("product-active").checked,
    category_id: document.getElementById("product-category").value || null,
    description: document.getElementById("product-description").value.trim(),
    game_command: document.getElementById("product-command").value.trim(),
    image_url: imageUrl,
    name,
    price_cents: Math.round(price * 100),
    slug: criarSlug(name),
    sort_order: Number(document.getElementById("product-order").value || 0),
  };

  const request = staffState.productEditingId
    ? warSupabase
        .from("products")
        .update(payload)
        .eq("id", staffState.productEditingId)
    : warSupabase.from("products").insert({
        ...payload,
        created_by: staffState.profile.id,
        metadata: {},
      });

  const { error } = await request;

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  mostrarMensagem(
    staffState.productEditingId ? "Produto atualizado." : "Produto criado.",
  );
  limparFormularioProduto();
  await carregarCategoriasProdutos();
}

async function subirImagemProduto(productName) {
  const fileInput = document.getElementById("product-file");
  const file = fileInput.files?.[0];

  if (!file) {
    return "";
  }

  if (!["image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem PNG ou WEBP.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A imagem precisa ter até 10 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `img/${criarSlug(productName || file.name)}-${Date.now()}.${extension}`;

  mostrarMensagem("Enviando imagem...");

  const { error } = await warSupabase.storage
    .from(ASSET_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = warSupabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  document.getElementById("product-image").value = data.publicUrl;
  atualizarPreviewProduto();
  return data.publicUrl;
}

async function carregarCategoriasProdutos() {
  const [
    { data: categories, error: categoryError },
    { data: products, error },
  ] = await Promise.all([
    warSupabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    warSupabase
      .from("products")
      .select("*, categories(name)")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (categoryError || error) {
    mostrarMensagem((categoryError || error).message, true);
    return;
  }

  staffState.categories = categories || [];
  staffState.products = products || [];
  renderizarCategorias();
  renderizarProdutos();
}

function renderizarCategorias() {
  const list = document.getElementById("categories-list");
  const select = document.getElementById("product-category");

  select.innerHTML = [
    '<option value="">Selecione a categoria</option>',
    ...staffState.categories.map(
      (category) =>
        `<option value="${category.id}">${escapeHtml(category.name)}</option>`,
    ),
  ].join("");

  list.innerHTML =
    staffState.categories
      .map((category) => {
        const productCount = staffState.products.filter(
          (product) => product.category_id === category.id,
        ).length;

        return `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-white">${escapeHtml(category.name)}</h3>
                <span class="rounded-full border ${category.active ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"} px-2 py-1 text-[0.65rem] font-bold uppercase">
                  ${category.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500">${escapeHtml(category.description || "Sem descrição")}</p>
              <p class="mt-2 text-xs uppercase text-gray-500">Ordem ${category.sort_order} • ${productCount} produto(s)</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-edit-category="${category.id}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white">
                <i class="fas fa-pen mr-2" aria-hidden="true"></i>Editar
              </button>
              <button type="button" data-toggle-category="${category.id}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase ${category.active ? "text-yellow-400" : "text-green-400"}">
                ${category.active ? "Inativar" : "Ativar"}
              </button>
              <button type="button" data-delete-category="${category.id}" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10">
                <i class="fas fa-trash mr-2" aria-hidden="true"></i>Excluir
              </button>
            </div>
          </div>
        </article>`;
      })
      .join("") ||
    '<p class="text-sm text-gray-500">Nenhuma categoria cadastrada.</p>';

  list.querySelectorAll("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = staffState.categories.find(
        (item) => item.id === button.dataset.editCategory,
      );
      preencherEdicaoCategoria(category);
    });
  });

  list.querySelectorAll("[data-toggle-category]").forEach((button) => {
    button.addEventListener("click", async () => {
      const category = staffState.categories.find(
        (item) => item.id === button.dataset.toggleCategory,
      );
      await atualizarCategoria(category.id, { active: !category.active });
    });
  });

  list.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", async () => {
      const category = staffState.categories.find(
        (item) => item.id === button.dataset.deleteCategory,
      );

      if (!category) {
        return;
      }

      const productCount = staffState.products.filter(
        (product) => product.category_id === category.id,
      ).length;
      const confirmed = window.confirm(
        `Excluir "${category.name}"? ${productCount ? "Os produtos ficarão sem categoria." : ""}`,
      );

      if (!confirmed) {
        return;
      }

      const { error } = await warSupabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (error) {
        mostrarMensagem(error.message, true);
        return;
      }

      limparFormularioCategoria();
      mostrarMensagem("Categoria excluída.");
      await carregarCategoriasProdutos();
    });
  });
}

function renderizarProdutos() {
  const list = document.getElementById("products-list");

  list.innerHTML =
    staffState.products
      .map(
        (product) => `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="flex min-w-0 gap-4">
              <img src="${escapeAttr(product.image_url || getAssetUrl("logo-oficial.webp"))}" alt="${escapeAttr(product.name)}" class="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover" loading="lazy" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="font-bold text-white">${escapeHtml(product.name)}</h3>
                  <span class="rounded-full border ${product.active ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"} px-2 py-1 text-[0.65rem] font-bold uppercase">
                    ${product.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p class="text-xs text-gray-500">${escapeHtml(product.categories?.name || "Sem categoria")}</p>
                <p class="mt-2 text-sm font-bold text-yellow-500">${formatarMoeda(product.price_cents / 100)}</p>
                <p class="mt-1 line-clamp-2 whitespace-pre-line text-xs text-gray-500">${escapeHtml(product.description || "")}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-edit-product="${product.id}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white">
                <i class="fas fa-pen mr-2" aria-hidden="true"></i>Editar
              </button>
              <button type="button" data-toggle-product="${product.id}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase ${product.active ? "text-yellow-400" : "text-green-400"}">
                ${product.active ? "Inativar" : "Ativar"}
              </button>
              <button type="button" data-delete-product="${product.id}" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10">
                <i class="fas fa-trash mr-2" aria-hidden="true"></i>Excluir
              </button>
            </div>
          </div>
        </article>`,
      )
      .join("") ||
    '<p class="text-sm text-gray-500">Nenhum produto cadastrado.</p>';

  list.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = staffState.products.find(
        (item) => item.id === button.dataset.editProduct,
      );
      preencherEdicaoProduto(product);
    });
  });

  list.querySelectorAll("[data-toggle-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      const product = staffState.products.find(
        (item) => item.id === button.dataset.toggleProduct,
      );
      await atualizarProduto(product.id, { active: !product.active });
    });
  });

  list.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      const product = staffState.products.find(
        (item) => item.id === button.dataset.deleteProduct,
      );

      if (!product || !window.confirm(`Excluir "${product.name}"?`)) {
        return;
      }

      const { error } = await warSupabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) {
        mostrarMensagem(error.message, true);
        return;
      }

      limparFormularioProduto();
      mostrarMensagem("Produto excluído.");
      await carregarCategoriasProdutos();
    });
  });
}

async function atualizarCategoria(id, payload) {
  const { error } = await warSupabase
    .from("categories")
    .update(payload)
    .eq("id", id);

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  await carregarCategoriasProdutos();
}

async function atualizarProduto(id, payload) {
  const { error } = await warSupabase
    .from("products")
    .update(payload)
    .eq("id", id);

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  await carregarCategoriasProdutos();
}

function preencherEdicaoCategoria(category) {
  if (!category) {
    return;
  }

  staffState.categoryEditingId = category.id;
  document.getElementById("category-id").value = category.id;
  document.getElementById("category-name").value = category.name || "";
  document.getElementById("category-description").value =
    category.description || "";
  document.getElementById("category-order").value = category.sort_order || 0;
  document.getElementById("category-active").checked = Boolean(category.active);
  document.getElementById("category-form-title").textContent =
    "Editar categoria";
  document.getElementById("category-submit-label").textContent =
    "Atualizar categoria";
  document.getElementById("category-cancel").classList.remove("hidden");
  document.getElementById("category-form").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function preencherEdicaoProduto(product) {
  if (!product) {
    return;
  }

  staffState.productEditingId = product.id;
  document.getElementById("product-id").value = product.id;
  document.getElementById("product-category").value = product.category_id || "";
  document.getElementById("product-name").value = product.name || "";
  document.getElementById("product-description").value =
    product.description || "";
  document.getElementById("product-price").value = (
    product.price_cents / 100
  ).toFixed(2);
  document.getElementById("product-image").value = product.image_url || "";
  document.getElementById("product-command").value = product.game_command || "";
  document.getElementById("product-order").value = product.sort_order || 0;
  document.getElementById("product-active").checked = Boolean(product.active);
  document.getElementById("product-form-title").textContent = "Editar produto";
  document.getElementById("product-submit-label").textContent =
    "Atualizar produto";
  document.getElementById("product-cancel").classList.remove("hidden");
  document.getElementById("product-file").value = "";
  atualizarPreviewProduto();
  document.getElementById("product-form").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function limparFormularioCategoria() {
  staffState.categoryEditingId = null;
  document.getElementById("category-form").reset();
  document.getElementById("category-id").value = "";
  document.getElementById("category-order").value = 0;
  document.getElementById("category-active").checked = true;
  document.getElementById("category-form-title").textContent = "Nova categoria";
  document.getElementById("category-submit-label").textContent =
    "Criar categoria";
  document.getElementById("category-cancel").classList.add("hidden");
}

function limparFormularioProduto() {
  staffState.productEditingId = null;
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value = "";
  document.getElementById("product-order").value = 0;
  document.getElementById("product-active").checked = true;
  document.getElementById("product-form-title").textContent = "Novo produto";
  document.getElementById("product-submit-label").textContent = "Criar produto";
  document.getElementById("product-cancel").classList.add("hidden");
  atualizarPreviewProduto();
}

function atualizarPreviewArquivoProduto() {
  const file = document.getElementById("product-file").files?.[0];

  if (!file) {
    atualizarPreviewProduto();
    return;
  }

  const preview = document.getElementById("product-image-preview");
  preview.src = URL.createObjectURL(file);
  preview.alt = "Prévia da imagem do produto";
  preview.classList.remove("hidden");
}

function atualizarPreviewProduto() {
  const imageUrl = document.getElementById("product-image").value.trim();
  const preview = document.getElementById("product-image-preview");

  if (!imageUrl) {
    preview.src = "";
    preview.alt = "";
    preview.classList.add("hidden");
    return;
  }

  preview.src = imageUrl;
  preview.alt = "Prévia da imagem do produto";
  preview.classList.remove("hidden");
}

async function carregarCompras() {
  const { data, error } = await warSupabase
    .from("orders")
    .select("*, order_items(product_name, quantity, unit_price_cents)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  staffState.orders = data || [];
  document.getElementById("orders-list").innerHTML =
    staffState.orders
      .map((order) => {
        const items = (order.order_items || [])
          .map((item) => `${item.quantity}x ${escapeHtml(item.product_name)}`)
          .join(", ");
        return `
          <article class="rounded-xl border border-white/10 bg-black/20 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 class="font-bold text-white">${escapeHtml(order.buyer_nick)}</h3>
                <p class="text-xs text-gray-500">${escapeHtml(order.buyer_email)}</p>
                <p class="mt-2 text-sm text-gray-300">${items || "Sem itens"}</p>
              </div>
              <div class="text-left sm:text-right">
                <p class="font-bold text-yellow-500">${formatarMoeda(order.total_cents / 100)}</p>
                <p class="text-xs text-gray-500">${formatarData(order.created_at)}</p>
                <p class="text-xs uppercase text-gray-500">${escapeHtml(order.status)}</p>
              </div>
            </div>
          </article>`;
      })
      .join("") ||
    '<p class="text-sm text-gray-500">Nenhuma compra registrada.</p>';
}

async function carregarConsole() {
  const { data, error } = await warSupabase
    .from("staff_links")
    .select("url")
    .eq("key", "hytale_console")
    .maybeSingle();

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  const url = data?.url || "";
  document.getElementById("console-url").value = url;
  document.getElementById("open-console").href = url || "#";
}

async function carregarBanimentos() {
  const { data, error } = await warSupabase
    .from("banned_players")
    .select("*")
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    mostrarMensagem(error.message, true);
    return;
  }

  staffState.bans = data || [];
  document.getElementById("bans-list").innerHTML =
    staffState.bans
      .map(
        (ban) => `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="font-bold text-white">${escapeHtml(ban.player_name)}</h3>
              <p class="text-xs text-gray-500">${escapeHtml(ban.discord_id || "Sem Discord")}</p>
              <p class="mt-2 text-sm text-gray-300">${escapeHtml(ban.reason)}</p>
              <p class="mt-2 text-xs uppercase ${ban.active ? "text-red-400" : "text-gray-500"}">${ban.active ? "Banido" : "Removido"}</p>
            </div>
            ${
              ban.active
                ? `<button type="button" data-remove-ban="${ban.id}" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10">Remover</button>`
                : ""
            }
          </div>
        </article>`,
      )
      .join("") ||
    '<p class="text-sm text-gray-500">Nenhum banimento cadastrado.</p>';

  document.querySelectorAll("[data-remove-ban]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { error } = await warSupabase
        .from("banned_players")
        .update({
          active: false,
          removed_at: new Date().toISOString(),
          removed_by: staffState.profile.id,
        })
        .eq("id", button.dataset.removeBan);

      if (error) {
        mostrarMensagem(error.message, true);
        return;
      }

      await carregarBanimentos();
    });
  });
}

function configurarChatStaff() {
  const root = document.getElementById("staff-chat");
  const toggle = document.getElementById("staff-chat-toggle");
  const close = document.getElementById("staff-chat-close");
  const form = document.getElementById("staff-chat-form");
  const input = document.getElementById("staff-chat-input");
  const fileInput = document.getElementById("staff-chat-file");

  if (!root || !toggle || !close || !form || !input || !fileInput) {
    return;
  }

  toggle.addEventListener("click", () => abrirChatStaff(true));
  close.addEventListener("click", () => abrirChatStaff(false));
  form.addEventListener("submit", enviarMensagemChat);
  fileInput.addEventListener("change", atualizarListaArquivosChat);
  input.addEventListener("input", ajustarAlturaChatInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  window.addEventListener("beforeunload", encerrarRealtimeChat);
  atualizarBadgeChat();
}

function abrirChatStaff(open) {
  const root = document.getElementById("staff-chat");
  const toggle = document.getElementById("staff-chat-toggle");

  staffState.chat.open = open;
  root?.classList.toggle("open", open);
  toggle?.setAttribute("aria-expanded", String(open));

  if (open) {
    staffState.chat.unread = 0;
    atualizarBadgeChat();
    setTimeout(() => {
      document.getElementById("staff-chat-input")?.focus();
      rolarChatParaFinal();
    }, 80);
  }
}

async function carregarMensagensChat() {
  mostrarStatusChat("Carregando conversa...");

  const { data, error } = await warSupabase
    .from("staff_chat_messages")
    .select(
      "id, sender_id, sender_name, sender_role, body, attachments, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    mostrarStatusChat(error.message, true);
    return;
  }

  staffState.chat.messages = (data || []).map(normalizarMensagemChat).reverse();
  renderizarMensagensChat();
  mostrarStatusChat("Conversa carregada.");
}

function configurarRealtimeChat() {
  if (staffState.chat.channel) {
    return;
  }

  staffState.chat.channel = warSupabase
    .channel("staff-chat-messages")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "staff_chat_messages",
      },
      tratarRealtimeChat,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        mostrarStatusChat("Online em tempo real.");
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        mostrarStatusChat("Realtime indisponível no momento.", true);
      }
    });
}

function encerrarRealtimeChat() {
  if (!staffState.chat.channel || !window.warSupabase) {
    return;
  }

  warSupabase.removeChannel(staffState.chat.channel);
  staffState.chat.channel = null;
}

function tratarRealtimeChat(payload) {
  if (payload.eventType === "DELETE") {
    removerMensagemChatDaTela(payload.old?.id);
    return;
  }

  if (payload.new) {
    adicionarMensagemChat(payload.new);
  }
}

function adicionarMensagemChat(message) {
  const normalized = normalizarMensagemChat(message);

  if (!normalized.id) {
    return;
  }

  const exists = staffState.chat.messages.some(
    (item) => item.id === normalized.id,
  );

  if (exists) {
    return;
  }

  staffState.chat.messages.push(normalized);
  staffState.chat.messages.sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );
  staffState.chat.messages = staffState.chat.messages.slice(-120);
  renderizarMensagensChat();

  if (!staffState.chat.open && normalized.sender_id !== staffState.profile.id) {
    staffState.chat.unread += 1;
    atualizarBadgeChat();
    return;
  }

  rolarChatParaFinal();
}

function removerMensagemChatDaTela(messageId) {
  if (!messageId) {
    return;
  }

  const previousLength = staffState.chat.messages.length;
  staffState.chat.messages = staffState.chat.messages.filter(
    (item) => item.id !== messageId,
  );

  if (staffState.chat.messages.length === previousLength) {
    return;
  }

  renderizarMensagensChat();
}

function normalizarMensagemChat(message) {
  let attachments = message?.attachments || [];

  if (typeof attachments === "string") {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = [];
    }
  }

  if (!Array.isArray(attachments)) {
    attachments = [];
  }

  return {
    attachments,
    body: String(message?.body || ""),
    created_at: message?.created_at || new Date().toISOString(),
    id: message?.id || "",
    sender_id: message?.sender_id || "",
    sender_name: message?.sender_name || "Staff",
    sender_role: message?.sender_role || "staff",
  };
}

function renderizarMensagensChat() {
  const list = document.getElementById("staff-chat-messages");

  if (!list) {
    return;
  }

  if (!staffState.chat.messages.length) {
    list.innerHTML =
      '<p class="p-4 text-sm text-gray-500">Nenhuma mensagem ainda.</p>';
    return;
  }

  list.innerHTML = staffState.chat.messages
    .map((message) => {
      const isOwn = message.sender_id === staffState.profile.id;
      const canDelete = podeRemoverMensagemChat(message);
      const body = message.body
        ? `<p class="staff-chat-message-body">${escapeHtml(message.body)}</p>`
        : "";
      const role =
        message.sender_role === "owner" ? "dono" : message.sender_role;

      return `
        <article class="staff-chat-message ${isOwn ? "own" : ""}">
          <div class="staff-chat-message-meta">
            <strong>${escapeHtml(message.sender_name)}</strong>
            <span>${escapeHtml(role)}</span>
            <span>${formatarHoraChat(message.created_at)}</span>
            ${
              canDelete
                ? `<button type="button" class="staff-chat-delete" data-delete-chat-message="${escapeAttr(message.id)}" aria-label="Remover mensagem">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                  </button>`
                : ""
            }
          </div>
          ${body}
          <div class="staff-chat-attachments" data-chat-attachments="${escapeAttr(message.id)}"></div>
        </article>`;
    })
    .join("");

  renderizarAnexosChat();
  configurarRemocaoMensagensChat();
  rolarChatParaFinal();
}

function configurarRemocaoMensagensChat() {
  document.querySelectorAll("[data-delete-chat-message]").forEach((button) => {
    button.addEventListener("click", () => {
      removerMensagemChat(button.dataset.deleteChatMessage);
    });
  });
}

function podeRemoverMensagemChat(message) {
  const role = staffState.profile?.role;
  return (
    message.sender_id === staffState.profile?.id ||
    role === "owner" ||
    role === "admin"
  );
}

async function removerMensagemChat(messageId) {
  const message = staffState.chat.messages.find(
    (item) => item.id === messageId,
  );

  if (!message || !podeRemoverMensagemChat(message)) {
    mostrarStatusChat(
      "Você não tem permissão para remover esta mensagem.",
      true,
    );
    return;
  }

  const confirmed = window.confirm("Remover esta mensagem do chat da staff?");

  if (!confirmed) {
    return;
  }

  mostrarStatusChat("Removendo mensagem...");

  try {
    const paths = message.attachments
      .map((attachment) => attachment.path)
      .filter(Boolean);

    if (paths.length) {
      const { error: storageError } = await warSupabase.storage
        .from(CHAT_BUCKET)
        .remove(paths);

      if (storageError) {
        throw storageError;
      }

      paths.forEach((path) => staffState.chat.signedUrls.delete(path));
    }

    const { error } = await warSupabase
      .from("staff_chat_messages")
      .delete()
      .eq("id", message.id);

    if (error) {
      throw error;
    }

    removerMensagemChatDaTela(message.id);
    mostrarStatusChat("Mensagem removida.");
  } catch (error) {
    mostrarStatusChat(error.message, true);
  }
}

function renderizarAnexosChat() {
  document.querySelectorAll("[data-chat-attachments]").forEach((container) => {
    const message = staffState.chat.messages.find(
      (item) => item.id === container.dataset.chatAttachments,
    );

    if (!message?.attachments.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML =
      '<p class="text-xs text-gray-500">Preparando anexos...</p>';

    Promise.all(message.attachments.map(renderizarAnexoChat))
      .then((items) => {
        container.innerHTML = items.join("");
      })
      .catch(() => {
        container.innerHTML =
          '<p class="text-xs text-red-300">Não foi possível abrir os anexos.</p>';
      });
  });
}

async function renderizarAnexoChat(attachment) {
  const url = await obterUrlAssinadaChat(attachment.path);
  const name = attachment.name || "arquivo";
  const type = attachment.type || "";
  const isImage = type.startsWith("image/");
  const preview = isImage
    ? `<img src="${escapeAttr(url)}" alt="${escapeAttr(name)}" loading="lazy" />`
    : `<i class="${iconeAnexoChat(type)}" aria-hidden="true"></i>`;

  return `
    <a class="staff-chat-attachment" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" download="${escapeAttr(name)}">
      ${preview}
      <span>${escapeHtml(name)}</span>
      <small>${formatarTamanhoArquivo(attachment.size || 0)}</small>
    </a>`;
}

async function obterUrlAssinadaChat(path) {
  const cached = staffState.chat.signedUrls.get(path);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await warSupabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw error;
  }

  staffState.chat.signedUrls.set(path, {
    expiresAt: Date.now() + 55 * 60 * 1000,
    url: data.signedUrl,
  });

  return data.signedUrl;
}

async function enviarMensagemChat(event) {
  event.preventDefault();

  const input = document.getElementById("staff-chat-input");
  const fileInput = document.getElementById("staff-chat-file");
  const button = document.getElementById("staff-chat-send");
  const body = input.value.trim();
  const files = Array.from(fileInput.files || []);

  if (!body && !files.length) {
    mostrarStatusChat("Escreva uma mensagem ou anexe um arquivo.", true);
    return;
  }

  if (files.length > 5) {
    mostrarStatusChat("Envie no máximo 5 arquivos por mensagem.", true);
    return;
  }

  button.disabled = true;
  mostrarStatusChat(files.length ? "Enviando anexos..." : "Enviando...");

  try {
    const messageId = crypto.randomUUID();
    const attachments = await Promise.all(
      files.map((file) => subirAnexoChat(file, messageId)),
    );

    const { error } = await warSupabase.from("staff_chat_messages").insert({
      attachments,
      body,
      id: messageId,
      sender_id: staffState.profile.id,
      sender_name: staffState.profile.display_name,
      sender_role: staffState.profile.role,
    });

    if (error) {
      throw error;
    }

    input.value = "";
    fileInput.value = "";
    atualizarListaArquivosChat();
    ajustarAlturaChatInput();
    mostrarStatusChat("Mensagem enviada.");
  } catch (error) {
    mostrarStatusChat(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function subirAnexoChat(file, messageId) {
  const contentType = detectarTipoAnexoChat(file);

  if (file.size > CHAT_MAX_FILE_SIZE) {
    throw new Error(`"${file.name}" passa do limite de 15 MB.`);
  }

  const extension = extensaoArquivoChat(file.name, contentType);
  const baseName = criarSlug(file.name.replace(/\.[^.]+$/, "")) || "arquivo";
  const randomPart = Math.random().toString(36).slice(2, 8);
  const path = `${staffState.profile.id}/${messageId}/${Date.now()}-${randomPart}-${baseName}.${extension}`;

  const { error } = await warSupabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    name: file.name,
    path,
    size: file.size,
    type: contentType,
  };
}

function detectarTipoAnexoChat(file) {
  const extension = extensaoNomeArquivo(file.name);
  const typeByExtension = CHAT_FILE_TYPES.get(extension);
  const typeByMime = [...CHAT_FILE_TYPES.values()].includes(file.type)
    ? file.type
    : "";

  if (typeByExtension && typeByMime && typeByExtension !== typeByMime) {
    throw new Error(
      `"${file.name}" tem extensão e tipo de arquivo diferentes.`,
    );
  }

  const contentType = typeByMime || typeByExtension;

  if (!contentType) {
    throw new Error(
      `"${file.name}" não é permitido. Use JPG, PNG, WEBP, PDF, TXT, CSV, DOCX, XLSX ou ZIP.`,
    );
  }

  return contentType;
}

function extensaoArquivoChat(fileName, contentType) {
  const extension = extensaoNomeArquivo(fileName);

  if (CHAT_FILE_TYPES.get(extension) === contentType) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  const fallback = [...CHAT_FILE_TYPES.entries()].find(
    ([, type]) => type === contentType,
  );

  return fallback?.[0] === "jpeg" ? "jpg" : fallback?.[0] || "bin";
}

function extensaoNomeArquivo(fileName) {
  return (
    String(fileName || "")
      .split(".")
      .pop()
      ?.toLowerCase() || ""
  );
}

function atualizarListaArquivosChat() {
  const fileInput = document.getElementById("staff-chat-file");
  const list = document.getElementById("staff-chat-file-list");
  const files = Array.from(fileInput?.files || []);

  if (!list) {
    return;
  }

  if (!files.length) {
    list.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  list.classList.remove("hidden");
  list.innerHTML = files
    .map(
      (file) =>
        `<span class="staff-chat-file-pill">${escapeHtml(file.name)} • ${formatarTamanhoArquivo(file.size)}</span>`,
    )
    .join("");
}

function ajustarAlturaChatInput() {
  const input = document.getElementById("staff-chat-input");

  if (!input) {
    return;
  }

  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
}

function rolarChatParaFinal() {
  const list = document.getElementById("staff-chat-messages");

  if (!list) {
    return;
  }

  list.scrollTop = list.scrollHeight;
}

function atualizarBadgeChat() {
  const badge = document.getElementById("staff-chat-unread");
  const status = document.getElementById("staff-chat-launcher-status");

  if (!badge) {
    return;
  }

  badge.textContent = Math.min(staffState.chat.unread, 99);
  badge.classList.toggle("hidden", staffState.chat.unread === 0);

  if (status) {
    status.textContent =
      staffState.chat.unread > 0
        ? `${staffState.chat.unread} nova(s) mensagem(ns)`
        : "Interno";
  }
}

function mostrarStatusChat(text, isError = false) {
  const status = document.getElementById("staff-chat-status");

  if (!status) {
    return;
  }

  status.textContent = text;
  status.classList.toggle("text-red-300", isError);
  status.classList.toggle("text-gray-500", !isError);
}

function iconeAnexoChat(type) {
  if (type === "application/pdf") {
    return "fas fa-file-pdf text-red-300";
  }

  if (type.includes("spreadsheet") || type === "text/csv") {
    return "fas fa-file-excel text-green-300";
  }

  if (type.includes("wordprocessing")) {
    return "fas fa-file-word text-blue-300";
  }

  if (type === "application/zip") {
    return "fas fa-file-archive text-yellow-300";
  }

  return "fas fa-file-lines text-slate-300";
}

function formatarHoraChat(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatarTamanhoArquivo(size) {
  const bytes = Number(size || 0);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAssetUrl(fileName) {
  return `${window.WAR_SUPABASE_CONFIG.url}/storage/v1/object/public/${ASSET_BUCKET}/img/${fileName}`;
}

function criarSlug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatarData(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function mostrarMensagem(text, isError = false) {
  const message = document.getElementById("portal-message");
  message.textContent = text;
  message.className = `mb-4 min-h-6 text-sm font-semibold ${isError ? "text-red-400" : "text-yellow-400"}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
