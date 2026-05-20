const accessState = {
  editingId: null,
  editingRoleSlug: null,
  masterKey: "",
  roles: [],
  staff: [],
};

document.addEventListener("DOMContentLoaded", iniciarPaginaAcessos);

async function iniciarPaginaAcessos() {
  configurarEventosAcessos();

  const keyFromUrl = getMasterKeyFromUrl();

  if (keyFromUrl) {
    localStorage.setItem("war-staff-master-key", keyFromUrl);
    history.replaceState(null, document.title, window.location.pathname);
  }

  accessState.masterKey =
    keyFromUrl || localStorage.getItem("war-staff-master-key") || "";

  if (!accessState.masterKey) {
    mostrarPainelChave();
    return;
  }

  await liberarPainelAcessos();
}

function configurarEventosAcessos() {
  document
    .getElementById("access-key-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const key = document.getElementById("access-key").value.trim();

      if (!key) {
        mostrarMensagemAcesso("Informe a chave de acesso.", true);
        return;
      }

      accessState.masterKey = key;
      localStorage.setItem("war-staff-master-key", key);
      await liberarPainelAcessos();
    });

  document
    .getElementById("access-logout-button")
    .addEventListener("click", () => {
      localStorage.removeItem("war-staff-master-key");
      accessState.masterKey = "";
      accessState.roles = [];
      accessState.staff = [];
      mostrarPainelChave();
      mostrarMensagemAcesso("Chave removida deste navegador.");
    });

  document
    .getElementById("access-form")
    .addEventListener("submit", salvarAcesso);

  document
    .getElementById("access-cancel-button")
    .addEventListener("click", limparFormularioAcesso);

  document
    .getElementById("access-new-button")
    .addEventListener("click", limparFormularioAcesso);

  document
    .getElementById("access-refresh-button")
    .addEventListener("click", carregarPainelAcessos);

  document.getElementById("role-form").addEventListener("submit", salvarCargo);
  document
    .getElementById("role-cancel-button")
    .addEventListener("click", limparFormularioCargo);

  document.getElementById("role-name").addEventListener("input", () => {
    if (accessState.editingRoleSlug) {
      return;
    }

    document.getElementById("role-slug").value = normalizarSlug(
      document.getElementById("role-name").value,
    );
  });

  document.getElementById("role-slug").addEventListener("input", (event) => {
    event.target.value = normalizarSlug(event.target.value);
  });
}

async function liberarPainelAcessos() {
  mostrarMensagemAcesso("Validando chave...");

  try {
    document.getElementById("access-key-panel").classList.add("hidden");
    document.getElementById("access-content").classList.remove("hidden");
    document.getElementById("access-new-button").classList.remove("hidden");
    document.getElementById("access-staff-name").textContent =
      "Painel reservado - chave ativa";
    await carregarPainelAcessos();
  } catch (error) {
    localStorage.removeItem("war-staff-master-key");
    accessState.masterKey = "";
    mostrarPainelChave();
    mostrarMensagemAcesso(error.message, true);
  }
}

function mostrarPainelChave() {
  document.getElementById("access-key-panel").classList.remove("hidden");
  document.getElementById("access-content").classList.add("hidden");
  document.getElementById("access-new-button").classList.add("hidden");
  document.getElementById("access-staff-name").textContent = "Painel reservado";
  document.getElementById("access-key").value = "";
  limparFormularioAcesso();
  limparFormularioCargo();
}

async function carregarPainelAcessos() {
  mostrarMensagemAcesso("Carregando acessos e cargos...");
  await carregarCargos(false);
  await carregarAcessos(false);
  mostrarMensagemAcesso("");
}

async function carregarAcessos(showMessage = true) {
  if (showMessage) {
    mostrarMensagemAcesso("Carregando acessos...");
  }

  const data = await chamarFuncaoAcessos({ action: "list" });
  accessState.staff = data.staff || [];
  renderizarAcessos();
  renderizarCargos();

  if (showMessage) {
    mostrarMensagemAcesso("");
  }
}

async function carregarCargos(showMessage = true) {
  if (showMessage) {
    mostrarMensagemAcesso("Carregando cargos...");
  }

  const data = await chamarFuncaoAcessos({ action: "list_roles" });
  accessState.roles = data.roles || [];
  preencherSelectCargos();
  renderizarCargos();

  if (showMessage) {
    mostrarMensagemAcesso("");
  }
}

async function salvarAcesso(event) {
  event.preventDefault();

  const isEditing = Boolean(accessState.editingId);
  const password = document.getElementById("access-password").value;
  const email = normalizarEmail(document.getElementById("access-email").value);
  const payload = {
    action: isEditing ? "update" : "create",
    active: document.getElementById("access-active").checked,
    display_name: document.getElementById("access-name").value.trim(),
    email,
    password,
    role: document.getElementById("access-role").value,
  };

  if (isEditing) {
    payload.id = accessState.editingId;
  }

  if (!email) {
    mostrarMensagemAcesso("Informe um e-mail válido.", true);
    return;
  }

  if (!payload.role) {
    mostrarMensagemAcesso("Selecione um cargo.", true);
    return;
  }

  if (!isEditing && password.length < 8) {
    mostrarMensagemAcesso("A senha precisa ter pelo menos 8 caracteres.", true);
    return;
  }

  mostrarMensagemAcesso("Salvando acesso...");

  try {
    await chamarFuncaoAcessos(payload);
    limparFormularioAcesso();
    await carregarPainelAcessos();
    mostrarMensagemAcesso(isEditing ? "Acesso atualizado." : "Acesso criado.");
  } catch (error) {
    mostrarMensagemAcesso(error.message, true);
  }
}

async function salvarCargo(event) {
  event.preventDefault();

  const isEditing = Boolean(accessState.editingRoleSlug);
  const payload = {
    action: isEditing ? "update_role" : "create_role",
    active: document.getElementById("role-active").checked,
    description: document.getElementById("role-description").value.trim(),
    name: document.getElementById("role-name").value.trim(),
    slug: document.getElementById("role-slug").value.trim(),
    sort_order: Number(document.getElementById("role-order").value || 0),
  };

  if (isEditing) {
    payload.slug = accessState.editingRoleSlug;
  }

  if (!payload.name || payload.name.length < 2) {
    mostrarMensagemAcesso("Informe o nome do cargo.", true);
    return;
  }

  if (!normalizarSlug(payload.slug)) {
    mostrarMensagemAcesso("Informe um identificador válido para o cargo.", true);
    return;
  }

  mostrarMensagemAcesso(isEditing ? "Atualizando cargo..." : "Criando cargo...");

  try {
    await chamarFuncaoAcessos(payload);
    limparFormularioCargo();
    await carregarPainelAcessos();
    mostrarMensagemAcesso(isEditing ? "Cargo atualizado." : "Cargo criado.");
  } catch (error) {
    mostrarMensagemAcesso(error.message, true);
  }
}

function renderizarAcessos() {
  const list = document.getElementById("access-list");

  list.innerHTML =
    accessState.staff
      .map((member) => {
        const emailText = member.email
          ? `E-mail ${escapeHtml(member.email)}`
          : "E-mail pendente em acesso antigo";

        return `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-white">${escapeHtml(member.display_name)}</h3>
                <span class="rounded-full border border-yellow-500/20 px-2 py-1 text-[0.65rem] font-bold uppercase text-yellow-500">${escapeHtml(rotuloCargo(member.role))}</span>
                <span class="rounded-full border ${member.active ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"} px-2 py-1 text-[0.65rem] font-bold uppercase">
                  ${member.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p class="mt-2 break-all text-xs text-gray-500">${emailText}</p>
              <p class="text-xs text-gray-500">Criado em ${formatarDataAcesso(member.created_at)}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-edit-access="${member.id}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white">
                <i class="fas fa-pen mr-2" aria-hidden="true"></i>Editar
              </button>
              <button type="button" data-delete-access="${member.id}" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10">
                <i class="fas fa-trash mr-2" aria-hidden="true"></i>Excluir
              </button>
            </div>
          </div>
        </article>`;
      })
      .join("") ||
    '<p class="text-sm text-gray-500">Nenhum acesso cadastrado.</p>';

  list.querySelectorAll("[data-edit-access]").forEach((button) => {
    button.addEventListener("click", () => {
      const member = accessState.staff.find(
        (item) => item.id === button.dataset.editAccess,
      );
      preencherEdicaoAcesso(member);
    });
  });

  list.querySelectorAll("[data-delete-access]").forEach((button) => {
    button.addEventListener("click", async () => {
      const member = accessState.staff.find(
        (item) => item.id === button.dataset.deleteAccess,
      );

      if (!member) {
        return;
      }

      const confirmed = window.confirm(
        `Excluir o acesso de ${member.display_name}?`,
      );

      if (!confirmed) {
        return;
      }

      try {
        await chamarFuncaoAcessos({ action: "delete", id: member.id });
        await carregarPainelAcessos();
        mostrarMensagemAcesso("Acesso excluído.");
      } catch (error) {
        mostrarMensagemAcesso(error.message, true);
      }
    });
  });
}

function renderizarCargos() {
  const list = document.getElementById("role-list");

  if (!list) {
    return;
  }

  list.innerHTML =
    accessState.roles
      .map((role) => {
        const usageCount = contarMembrosPorCargo(role.slug);
        const canDelete = !role.protected && usageCount === 0;
        const canToggle = !role.protected;

        return `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-white">${escapeHtml(role.name)}</h3>
                <span class="rounded-full border border-yellow-500/20 px-2 py-1 text-[0.65rem] font-bold uppercase text-yellow-500">${escapeHtml(role.slug)}</span>
                <span class="rounded-full border ${role.active ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"} px-2 py-1 text-[0.65rem] font-bold uppercase">
                  ${role.active ? "Ativo" : "Inativo"}
                </span>
                ${
                  role.protected
                    ? '<span class="rounded-full border border-blue-400/20 px-2 py-1 text-[0.65rem] font-bold uppercase text-blue-300">Protegido</span>'
                    : ""
                }
              </div>
              <p class="mt-2 text-sm text-gray-400">${escapeHtml(role.description || "Sem descrição.")}</p>
              <p class="mt-2 text-xs text-gray-500">${usageCount} acesso(s) usando este cargo.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-edit-role="${role.slug}" class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white">
                <i class="fas fa-pen mr-2" aria-hidden="true"></i>Editar
              </button>
              <button type="button" data-toggle-role="${role.slug}" ${canToggle ? "" : "disabled"} class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                ${role.active ? "Inativar" : "Ativar"}
              </button>
              <button type="button" data-delete-role="${role.slug}" ${canDelete ? "" : "disabled"} class="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                <i class="fas fa-trash mr-2" aria-hidden="true"></i>Excluir
              </button>
            </div>
          </div>
        </article>`;
      })
      .join("") || '<p class="text-sm text-gray-500">Nenhum cargo cadastrado.</p>';

  list.querySelectorAll("[data-edit-role]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = accessState.roles.find(
        (item) => item.slug === button.dataset.editRole,
      );
      preencherEdicaoCargo(role);
    });
  });

  list.querySelectorAll("[data-toggle-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const role = accessState.roles.find(
        (item) => item.slug === button.dataset.toggleRole,
      );

      if (!role || role.protected) {
        return;
      }

      try {
        await chamarFuncaoAcessos({
          action: "update_role",
          active: !role.active,
          description: role.description,
          name: role.name,
          slug: role.slug,
          sort_order: role.sort_order || 0,
        });
        await carregarPainelAcessos();
        mostrarMensagemAcesso(role.active ? "Cargo inativado." : "Cargo ativado.");
      } catch (error) {
        mostrarMensagemAcesso(error.message, true);
      }
    });
  });

  list.querySelectorAll("[data-delete-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const role = accessState.roles.find(
        (item) => item.slug === button.dataset.deleteRole,
      );

      if (!role) {
        return;
      }

      const confirmed = window.confirm(`Excluir o cargo ${role.name}?`);

      if (!confirmed) {
        return;
      }

      try {
        await chamarFuncaoAcessos({ action: "delete_role", slug: role.slug });
        await carregarPainelAcessos();
        mostrarMensagemAcesso("Cargo excluído.");
      } catch (error) {
        mostrarMensagemAcesso(error.message, true);
      }
    });
  });
}

function preencherEdicaoAcesso(member) {
  if (!member) {
    return;
  }

  accessState.editingId = member.id;
  document.getElementById("access-id").value = member.id;
  document.getElementById("access-name").value = member.display_name || "";
  document.getElementById("access-email").value = member.email || "";
  preencherSelectCargos(member.role || "staff");
  document.getElementById("access-password").value = "";
  document.getElementById("access-password").placeholder =
    "Deixe em branco para manter";
  document.getElementById("access-active").checked = Boolean(member.active);
  document.getElementById("access-form-title").textContent = "Editar acesso";
  document.getElementById("access-form-subtitle").textContent =
    member.email ? "E-mail, senha e cargo" : "Defina o e-mail deste acesso";
  document.getElementById("access-cancel-button").classList.remove("hidden");
  document.getElementById("access-submit-label").textContent =
    "Atualizar acesso";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function preencherEdicaoCargo(role) {
  if (!role) {
    return;
  }

  accessState.editingRoleSlug = role.slug;
  document.getElementById("role-original-slug").value = role.slug;
  document.getElementById("role-name").value = role.name || "";
  document.getElementById("role-slug").value = role.slug || "";
  document.getElementById("role-slug").disabled = true;
  document.getElementById("role-description").value = role.description || "";
  document.getElementById("role-order").value = role.sort_order || 0;
  document.getElementById("role-active").checked = Boolean(role.active);
  document.getElementById("role-active").disabled = Boolean(role.protected);
  document.getElementById("role-cancel-button").classList.remove("hidden");
  document.getElementById("role-submit-label").textContent = "Atualizar cargo";
  document.getElementById("role-name").focus();
}

function limparFormularioAcesso() {
  accessState.editingId = null;
  document.getElementById("access-form").reset();
  document.getElementById("access-active").checked = true;
  document.getElementById("access-id").value = "";
  document.getElementById("access-password").placeholder =
    "Mínimo de 8 caracteres";
  document.getElementById("access-form-title").textContent = "Novo acesso";
  document.getElementById("access-form-subtitle").textContent =
    "E-mail, senha e cargo";
  document.getElementById("access-cancel-button").classList.add("hidden");
  document.getElementById("access-submit-label").textContent = "Salvar acesso";
  preencherSelectCargos();
}

function limparFormularioCargo() {
  accessState.editingRoleSlug = null;
  document.getElementById("role-form").reset();
  document.getElementById("role-original-slug").value = "";
  document.getElementById("role-slug").disabled = false;
  document.getElementById("role-active").disabled = false;
  document.getElementById("role-active").checked = true;
  document.getElementById("role-order").value = 0;
  document.getElementById("role-cancel-button").classList.add("hidden");
  document.getElementById("role-submit-label").textContent = "Salvar cargo";
}

function preencherSelectCargos(selectedValue = "") {
  const select = document.getElementById("access-role");

  if (!select) {
    return;
  }

  const currentValue = selectedValue || select.value || "staff";
  const visibleRoles = accessState.roles.filter(
    (role) => role.active || role.slug === currentValue,
  );

  if (!visibleRoles.length) {
    select.innerHTML = '<option value="">Nenhum cargo cadastrado</option>';
    return;
  }

  select.innerHTML = visibleRoles
    .map(
      (role) =>
        `<option value="${escapeHtml(role.slug)}">${escapeHtml(role.name)}${role.active ? "" : " (inativo)"}</option>`,
    )
    .join("");

  const nextValue = visibleRoles.some((role) => role.slug === currentValue)
    ? currentValue
    : visibleRoles[0].slug;

  select.value = nextValue;
}

async function chamarFuncaoAcessos(body) {
  const config = window.WAR_SUPABASE_CONFIG;

  if (!config?.url || !config?.publishableKey) {
    throw new Error("Configuração do Supabase não encontrada.");
  }

  const response = await fetch(`${config.url}/functions/v1/staff-access`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      apikey: config.publishableKey,
      "x-staff-master-key": accessState.masterKey,
    },
    method: "POST",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    throw new Error(data?.error || "Erro ao chamar função de acessos.");
  }

  return data || {};
}

function getMasterKeyFromUrl() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("key") || params.get("chave") || params.get("access") || "";
}

function rotuloCargo(roleSlug) {
  const role = accessState.roles.find((item) => item.slug === roleSlug);
  return role?.name || roleSlug || "Staff";
}

function contarMembrosPorCargo(roleSlug) {
  return accessState.staff.filter((member) => member.role === roleSlug).length;
}

function normalizarEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
}

function normalizarSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function formatarDataAcesso(value) {
  if (!value) {
    return "--/--/----";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function mostrarMensagemAcesso(text, isError = false) {
  const message = document.getElementById("access-message");
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
