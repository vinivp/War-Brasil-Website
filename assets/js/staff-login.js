document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("staff-login-form");
  const message = document.getElementById("login-message");
  const setupPanel = document.getElementById("setup-panel");
  const setupForm = document.getElementById("setup-form");
  const searchParams = new URLSearchParams(window.location.search);

  if (searchParams.get("setup") === "1") {
    setupPanel?.classList.remove("hidden");
  }

  setupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cpf = document.getElementById("setup-cpf").value;
    const output = document.getElementById("setup-email-output");

    try {
      output.value = await WarStaffAuth.cpfParaEmailTecnico(cpf);
    } catch (error) {
      output.value = error.message;
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Entrando...", "text-yellow-400");

    const cpf = document.getElementById("cpf").value;
    const password = document.getElementById("password").value;

    try {
      const email = await WarStaffAuth.cpfParaEmailTecnico(cpf);
      const { data, error } = await warSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const { data: profile, error: profileError } = await warSupabase
        .from("staff_profiles")
        .select("id, active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError || !profile?.active) {
        await warSupabase.auth.signOut();
        throw new Error("Este CPF ainda não está ativo como membro da staff.");
      }

      window.location.href = getSafeRedirect(searchParams.get("redirect"));
    } catch (error) {
      setMessage(error.message || "Não foi possível entrar.", "text-red-400");
    }
  });

  function setMessage(text, className) {
    message.textContent = text;
    message.className = `min-h-6 text-sm font-semibold ${className}`;
  }

  function getSafeRedirect(value) {
    if (!value || !value.startsWith("/assets/pages/")) {
      return "/assets/pages/staff-portal.html";
    }

    return value;
  }
});
