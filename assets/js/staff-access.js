const accessState = {
  editingId: null,
  masterKey: "",
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
    .addEventListener("click", carregarAcessos);
}

async function liberarPainelAcessos() {
  mostrarMensagemAcesso("Validando chave...");

  try {
    document.getElementById("access-key-panel").classList.add("hidden");
    document.getElementById("access-content").classList.remove("hidden");
    document.getElementById("access-new-button").classList.remove("hidden");
    document.getElementById("access-staff-name").textContent =
      "Painel reservado - chave ativa";
    await carregarAcessos();
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
}

async function carregarAcessos() {
  mostrarMensagemAcesso("Carregando acessos...");

  const data = await chamarFuncaoAcessos({ action: "list" });
  accessState.staff = data.staff || [];
  renderizarAcessos();
  mostrarMensagemAcesso("");
}

async function salvarAcesso(event) {
  event.preventDefault();

  const isEditing = Boolean(accessState.editingId);
  const password = document.getElementById("access-password").value;
  const payload = {
    action: isEditing ? "update" : "create",
    active: document.getElementById("access-active").checked,
    display_name: document.getElementById("access-name").value.trim(),
    password,
    role: document.getElementById("access-role").value,
  };

  if (isEditing) {
    payload.id = accessState.editingId;
  } else {
    const cpf = document.getElementById("access-cpf").value;

    if (!WarStaffAuth.validarCPF(cpf)) {
      mostrarMensagemAcesso("CPF inválido.", true);
      return;
    }

    payload.cpf = cpf;
  }

  if (!isEditing && password.length < 8) {
    mostrarMensagemAcesso("A senha precisa ter pelo menos 8 caracteres.", true);
    return;
  }

  mostrarMensagemAcesso("Salvando acesso...");

  try {
    await chamarFuncaoAcessos(payload);
    limparFormularioAcesso();
    await carregarAcessos();
    mostrarMensagemAcesso(isEditing ? "Acesso atualizado." : "Acesso criado.");
  } catch (error) {
    mostrarMensagemAcesso(error.message, true);
  }
}

function renderizarAcessos() {
  const list = document.getElementById("access-list");

  list.innerHTML =
    accessState.staff
      .map(
        (member) => `
        <article class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-white">${escapeHtml(member.display_name)}</h3>
                <span class="rounded-full border border-yellow-500/20 px-2 py-1 text-[0.65rem] font-bold uppercase text-yellow-500">${rotuloCargo(member.role)}</span>
                <span class="rounded-full border ${member.active ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"} px-2 py-1 text-[0.65rem] font-bold uppercase">
                  ${member.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p class="mt-2 text-xs text-gray-500">CPF final ${escapeHtml(member.cpf_last4 || "----")}</p>
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
        </article>`,
      )
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
        await carregarAcessos();
        mostrarMensagemAcesso("Acesso excluído.");
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
  document.getElementById("access-role").value = member.role || "staff";
  document.getElementById("access-password").value = "";
  document.getElementById("access-password").placeholder =
    "Deixe em branco para manter";
  document.getElementById("access-active").checked = Boolean(member.active);
  document.getElementById("access-cpf-field").classList.add("hidden");
  document.getElementById("access-form-title").textContent = "Editar acesso";
  document.getElementById("access-form-subtitle").textContent =
    `CPF final ${member.cpf_last4 || "----"}`;
  document.getElementById("access-cancel-button").classList.remove("hidden");
  document.getElementById("access-submit-label").textContent =
    "Atualizar acesso";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limparFormularioAcesso() {
  accessState.editingId = null;
  document.getElementById("access-form").reset();
  document.getElementById("access-active").checked = true;
  document.getElementById("access-id").value = "";
  document.getElementById("access-password").placeholder =
    "Mínimo de 8 caracteres";
  document.getElementById("access-cpf-field").classList.remove("hidden");
  document.getElementById("access-form-title").textContent = "Novo acesso";
  document.getElementById("access-form-subtitle").textContent =
    "CPF, senha e cargo";
  document.getElementById("access-cancel-button").classList.add("hidden");
  document.getElementById("access-submit-label").textContent = "Salvar acesso";
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

function rotuloCargo(role) {
  const labels = {
    admin: "Admin",
    owner: "Owner",
    staff: "Staff",
  };

  return labels[role] || "Staff";
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
