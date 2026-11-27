// SHI Beauty uses the publishable key in the browser. Database and Storage
// access must be protected by Supabase RLS policies.
(function () {
  var supabaseSdk = window.supabase;
  var supabaseUrl = 'https://jboelriekfabpxcytpaa.supabase.co';
  var supabasePublishableKey = 'sb_publishable_Gjs5TvDrzzoKPa7BNGlk_A_lCLosGXP';
  window.shiSupabaseConfig = { url: supabaseUrl, key: supabasePublishableKey };

  function restClient() {
    var sessionKey = 'shi-beauty-auth-session';
    var session = null;
    try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch (error) {}
    function request(path, options) {
      options = options || {};
      var headers = Object.assign({ apikey: supabasePublishableKey, 'Content-Type': 'application/json' }, options.headers || {});
      if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
      return fetch(supabaseUrl + path, Object.assign({}, options, { headers: headers })).then(function (response) {
        return response.text().then(function (body) {
          var data = body ? JSON.parse(body) : null;
          if (!response.ok) return { data: null, error: new Error((data && (data.message || data.error_description || data.error)) || body || response.statusText) };
          return { data: data, error: null };
        });
      });
    }
    function table(name) {
      var filters = [], select = '*', operation = 'GET', payload = null, wantSingle = false;
      var builder = {
        select: function (columns) { select = columns || '*'; return builder; },
        eq: function (column, value) { filters.push('&' + encodeURIComponent(column) + '=eq.' + encodeURIComponent(value)); return builder; },
        order: function (column, options) { filters.push('&order=' + encodeURIComponent(column) + (options && options.ascending === false ? '.desc' : '.asc')); return builder; },
        insert: function (value) { operation = 'POST'; payload = value; return builder; },
        update: function (value) { operation = 'PATCH'; payload = value; return builder; },
        delete: function () { operation = 'DELETE'; return builder; },
        single: function () { wantSingle = true; return builder; },
        maybeSingle: function () { wantSingle = true; return builder; },
        then: function (resolve, reject) {
          var query = '/rest/v1/' + name;
          var options = { method: operation };
          if (operation === 'GET') query += '?select=' + encodeURIComponent(select) + filters.join('');
          else { query += '?' + filters.join('').replace(/^&/, ''); if (operation !== 'DELETE') { options.body = JSON.stringify(payload); options.headers = { Prefer: wantSingle ? 'return=representation' : 'return=minimal' }; } }
          return request(query, options).then(function (result) { if (result.error) return result; var data = result.data; if (wantSingle) data = Array.isArray(data) ? (data[0] || null) : data; return { data: data, error: null }; }).then(resolve, reject);
        }
      };
      return builder;
    }
    var auth = {
      signInWithPassword: function (credentials) { return request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify(credentials) }).then(function (result) { if (!result.error) { session = result.data; localStorage.setItem(sessionKey, JSON.stringify(session)); } return { data: session ? { user: session.user, session: session } : null, error: result.error }; }); },
      getSession: function () { return Promise.resolve({ data: { session: session }, error: null }); },
      signOut: function () { session = null; localStorage.removeItem(sessionKey); return Promise.resolve({ error: null }); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }
    };
    var storage = { from: function (bucket) { return { upload: function (path, file, options) { return fetch(supabaseUrl + '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { apikey: supabasePublishableKey, Authorization: 'Bearer ' + ((session && session.access_token) || supabasePublishableKey), 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': options && options.upsert ? 'true' : 'false' }, body: file }).then(function (response) { return response.ok ? { data: { path: path }, error: null } : { data: null, error: new Error('Не удалось загрузить файл') }; }); }, getPublicUrl: function (path) { return { data: { publicUrl: supabaseUrl + '/storage/v1/object/public/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/') } }; }, remove: function (paths) { return request('/storage/v1/object/' + bucket, { method: 'DELETE', body: JSON.stringify(paths) }); } }; } };
    return { auth: auth, from: table, storage: storage };
  }

  if (!supabaseSdk || typeof supabaseSdk.createClient !== 'function') {
    console.warn('[SHI Beauty] Supabase JS SDK unavailable; using REST fallback.');
    window.shiSupabase = restClient();
    window.dispatchEvent(new CustomEvent('shi:supabase-ready'));
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

