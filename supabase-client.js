// SHI Beauty uses the publishable key in the browser. Database and Storage
// access must be protected by Supabase RLS policies.
(function () {
  var supabaseSdk = window.supabase;
  var supabaseUrl = 'https://jboelriekfabpxcytpaa.supabase.co';
  var supabasePublishableKey = 'sb_publishable_Gjs5TvDrzzoKPa7BNGlk_A_lCLosGXP';

  if (!supabaseSdk || typeof supabaseSdk.createClient !== 'function') {
    console.error('[SHI Beauty] Supabase JS SDK is unavailable.');
    window.shiSupabase = null;
    return;
  }

  window.shiSupabase = supabaseSdk.createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }
  );

  window.dispatchEvent(new CustomEvent('shi:supabase-ready'));
})();
