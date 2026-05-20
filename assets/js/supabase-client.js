(function () {
  const config = window.WAR_SUPABASE_CONFIG;
  const factory = window.supabase?.createClient;

  if (!config || !factory) {
    console.error("Supabase não foi carregado corretamente.");
    return;
  }

  window.warSupabase = factory(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: "war-brasil-staff-auth",
    },
  });
})();
