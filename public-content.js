(function () {
  'use strict';

  // The HTML remains the fallback. This layer only replaces a block after a
  // complete, valid Supabase response has arrived.
  var client = window.shiSupabase;
  var localRoot = 'img/';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function safeUrl(value, fallback) {
    var url = String(value || '').trim();
    if (!url) return fallback || '';
    if (/^https:\/\//i.test(url) || /^http:\/\//i.test(url) || /^\//.test(url) || !url.includes(':')) return url;
    return fallback || '';
  }

  function assetUrl(path) {
    if (!path) return '';
    if (path.indexOf('site/') === 0) return localRoot + path.slice(5).split('/').map(encodeURIComponent).join('/');
    if (client) {
      var result = client.storage.from('site-media').getPublicUrl(path);
      return result.data && result.data.publicUrl ? result.data.publicUrl : '';
    }
    return '';
  }

  function contentMap(rows) {
    return (rows || []).reduce(function (map, row) {
      if (row && row.key && row.is_published !== false) map[row.key] = row.value || '';
      return map;
    }, {});
  }

  function setText(selector, value) {
    var node = document.querySelector(selector);
    if (node && value != null && String(value).trim()) node.textContent = value;
  }

  function setHref(selector, value) {
    var node = document.querySelector(selector);
    var url = safeUrl(value);
    if (node && url) node.setAttribute('href', url);
  }

  function applyTexts(map) {
    var textBindings = {
      '.hero-viewport + .bg-gradient-to-r': null,
      '#video-title': 'video.title',
      '#about .reveal-stagger > div:first-child > p:first-child': 'about.eyebrow',
      '#about h2': 'about.title',
      '#about .reveal-stagger > div:first-child p:nth-of-type(2)': 'about.body_1',
      '#about .reveal-stagger > div:first-child p:nth-of-type(3)': 'about.body_2',
      '#services .reveal > div:first-child p': 'services.eyebrow',
      '#services .reveal h2': 'services.title',
      '#services .reveal > p': 'services.description',
      '#team h2': 'team.title',
      '#team > div > .reveal p': 'team.description',
      '#booking .inline-flex span': 'booking.eyebrow',
      '#booking h3': 'booking.title',
      '#booking .max-w-2xl > p': 'booking.description',
      '#booking a span': 'booking.cta',
      '#contacts p.text-sm': 'contacts.eyebrow',
      '#contacts h2': 'contacts.title'
    };
    Object.keys(textBindings).forEach(function (selector) {
      if (textBindings[selector]) setText(selector, map[textBindings[selector]]);
    });
    var nav = { '#about': 'nav.about', '#services': 'nav.services', '#promo': 'nav.promotions', '#bar': 'nav.bar', '#team': 'nav.team', '#contacts': 'nav.contacts' };
    document.querySelectorAll('header nav a, #mobile-menu a').forEach(function (link) {
      var key = nav[link.getAttribute('href')];
      if (key && map[key]) link.textContent = map[key];
    });
  }

  function serviceMarkup(categories, groups, services, map) {
    var byGroup = {};
    (services || []).filter(function (item) { return item.is_published !== false; }).forEach(function (item) {
      (byGroup[item.group_id] || (byGroup[item.group_id] = [])).push(item);
    });
    return (categories || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; }).map(function (category, index) {
      var categoryGroups = (groups || []).filter(function (group) { return group.category_id === category.id; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
      var body = categoryGroups.map(function (group) {
        var items = (byGroup[group.id] || []).sort(function (a, b) { return a.sort_order - b.sort_order; });
        var rows = items.map(function (item) {
          return '<tr><td class="py-3">' + escapeHtml(item.name) + '</td><td class="py-3 text-right font-semibold text-moss">' + escapeHtml(item.price_text || 'По запросу') + '</td></tr>';
        }).join('');
        return '<div class="space-y-4">' + (group.title && group.title !== 'Основные услуги' ? '<h4 class="text-moss font-semibold uppercase tracking-wider text-xs">' + escapeHtml(group.title) + '</h4>' : '') + '<div class="overflow-x-auto"><table class="w-full text-left min-w-[500px]"><thead><tr class="border-b border-white/20 text-white/60 text-sm"><th class="pb-3 font-medium">Название услуги</th><th class="pb-3 font-medium text-right w-32">Цена</th></tr></thead><tbody class="text-sm divide-y divide-white/5 text-white/80">' + rows + '</tbody></table></div>' + (group.note ? '<p class="rounded-xl border border-moss/30 bg-moss/5 p-4 text-sm leading-6 text-white/80">' + escapeHtml(group.note) + '</p>' : '') + '</div>';
      }).join('');
      if (!body) return '';
      var note = index === 0 && map['services.nails.note'] && category.slug === 'service-01' ? '<div class="rounded-xl border border-moss/30 bg-moss/5 p-4 text-sm leading-6 text-white/80">' + escapeHtml(map['services.nails.note']) + '</div>' : '';
      return '<details class="group rounded-[1.5rem] border border-white/10 bg-ink/70 overflow-hidden transition-all duration-300"><summary class="flex items-center justify-between p-6 cursor-pointer select-none hover:bg-white/5"><h3 class="text-xl font-semibold text-white flex items-center gap-2">' + escapeHtml(category.title) + '</h3><span class="text-moss transition-transform duration-300 group-open:rotate-180">▼</span></summary><div class="p-6 border-t border-white/10 space-y-6">' + note + body + '</div></details>';
    }).join('');
  }

  function applyServices(categories, groups, services, map) {
    var host = document.querySelector('#services .reveal-stagger');
    if (!host || !categories || !categories.length || !services || !services.length) return;
    var html = serviceMarkup(categories, groups, services, map);
    if (html) host.innerHTML = html;
  }

  function teamCard(member, media) {
    var asset = (media || []).find(function (item) { return item.id === member.photo_asset_id; });
    var url = asset ? assetUrl(asset.storage_path) : '';
    var visual = url ? '<img src="' + escapeHtml(safeUrl(url)) + '" alt="' + escapeHtml(member.name) + '" class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />' : '<div class="flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-105"><span class="font-display text-9xl text-moss/30">' + escapeHtml(member.fallback_initial || String(member.name || '').charAt(0)) + '</span></div>';
    return '<div class="bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-moss/50 transition-all duration-300 flex flex-col h-full"><div class="group relative w-full h-96 overflow-hidden bg-gradient-to-br from-moss/15 via-neutral-900 to-black">' + visual + '<div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div><div class="absolute bottom-4 left-4 right-4"><h3 class="text-xl font-serif text-white font-bold leading-tight">' + escapeHtml(member.name) + '</h3><p class="text-xs text-moss font-semibold uppercase tracking-wider mt-1">' + escapeHtml(member.specialty || 'Специалист') + '</p></div></div><div class="p-5 flex-1 flex flex-col"><p class="text-xs text-mist/70 font-light leading-relaxed">' + escapeHtml(member.description || '') + '</p></div></div>';
  }

  function applyTeam(categories, members, media) {
    (categories || []).forEach(function (category) {
      var panel = document.getElementById('tab-' + category.slug);
      if (!panel) return;
      var list = (members || []).filter(function (member) { return member.category_id === category.id && member.is_published !== false; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
      panel.innerHTML = '<div class="reveal-stagger mx-auto grid max-w-3xl grid-cols-1 items-start gap-6 sm:grid-cols-2">' + list.map(function (member) { return teamCard(member, media); }).join('') + '</div>';
    });
    (categories || []).sort(function (a, b) { return a.sort_order - b.sort_order; }).forEach(function (category) {
      var button = document.querySelector('#team [data-tab="' + CSS.escape(category.slug) + '"]');
      if (button) button.textContent = category.title;
    });
  }

  function applyMedia(media, slots) {
    var published = (media || []).filter(function (item) { return item.is_published !== false; });
    var videos = published.filter(function (item) { return item.media_kind === 'video' && /\.mp4$|video\//i.test(item.mime_type || item.storage_path); });
    var reel = document.querySelector('.video-reel-strip');
    if (reel && videos.length) {
      reel.innerHTML = videos.map(function (item) { var url = safeUrl(assetUrl(item.storage_path)); if (!url) return ''; return '<article><div class="video-reel-frame"><video controls playsinline preload="none" poster="' + escapeHtml(safeUrl(assetUrl((published.find(function (p) { return p.original_name === item.original_name.replace(/\.mp4$/i, '.jpg'); }) || {}).storage_path))) + '" aria-label="' + escapeHtml(item.alt_text || item.original_name) + '"><source src="' + escapeHtml(url) + '" type="' + escapeHtml(item.mime_type || 'video/mp4') + '" /></video></div><h3 class="mt-3 text-base font-semibold">' + escapeHtml(item.alt_text || item.original_name) + '</h3></article>'; }).join('');
    }
    var images = published.filter(function (item) { return item.media_kind === 'image'; }).sort(function (a, b) {
      var sa = (slots || []).find(function (slot) { return slot.asset_id === a.id; });
      var sb = (slots || []).find(function (slot) { return slot.asset_id === b.id; });
      return (sa ? sa.sort_order : 9999) - (sb ? sb.sort_order : 9999);
    }).slice(0, 12);
    var track = document.querySelector('.billboard-track > div:first-child');
    if (track && images.length) track.innerHTML = images.map(function (item) { return '<div class="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-white/15 sm:h-28 sm:w-44 lg:h-32 lg:w-52"><img src="' + escapeHtml(safeUrl(assetUrl(item.storage_path))) + '" alt="' + escapeHtml(item.alt_text || item.original_name) + '" class="h-full w-full object-cover" loading="lazy" decoding="async" /></div>'; }).join('');
    var duplicate = document.querySelector('.billboard-track > div[aria-hidden="true"]');
    if (duplicate && track) duplicate.innerHTML = track.innerHTML.replace(/alt="[^"]*"/g, 'alt=""');
  }

  function applyContacts(contact) {
    if (!contact) return;
    var values = document.querySelectorAll('#contacts .mt-6.space-y-3 p');
    if (values[0] && contact.address) values[0].lastChild.textContent = ' ' + contact.address;
    if (values[1] && contact.phone_display) { var link = values[1].querySelector('a'); if (link) { link.textContent = contact.phone_display; link.href = contact.phone_href || ('tel:' + contact.phone_display.replace(/[^+\d]/g, '')); } }
    if (values[2] && contact.hours_display) values[2].lastChild.textContent = ' ' + contact.hours_display;
    var telegram = document.querySelector('#contacts a[href*="t.me"]'); if (telegram && contact.telegram_url) telegram.href = safeUrl(contact.telegram_url, telegram.href);
    var booking = document.querySelector('#booking a'); if (booking && contact.booking_url) booking.href = safeUrl(contact.booking_url, booking.href);
    var map = document.querySelector('#contacts iframe'); if (map && contact.map_embed_url) map.src = safeUrl(contact.map_embed_url, map.src);
    var mapLink = document.querySelector('#contacts a[href*="yandex.ru/maps"]'); if (mapLink && contact.map_url) mapLink.href = safeUrl(contact.map_url, mapLink.href);
  }

  function loadPublicContent() {
    if (!client) return;
    Promise.all([
      client.from('content_blocks').select('key,value,is_published'),
      client.from('service_categories').select('*'),
      client.from('service_groups').select('*'),
      client.from('service_items').select('*'),
      client.from('media_assets').select('*'),
      client.from('media_slots').select('*'),
      client.from('team_categories').select('*'),
      client.from('team_members').select('*'),
      client.from('contact_info').select('*').eq('id', 1).maybeSingle()
    ]).then(function (results) {
      var failed = results.find(function (result) { return result.error; });
      if (failed || !results[0].data) return;
      var map = contentMap(results[0].data);
      applyTexts(map);
      applyServices(results[1].data, results[2].data, results[3].data, map);
      applyMedia(results[4].data, results[5].data);
      applyTeam(results[6].data, results[7].data, results[4].data);
      applyContacts(results[8].data);
    }).catch(function () {
      // Keep the original document untouched when the network is unavailable.
    });
  }

  if (client) loadPublicContent();
  else window.addEventListener('shi:supabase-ready', loadPublicContent, { once: true });
}());

