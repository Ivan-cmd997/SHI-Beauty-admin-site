(function () {
  'use strict';

  const state = {
    client: window.shiSupabase,
    user: null,
    view: 'dashboard',
    serviceCategories: [],
    serviceGroups: [],
    services: [],
    media: [],
    slots: [],
    teamCategories: [],
    team: [],
    texts: [],
    contacts: null,
    history: [],
    mediaFilter: 'all'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatDate = (value) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const labelDate = () => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date());

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.textContent = message;
    $('#toast-region').append(node);
    setTimeout(() => node.remove(), 4200);
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    const loader = $('.button-loader', button);
    if (loader) loader.hidden = !busy;
    const text = $('span:first-child', button);
    if (text && button.dataset.busyText) text.textContent = busy ? button.dataset.busyText : button.dataset.defaultText;
  }

  function friendlyError(error) {
    const message = error?.message || 'Не удалось выполнить действие';
    if (message.toLowerCase().includes('invalid login credentials')) return 'Неверная почта или пароль. Проверьте учётную запись в Supabase Auth.';
    if (message.toLowerCase().includes('email not confirmed')) return 'Почта пользователя не подтверждена. Подтвердите её в Supabase Auth или отключите подтверждение email для теста.';
    if (message.toLowerCase().includes('row-level')) return 'Недостаточно прав. Проверьте, что пользователь добавлен как администратор.';
    if (message.toLowerCase().includes('jwt')) return 'Сессия истекла. Войдите в панель ещё раз.';
    return message;
  }

  function showAuth() {
    $('#auth-screen').hidden = false;
    $('#auth-screen').style.display = 'grid';
    $('#app-shell').hidden = true;
    $('#app-shell').style.display = 'none';
  }

  function showApp() {
    $('#auth-screen').hidden = true;
    $('#auth-screen').style.display = 'none';
    $('#app-shell').hidden = false;
    $('#app-shell').style.display = 'flex';
  }

  function showView(view) {
    state.view = view;
    $$('.view').forEach((panel) => panel.classList.toggle('active', panel.id === `view-${view}`));
    $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
    const title = $(`.nav-item[data-view="${view}"]`)?.textContent.trim() || 'Обзор';
    $('#page-title').textContent = title;
    $('#sidebar').classList.remove('open');
    if (view === 'services') renderServices();
    if (view === 'media') renderMedia();
    if (view === 'team') renderTeam();
    if (view === 'texts') renderTexts();
    if (view === 'contacts') renderContacts();
    if (view === 'history') renderHistory();
  }

  function localAssetUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('site/')) return `../img/${encodeURIComponent(path.slice(5)).replace(/%2F/g, '/')}`;
    return '';
  }

  function publicAssetUrl(path) {
    if (!path || !state.client) return localAssetUrl(path);
    const result = state.client.storage.from('site-media').getPublicUrl(path);
    return result.data?.publicUrl || localAssetUrl(path);
  }

  async function loadData() {
    const tables = ['service_categories','service_groups','service_items','media_assets','media_slots','team_categories','team_members','content_blocks','contact_info','content_revisions'];
    const results = await Promise.all(tables.map((table) => state.client.from(table).select('*')));
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
    [state.serviceCategories, state.serviceGroups, state.services, state.media, state.slots, state.teamCategories, state.team, state.texts, [state.contacts], state.history] = results.map((result) => result.data || []);
    state.contacts = state.contacts?.[0] || null;
    state.media.forEach((asset) => { asset.url = publicAssetUrl(asset.storage_path); });
    updateDashboard();
    renderServices(); renderMedia(); renderTeam(); renderTexts(); renderContacts(); renderHistory();
  }

  function updateDashboard() {
    $('#today-label').textContent = labelDate();
    const name = state.user?.user_metadata?.full_name || state.user?.email?.split('@')[0] || 'администратор';
    const niceName = name.charAt(0).toUpperCase() + name.slice(1);
    $('#profile-name').textContent = niceName;
    $('#greeting-name').textContent = `, ${niceName}`;
    $('#profile-email').textContent = state.user?.email || '';
    $('#user-chip-name').textContent = niceName;
    $('#stat-services').textContent = state.services.length;
    $('#stat-team').textContent = state.team.length;
    $('#stat-media').textContent = state.media.length;
    const latest = state.history.slice().sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at))[0];
    $('#last-change').textContent = latest ? formatDate(latest.changed_at) : 'Пока нет изменений';
  }

  function renderServices() {
    if (!$('#services-list')) return;
    const search = ($('#service-search')?.value || '').toLowerCase().trim();
    const filter = $('#service-category-filter')?.value || 'all';
    const options = state.serviceCategories.slice().sort((a,b) => a.sort_order - b.sort_order).map((category) => `<option value="${esc(category.id)}">${esc(category.title)}</option>`).join('');
    if ($('#service-category-filter') && $('#service-category-filter').options.length !== state.serviceCategories.length + 1) $('#service-category-filter').insertAdjacentHTML('beforeend', options);
    if ($('#service-form-category')) $('#service-form-category').innerHTML = options;
    const groups = state.serviceGroups.slice().sort((a,b) => a.sort_order - b.sort_order);
    const html = state.serviceCategories.slice().sort((a,b) => a.sort_order - b.sort_order).filter((category) => filter === 'all' || filter === category.id).map((category) => {
      const categoryGroups = groups.filter((group) => group.category_id === category.id);
      const items = categoryGroups.flatMap((group) => state.services.filter((item) => item.group_id === group.id).map((item) => ({...item, groupTitle: group.title})));
      const visible = items.filter((item) => !search || `${item.name} ${item.description} ${item.groupTitle}`.toLowerCase().includes(search));
      if (!visible.length) return '';
      return `<article class="category-card"><header class="category-head"><h2>${esc(category.title)}</h2><span>${visible.length} ${visible.length === 1 ? 'позиция' : 'позиций'}</span></header>${visible.sort((a,b) => a.sort_order - b.sort_order).map((item) => `<div class="service-row"><div><strong>${esc(item.name)}</strong>${item.description ? `<small>${esc(item.description)}</small>` : ''}</div><span class="price">${esc(item.price_text || 'По запросу')}</span><span class="status-pill ${item.is_published ? 'status-live' : ''}">${item.is_published ? 'На сайте' : 'Черновик'}</span><div class="row-actions"><button class="small-button" data-edit-service="${item.id}" aria-label="Редактировать ${esc(item.name)}">✎</button><button class="small-button danger" data-delete-service="${item.id}" aria-label="Удалить ${esc(item.name)}">×</button></div></div>`).join('')}</article>`;
    }).join('');
    $('#services-list').innerHTML = html || '<div class="empty-state">Услуги не найдены. Измените фильтр или добавьте новую услугу.</div>';
  }

  function renderMedia() {
    if (!$('#media-grid')) return;
    const counts = { all: state.media.length, image: 0, video: 0, audio: 0 };
    state.media.forEach((asset) => { if (counts[asset.media_kind] !== undefined) counts[asset.media_kind] += 1; });
    Object.entries(counts).forEach(([key, value]) => { const node = $(`#count-${key}`); if (node) node.textContent = value; });
    $$('.filter-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mediaFilter === state.mediaFilter));
    const sorted = state.media.filter((asset) => state.mediaFilter === 'all' || asset.media_kind === state.mediaFilter).slice().sort((a,b) => {
      const slotA = state.slots.find((slot) => slot.asset_id === a.id)?.sort_order ?? 9999;
      const slotB = state.slots.find((slot) => slot.asset_id === b.id)?.sort_order ?? 9999;
      return slotA - slotB;
    });
    $('#media-grid').innerHTML = sorted.length ? sorted.map((asset, index) => {
      const slot = state.slots.find((item) => item.asset_id === asset.id);
      const preview = asset.media_kind === 'video' ? `<video src="${esc(asset.url)}" muted playsinline preload="metadata"></video>` : asset.media_kind === 'audio' ? '<div class="audio-placeholder">)))</div>' : `<img src="${esc(asset.url)}" alt="${esc(asset.alt_text || asset.original_name)}" loading="lazy">`;
      return `<article class="media-card"><div class="media-thumb">${preview}<span class="media-kind">${asset.media_kind === 'image' ? 'Фото' : asset.media_kind === 'video' ? 'Видео' : 'Звук'}</span></div><div class="media-card-body"><strong title="${esc(asset.original_name)}">${esc(asset.original_name || 'Без названия')}</strong><small>${esc(asset.alt_text || 'Без описания')}</small><div class="media-card-foot"><span class="muted">${slot ? `Позиция ${slot.sort_order + 1}` : 'Не опубликовано'}</span><div class="row-actions"><button class="small-button" data-preview-media="${asset.id}" aria-label="Предпросмотр">◉</button><button class="small-button" data-replace-media="${asset.id}" aria-label="Заменить материал">↻</button><button class="small-button" data-move-media="${asset.id}" data-direction="up" aria-label="Поднять выше">↑</button><button class="small-button" data-move-media="${asset.id}" data-direction="down" aria-label="Опустить ниже">↓</button><button class="small-button danger" data-delete-media="${asset.id}" aria-label="Удалить">×</button></div></div></div></article>`;
    }).join('') : '<div class="empty-state">В этой категории пока нет материалов.</div>';
  }

  function renderTeam() {
    if (!$('#team-list')) return;
    const html = state.teamCategories.slice().sort((a,b) => a.sort_order - b.sort_order).map((category) => {
      const members = state.team.filter((member) => member.category_id === category.id).sort((a,b) => a.sort_order - b.sort_order);
      return `<article class="team-category"><div class="team-category-head"><h2>${esc(category.title)}</h2><span class="team-category-count">${members.length} ${members.length === 1 ? 'мастер' : 'мастера'}</span></div><div class="team-grid">${members.map((member) => { const asset = state.media.find((item) => item.id === member.photo_asset_id); const photo = asset?.url ? `<img src="${esc(asset.url)}" alt="${esc(member.name)}" loading="lazy">` : esc(member.fallback_initial || member.name?.charAt(0) || 'S'); return `<div class="team-card"><div class="team-photo">${photo}</div><div class="team-body"><strong>${esc(member.name)}</strong><small>${esc(member.specialty || 'Специалист')}</small><div class="team-actions"><button class="small-button" data-edit-team="${member.id}" aria-label="Редактировать ${esc(member.name)}">✎</button><button class="small-button danger" data-delete-team="${member.id}" aria-label="Удалить ${esc(member.name)}">×</button></div></div></div>`; }).join('')}</div></article>`;
    }).join('');
    $('#team-list').innerHTML = html || '<div class="empty-state">Добавьте первого мастера.</div>';
    if ($('#team-form-category')) $('#team-form-category').innerHTML = state.teamCategories.map((category) => `<option value="${esc(category.id)}">${esc(category.title)}</option>`).join('');
  }

  function renderTexts() {
    if (!$('#texts-list')) return;
    const grouped = state.texts.slice().sort((a,b) => a.section.localeCompare(b.section) || a.key.localeCompare(b.key));
    $('#texts-list').innerHTML = grouped.length ? grouped.map((text) => `<article class="text-card"><div class="text-card-head"><div><span class="text-section">${esc(text.section)}</span><h2>${esc(text.key)}</h2></div><button class="small-button" data-edit-text="${esc(text.key)}" aria-label="Редактировать текст">✎</button></div><p class="text-value">${esc(text.value)}</p><span class="status-pill ${text.is_published ? 'status-live' : ''}">${text.is_published ? 'Опубликовано' : 'Черновик'}</span></article>`).join('') : '<div class="empty-state">Тексты пока не загружены.</div>';
  }

  function renderContacts() {
    if (!state.contacts || !$('#contacts-form')) return;
    const form = $('#contacts-form');
    ['address','phone_display','phone_href','hours_display','telegram_url','booking_url','map_url'].forEach((field) => { if (form.elements[field]) form.elements[field].value = state.contacts[field] || ''; });
    $('#contacts-updated').textContent = state.contacts.updated_at ? `Обновлено ${formatDate(state.contacts.updated_at)}` : '—';
  }

  function renderHistory() {
    if (!$('#history-list')) return;
    const rows = state.history.slice().sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at));
    $('#history-list').innerHTML = rows.length ? rows.map((row) => `<article class="history-row"><span class="history-time">${formatDate(row.changed_at)}</span><span class="history-operation">${esc(row.operation)}</span><strong>${esc(row.table_name)} · ${esc(row.row_key)}</strong>${row.before_data ? `<button class="button button-quiet" data-restore="${row.id}">Восстановить</button>` : '<span class="muted">Начальная запись</span>'}</article>`).join('') : '<div class="empty-state">История появится после первого изменения.</div>';
  }

  function openDialog(id) { const dialog = document.getElementById(id); if (dialog?.showModal) dialog.showModal(); else dialog?.setAttribute('open',''); }
  function closeDialogs() { $$('dialog[open]').forEach((dialog) => dialog.close()); }

  function fillServiceForm(item = null) {
    const form = $('#service-form');
    form.reset();
    form.elements.id.value = item?.id || '';
    form.elements.name.value = item?.name || '';
    form.elements.category_id.value = state.serviceGroups.find((group) => group.id === item?.group_id)?.category_id || state.serviceCategories[0]?.id || '';
    form.elements.price_text.value = item?.price_text || '';
    form.elements.description.value = item?.description || '';
    form.elements.is_published.checked = item ? item.is_published : true;
    $('#service-dialog-title').textContent = item ? 'Изменить услугу' : 'Новая услуга';
    openDialog('service-dialog');
  }

  async function saveService(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const categoryId = data.category_id;
    let group = state.serviceGroups.find((item) => item.category_id === categoryId);
    if (!group) {
      const category = state.serviceCategories.find((item) => item.id === categoryId);
      const result = await state.client.from('service_groups').insert({ category_id: categoryId, slug: `admin-${Date.now()}`, title: category?.title || 'Основные услуги', sort_order: 0 }).select().single();
      if (result.error) throw result.error;
      group = result.data;
      state.serviceGroups.push(group);
    }
    const payload = { group_id: group.id, name: data.name.trim(), price_text: data.price_text.trim() || null, description: data.description.trim(), is_published: form.elements.is_published.checked };
    const request = data.id ? state.client.from('service_items').update(payload).eq('id', data.id) : state.client.from('service_items').insert({...payload, sort_order: state.services.filter((item) => item.group_id === group.id).length});
    const result = await request;
    if (result.error) throw result.error;
    closeDialogs(); await loadData(); toast('Услуга сохранена');
  }

  function confirmAction(title, copy, action) {
    window.__shiPendingAction = action;
    $('#confirm-title').textContent = title; $('#confirm-copy').textContent = copy; openDialog('confirm-dialog');
  }

  async function deleteService(id) { const item = state.services.find((service) => service.id === id); confirmAction(`Удалить «${item?.name || 'услугу'}»?`, 'Услуга исчезнет из каталога сайта. Это действие можно восстановить через историю.', async () => { const result = await state.client.from('service_items').delete().eq('id', id); if (result.error) throw result.error; await loadData(); toast('Услуга удалена'); }); }
  async function deleteTeam(id) { const item = state.team.find((member) => member.id === id); confirmAction(`Удалить карточку ${item?.name || 'мастера'}?`, 'Карточка будет удалена с сайта. Изображение в медиатеке сохранится.', async () => { const result = await state.client.from('team_members').delete().eq('id', id); if (result.error) throw result.error; await loadData(); toast('Карточка удалена'); }); }
  async function deleteMedia(id) { const item = state.media.find((asset) => asset.id === id); confirmAction('Удалить этот материал?', 'Если он используется в карточке или блоке, Supabase сохранит его до отвязки.', async () => { const result = await state.client.from('media_assets').delete().eq('id', id); if (result.error) throw result.error; if (item?.storage_path && !item.storage_path.startsWith('site/')) await state.client.storage.from('site-media').remove([item.storage_path]); await loadData(); toast('Материал удалён'); }); }

  async function uploadAsset(file, kind, altText) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `admin/${kind}/${crypto.randomUUID()}.${extension}`;
    const upload = await state.client.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upload.error) throw upload.error;
    const inserted = await state.client.from('media_assets').insert({ storage_path: path, media_kind: kind, mime_type: file.type, original_name: file.name, alt_text: altText || '', metadata: { size: file.size } }).select().single();
    if (inserted.error) { await state.client.storage.from('site-media').remove([path]); throw inserted.error; }
    if (kind === 'image') await state.client.from('media_slots').insert({ slot_key: `gallery-${inserted.data.id}`, asset_id: inserted.data.id, sort_order: state.slots.length });
    return inserted.data;
  }

  async function replaceAsset(id, file) {
    const asset = state.media.find((item) => item.id === id);
    if (!asset) return;
    const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `admin/${kind}/${crypto.randomUUID()}.${extension}`;
    const upload = await state.client.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upload.error) throw upload.error;
    const result = await state.client.from('media_assets').update({ storage_path: path, media_kind: kind, mime_type: file.type, original_name: file.name, metadata: { size: file.size } }).eq('id', id);
    if (result.error) { await state.client.storage.from('site-media').remove([path]); throw result.error; }
    if (asset.storage_path && !asset.storage_path.startsWith('site/')) await state.client.storage.from('site-media').remove([asset.storage_path]);
    await loadData();
    toast('Материал заменён');
  }

  async function moveMedia(id, direction) {
    const asset = state.media.find((item) => item.id === id);
    if (!asset || asset.media_kind !== 'image') return;
    let slot = state.slots.find((item) => item.asset_id === id);
    if (!slot) {
      const created = await state.client.from('media_slots').insert({ slot_key: `gallery-${id}`, asset_id: id, sort_order: state.slots.length }).select().single();
      if (created.error) throw created.error;
      slot = created.data;
      state.slots.push(slot);
    }
    const ordered = state.media.filter((item) => item.media_kind === 'image').slice().sort((a,b) => (state.slots.find((s) => s.asset_id === a.id)?.sort_order ?? 9999) - (state.slots.find((s) => s.asset_id === b.id)?.sort_order ?? 9999));
    const currentIndex = ordered.findIndex((item) => item.id === id);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const other = ordered[nextIndex];
    let otherSlot = state.slots.find((item) => item.asset_id === other.id);
    if (!otherSlot) {
      const created = await state.client.from('media_slots').insert({ slot_key: `gallery-${other.id}`, asset_id: other.id, sort_order: nextIndex }).select().single();
      if (created.error) throw created.error;
      otherSlot = created.data;
      state.slots.push(otherSlot);
    }
    const currentOrder = slot.sort_order;
    const result = await Promise.all([
      state.client.from('media_slots').update({ sort_order: otherSlot.sort_order }).eq('slot_key', slot.slot_key),
      state.client.from('media_slots').update({ sort_order: currentOrder }).eq('slot_key', otherSlot.slot_key)
    ]);
    const failed = result.find((item) => item.error); if (failed) throw failed.error;
    await loadData();
    toast('Порядок фотографий обновлён');
  }

  async function saveTeam(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    let photoAssetId = state.team.find((item) => item.id === data.id)?.photo_asset_id || null;
    const file = form.elements.photo.files[0];
    if (file) photoAssetId = (await uploadAsset(file, 'image', `Фото мастера ${data.name}`)).id;
    const payload = { name: data.name.trim(), specialty: data.specialty.trim(), description: data.description.trim(), category_id: data.category_id, photo_asset_id: photoAssetId, fallback_initial: data.name.trim().charAt(0), is_published: form.elements.is_published.checked };
    const request = data.id ? state.client.from('team_members').update(payload).eq('id', data.id) : state.client.from('team_members').insert({...payload, slug: `admin-${Date.now()}`, sort_order: state.team.filter((item) => item.category_id === data.category_id).length});
    const result = await request; if (result.error) throw result.error; closeDialogs(); await loadData(); toast('Карточка мастера сохранена');
  }

  async function saveText(form) { const data = Object.fromEntries(new FormData(form).entries()); const result = await state.client.from('content_blocks').update({ value: data.value, is_published: form.elements.is_published.checked }).eq('key', data.key); if (result.error) throw result.error; closeDialogs(); await loadData(); toast('Текст сохранён'); }

  async function initAuth() {
    if (!state.client) { showAuth(); $('#login-error').hidden = false; $('#login-error').textContent = 'Supabase не загрузился. Обновите страницу.'; return; }
    const sessionResult = await state.client.auth.getSession();
    if (sessionResult.error || !sessionResult.data.session) { showAuth(); return; }
    await enterApp(sessionResult.data.session.user);
    state.client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT') { state.user = null; showAuth(); } });
  }

  async function enterApp(user) {
    const admin = await state.client.from('admin_users').select('user_id, display_name, is_active').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (admin.error) { await state.client.auth.signOut(); showAuth(); $('#login-error').hidden = false; $('#login-error').textContent = `Ошибка проверки прав: ${friendlyError(admin.error)}`; return; }
    if (!admin.data) { await state.client.auth.signOut(); showAuth(); $('#login-error').hidden = false; $('#login-error').textContent = `Пользователь вошёл, но строка admin_users не найдена для UUID ${user.id}.`; return; }
    state.user = user; showApp();
    try { await loadData(); } catch (error) { toast(friendlyError(error), 'error'); }
  }

  $('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = $('button[type="submit"]', event.currentTarget); setBusy(button, true); $('#login-error').hidden = true; try { if (!state.client) throw new Error('Не удалось подключиться к Supabase. Обновите страницу или проверьте подключение.'); const result = await state.client.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value }); if (result.error) throw result.error; await enterApp(result.data.user); } catch (error) { $('#login-error').hidden = false; $('#login-error').textContent = friendlyError(error); } finally { setBusy(button, false); } });
  $$('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => { const input = $('#login-password'); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Показать' : 'Скрыть'; }));
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('[data-view]'); if (nav) { showView(nav.dataset.view); if (nav.dataset.mediaFilter) { state.mediaFilter = nav.dataset.mediaFilter; renderMedia(); } return; }
    if (event.target.closest('[data-open-sidebar]')) $('#sidebar').classList.add('open');
    if (event.target.closest('[data-close-sidebar]')) $('#sidebar').classList.remove('open');
    const editService = event.target.closest('[data-edit-service]'); if (editService) fillServiceForm(state.services.find((item) => item.id === editService.dataset.editService));
    const deleteServiceButton = event.target.closest('[data-delete-service]'); if (deleteServiceButton) await deleteService(deleteServiceButton.dataset.deleteService);
    const editTeam = event.target.closest('[data-edit-team]'); if (editTeam) { const member = state.team.find((item) => item.id === editTeam.dataset.editTeam); const form = $('#team-form'); form.reset(); form.elements.id.value = member.id; form.elements.name.value = member.name; form.elements.specialty.value = member.specialty; form.elements.category_id.value = member.category_id; form.elements.description.value = member.description; form.elements.is_published.checked = member.is_published; $('#team-dialog-title').textContent = 'Изменить карточку'; openDialog('team-dialog'); }
    const deleteTeamButton = event.target.closest('[data-delete-team]'); if (deleteTeamButton) await deleteTeam(deleteTeamButton.dataset.deleteTeam);
    const editText = event.target.closest('[data-edit-text]'); if (editText) { const text = state.texts.find((item) => item.key === editText.dataset.editText); const form = $('#text-form'); form.reset(); form.elements.key.value = text.key; form.elements.value.value = text.value; form.elements.is_published.checked = text.is_published; $('#text-context').textContent = `${text.section} · ${text.key}`; $('#text-preview').textContent = text.value; openDialog('text-dialog'); }
    const deleteMediaButton = event.target.closest('[data-delete-media]'); if (deleteMediaButton) await deleteMedia(deleteMediaButton.dataset.deleteMedia);
    const replaceMediaButton = event.target.closest('[data-replace-media]'); if (replaceMediaButton) { const input = $('#replace-file'); input.dataset.assetId = replaceMediaButton.dataset.replaceMedia; input.value = ''; input.click(); }
    const moveMediaButton = event.target.closest('[data-move-media]'); if (moveMediaButton) { try { await moveMedia(moveMediaButton.dataset.moveMedia, moveMediaButton.dataset.direction); } catch (error) { toast(friendlyError(error), 'error'); } }
    const previewMedia = event.target.closest('[data-preview-media]'); if (previewMedia) { const item = state.media.find((asset) => asset.id === previewMedia.dataset.previewMedia); if (item?.url) window.open(item.url, '_blank', 'noopener'); }
    const restore = event.target.closest('[data-restore]'); if (restore) confirmAction('Восстановить эту версию?', 'Текущие данные сохранятся в истории, а выбранная версия станет активной.', async () => { const result = await state.client.rpc('restore_content_revision', { p_revision_id: Number(restore.dataset.restore) }); if (result.error) throw result.error; await loadData(); toast('Версия восстановлена'); });
    const filter = event.target.closest('[data-media-filter]'); if (filter && filter.closest('#media-filter-tabs')) { state.mediaFilter = filter.dataset.mediaFilter; renderMedia(); }
  });

  $('#add-service').addEventListener('click', () => fillServiceForm());
  $('#add-team').addEventListener('click', () => { const form = $('#team-form'); form.reset(); form.elements.id.value = ''; form.elements.is_published.checked = true; $('#team-dialog-title').textContent = 'Новый мастер'; openDialog('team-dialog'); });
  $('#upload-media').addEventListener('click', () => { $('#media-form').reset(); $('#media-preview').innerHTML = '<span>Предпросмотр появится здесь</span>'; openDialog('media-dialog'); });
  $('#media-file').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const url = URL.createObjectURL(file); const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image'; $('#media-preview').innerHTML = kind === 'video' ? `<video src="${url}" controls></video>` : kind === 'audio' ? `<audio src="${url}" controls></audio>` : `<img src="${url}" alt="Предпросмотр">`; });
  $('#replace-file').addEventListener('change', async (event) => { const file = event.target.files[0]; const id = event.target.dataset.assetId; if (!file || !id) return; try { await replaceAsset(id, file); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#text-form [name="value"]').addEventListener('input', (event) => { $('#text-preview').textContent = event.target.value || 'Предпросмотр текста'; });
  $('#service-search').addEventListener('input', renderServices); $('#service-category-filter').addEventListener('change', renderServices);
  $('#contacts-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); const result = await state.client.from('contact_info').update(data).eq('id', 1); if (result.error) { toast(friendlyError(result.error), 'error'); return; } await loadData(); toast('Контакты сохранены'); });
  $('#service-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveService(event.currentTarget); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#team-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveTeam(event.currentTarget); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#text-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveText(event.currentTarget); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#media-form').addEventListener('submit', async (event) => { event.preventDefault(); const file = $('#media-file').files[0]; if (!file) return; try { const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image'; await uploadAsset(file, kind, event.currentTarget.elements.alt_text.value.trim()); closeDialogs(); await loadData(); toast('Материал загружен'); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#confirm-form').addEventListener('submit', async (event) => { event.preventDefault(); const action = window.__shiPendingAction; if (!action) return; try { await action(); window.__shiPendingAction = null; closeDialogs(); } catch (error) { toast(friendlyError(error), 'error'); } });
  $('#confirm-action').addEventListener('click', (event) => { event.preventDefault(); $('#confirm-form').requestSubmit(); });
  $('#profile-button').addEventListener('click', async () => { if (confirm('Выйти из панели?')) await state.client.auth.signOut(); });
  window.__shiPendingAction = null;
  initAuth();
})();
