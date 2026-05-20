document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("staff-login-form");
  const message = document.getElementById("login-message");
  const searchParams = new URLSearchParams(window.location.search);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Entrando...", "text-yellow-400");

    const email = normalizarEmail(document.getElementById("email").value);
    const password = document.getElementById("password").value;

    if (!email) {
      setMessage("Informe um e-mail válido.", "text-red-400");
      return;
    }

    try {
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
        throw new Error(
          "Este e-mail ainda não está ativo como membro da staff.",
        );
      }

      window.location.href = getSafeRedirect(searchParams.get("redirect"));
    } catch (error) {
      setMessage(error.message || "Não foi possível entrar.", "text-red-400");
    }
  });

  function normalizarEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
  }

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
