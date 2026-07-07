/* ============================================================
   Viajes — app de pre-viaje y equipaje (PWA sin build)
   Datos en localStorage. Todo editable, sin servidor.
   ============================================================ */

/* Los avisos son notificaciones locales nativas y solo existen en la app de Android
   (Capacitor). En la PWA (iOS/escritorio) no hay notificaciones. Ver CLAUDE.md. */

'use strict';

/* ---------- Utilidades ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const clampInt = (n) => Math.max(0, Math.floor(Number(n) || 0));

/* ---------- Estados posibles de un artículo ---------- */
const STATUSES = [
  { id: 'pending',   label: 'Pendiente',            short: 'Pend.' },
  { id: 'to_wash',   label: 'Pendiente de lavar',   short: 'Lavar' },
  { id: 'to_dry',    label: 'Pendiente de secar',   short: 'Secar' },
  { id: 'to_charge', label: 'Pendiente de cargar',  short: 'Cargar' },
  { id: 'to_buy',    label: 'Pendiente de comprar', short: 'Comprar' },
  { id: 'ready',     label: 'Listo',                short: 'Listo' },
];
const statusLabel = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;

/* Tipos de trayecto */
const LEG_TYPES = [
  { id: 'flight', label: 'Vuelo',   icon: '✈' },
  { id: 'train',  label: 'Tren',    icon: '▤' },
  { id: 'bus',    label: 'Bus',     icon: '▮' },
  { id: 'car',    label: 'Coche',   icon: '◉' },
  { id: 'boat',   label: 'Barco',   icon: '⚓' },
  { id: 'other',  label: 'Otro',    icon: '•' },
];
const legType = (id) => LEG_TYPES.find((t) => t.id === id) || LEG_TYPES[5];

/* ---------- Almacenamiento ---------- */
const KEY = 'viajes_app_v1';
const store = {
  data: { trips: [], templates: [] },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) { /* datos corruptos: empezamos limpios */ }
    if (!this.data.trips) this.data.trips = [];
    if (!this.data.templates) this.data.templates = [];
    this.migrate();
    if (this.data.templates.length === 0) this.seedTemplates();
  },
  save() {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  },
  // Aplana el antiguo 3er nivel: los subartículos pasan a ser artículos de la lista.
  // El artículo que solo servía de contenedor se descarta. Idempotente (seguro en cada carga).
  migrate() {
    const flatten = (lists) => (lists || []).map((l) => {
      const items = [];
      for (const it of (l.items || [])) {
        if ((it.subitems || []).length) {
          for (const s of it.subitems) {
            items.push({ id: s.id || uid(), name: s.name, qtyWanted: s.qtyWanted, qtyDone: s.qtyDone, status: s.status });
          }
        } else {
          items.push({ id: it.id, name: it.name, qtyWanted: it.qtyWanted, qtyDone: it.qtyDone, status: it.status });
        }
      }
      return { id: l.id, name: l.name, items };
    });
    for (const t of this.data.trips) t.lists = flatten(t.lists);
    for (const t of this.data.templates) t.lists = flatten(t.lists);
  },
  seedTemplates() {
    // Plantilla de ejemplo para arrancar (editable/borrable)
    this.data.templates.push({
      id: uid(),
      name: 'Viaje largo (avión)',
      lists: [
        { id: uid(), name: 'Ropa Maleta', items: [
          { id: uid(), name: 'Camisetas', qtyWanted: 6, qtyDone: 0, status: 'to_wash' },
          { id: uid(), name: 'Pantalones', qtyWanted: 3, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Ropa interior', qtyWanted: 8, qtyDone: 0, status: 'to_wash' },
          { id: uid(), name: 'Calzado', qtyWanted: 2, qtyDone: 0, status: 'pending' },
        ]},
        { id: uid(), name: 'Neceser Maleta', items: [
          { id: uid(), name: 'Cepillo de dientes', qtyWanted: 1, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Pasta de dientes', qtyWanted: 1, qtyDone: 0, status: 'to_buy' },
        ]},
        { id: uid(), name: 'Mochila (mano)', items: [
          { id: uid(), name: 'Móvil', qtyWanted: 1, qtyDone: 0, status: 'to_charge' },
          { id: uid(), name: 'Powerbank', qtyWanted: 1, qtyDone: 0, status: 'to_charge' },
          { id: uid(), name: 'Pasaporte', qtyWanted: 1, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Adaptador de enchufe', qtyWanted: 1, qtyDone: 0, status: 'to_buy' },
        ]},
      ],
    });
    this.save();
  },
};

/* ---------- Constructores de datos ---------- */
function newItem(name = '') {
  return { id: uid(), name, qtyWanted: 1, qtyDone: 0, status: 'pending' };
}
function newList(name = 'Nueva lista') {
  return { id: uid(), name, items: [] };
}
// Copia profunda de listas (para clonar plantillas) reseteando cantidades introducidas
function cloneLists(lists, reset = true) {
  return lists.map((l) => ({
    id: uid(),
    name: l.name,
    items: (l.items || []).map((it) => ({
      id: uid(),
      name: it.name,
      qtyWanted: it.qtyWanted,
      qtyDone: reset ? 0 : it.qtyDone,
      status: it.status,
    })),
  }));
}

/* ---------- Cálculo de pendientes ---------- */
// Un artículo está pendiente si faltan unidades por meter o el estado no es "listo".
function nodePending(n) {
  const missing = clampInt(n.qtyWanted) - clampInt(n.qtyDone);
  return missing > 0 || n.status !== 'ready';
}
function tripPendingCount(trip) {
  let count = 0;
  for (const l of trip.lists) for (const it of l.items) if (nodePending(it)) count++;
  return count;
}
function tripTotalCount(trip) {
  let count = 0;
  for (const l of trip.lists) count += l.items.length;
  return count;
}

/* ---------- Fechas ---------- */
const DAY = 86400000, HOUR = 3600000;
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
// Interpreta "YYYY-MM-DD" como hora local (no UTC); deja datetime-local tal cual.
function toLocalDate(iso) {
  return new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
}
// Cuenta atrás legible hasta una fecha
function countdown(iso) {
  if (!iso) return { text: 'SIN FECHA', past: false };
  const ms = toLocalDate(iso).getTime() - Date.now();
  if (ms <= 0) return { text: 'EN CURSO / PASADO', past: true };
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / 60000);
  if (d > 0) return { text: `${d}D ${String(h).padStart(2, '0')}H`, past: false };
  if (h > 0) return { text: `${h}H ${String(m).padStart(2, '0')}M`, past: false };
  return { text: `${m}M`, past: false };
}

/* ============================================================
   ROUTER / ESTADO DE VISTA
   ============================================================ */
const view = { name: 'home', tripId: null, templateId: null, tab: 'lists' };
const app = $('#app');

function go(name, opts = {}) {
  Object.assign(view, { tripId: null, templateId: null }, opts, { name });
  render();
  window.scrollTo(0, 0);
}
function currentTrip() { return store.data.trips.find((t) => t.id === view.tripId); }
function currentTemplate() { return store.data.templates.find((t) => t.id === view.templateId); }

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  if (view.name === 'trip' && !currentTrip()) view.name = 'home';
  if (view.name === 'template' && !currentTemplate()) view.name = 'templates';

  let html = '';
  if (view.name === 'home') html = renderHome();
  else if (view.name === 'templates') html = renderTemplates();
  else if (view.name === 'template') html = renderTemplateEditor();
  else if (view.name === 'trip') html = renderTrip();
  app.innerHTML = html;
  bindDynamic();
}

/* ---------- Cabecera / navegación inferior ---------- */
function bottomNav(active) {
  const item = (id, label, icon) =>
    `<button class="nav-item ${active === id ? 'is-active' : ''}" data-nav="${id}">
       <span class="nav-ico">${icon}</span><span>${label}</span>
     </button>`;
  return `<nav class="bottomnav">
    ${item('home', 'Viajes', '⌂')}
    ${item('templates', 'Plantillas', '❑')}
    ${item('notify', 'Avisos', '◔')}
  </nav>`;
}

/* ---------- HOME: lista de viajes ---------- */
function renderHome() {
  const trips = [...store.data.trips].sort((a, b) =>
    (a.startDate || '9999').localeCompare(b.startDate || '9999'));

  const cards = trips.map((t) => {
    const cd = countdown(t.startDate);
    const pend = tripPendingCount(t);
    const total = tripTotalCount(t);
    return `<button class="trip-card" data-open-trip="${t.id}">
      <div class="board">
        <div class="board-row">
          <span class="board-label">DESTINO</span>
          <span class="board-dest">${esc(t.name || 'Sin nombre')}</span>
        </div>
        <div class="board-row">
          <span class="board-label">SALIDA</span>
          <span class="board-mono">${t.startDate ? fmtDate(t.startDate).toUpperCase() : '— — —'}</span>
        </div>
        <div class="board-row">
          <span class="board-label">CUENTA ATRÁS</span>
          <span class="board-count ${cd.past ? 'past' : ''}">${cd.text}</span>
        </div>
      </div>
      <div class="trip-foot">
        <span class="pill ${pend ? 'warn' : 'ok'}">${pend ? pend + ' pendientes' : 'Todo listo'}</span>
        <span class="muted">${total} artículos · ${t.legs?.length || 0} trayectos</span>
      </div>
    </button>`;
  }).join('');

  const empty = `<div class="empty">
      <p class="empty-title">Aún no hay viajes</p>
      <p class="muted">Crea tu primer viaje para preparar listas y trayectos.</p>
    </div>`;

  return `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">◑</span> Mis Viajes</div>
    <button class="btn btn-primary" data-new-trip>+ Nuevo viaje</button>
  </header>
  <main class="wrap">
    ${trips.length ? `<div class="grid">${cards}</div>` : empty}
  </main>
  ${bottomNav('home')}`;
}

/* ---------- PLANTILLAS ---------- */
function renderTemplates() {
  const cards = store.data.templates.map((t) => `
    <div class="tpl-card">
      <button class="tpl-open" data-open-tpl="${t.id}">
        <span class="tpl-name">${esc(t.name)}</span>
        <span class="muted">${t.lists.length} listas</span>
      </button>
      <button class="icon-btn danger" data-del-tpl="${t.id}" title="Borrar plantilla">✕</button>
    </div>`).join('');

  return `
  <header class="topbar">
    <button class="btn ghost" data-nav="home">‹ Viajes</button>
    <div class="topbar-title">Plantillas</div>
    <button class="btn btn-primary" data-new-tpl>+ Nueva</button>
  </header>
  <main class="wrap">
    <p class="muted intro">Guarda listas base y reutilízalas al crear un viaje. Empieza desde cero o desde una plantilla.</p>
    ${store.data.templates.length ? `<div class="stack">${cards}</div>`
      : `<div class="empty"><p class="empty-title">Sin plantillas</p><p class="muted">Crea una o guarda un viaje como plantilla desde su pantalla.</p></div>`}
  </main>
  ${bottomNav('templates')}`;
}

function renderTemplateEditor() {
  const t = currentTemplate();
  return `
  <header class="topbar">
    <button class="btn ghost" data-nav="templates">‹ Plantillas</button>
    <div class="topbar-title">Editar plantilla</div>
    <span></span>
  </header>
  <main class="wrap">
    <label class="field">
      <span class="field-label">Nombre de la plantilla</span>
      <input class="input" data-tpl-name value="${esc(t.name)}" placeholder="p. ej. Escapada fin de semana">
    </label>
    ${renderListsBlock(t.lists, { context: 'template' })}
    <button class="btn wide" data-add-list-tpl>+ Añadir lista</button>
  </main>
  ${bottomNav('templates')}`;
}

/* ---------- VIAJE ---------- */
function renderTrip() {
  const t = currentTrip();
  const cd = countdown(t.startDate);
  const pend = tripPendingCount(t);

  const header = `
  <div class="trip-board">
    <div class="tb-row"><span class="tb-label">DESTINO</span>
      <input class="tb-dest" data-trip-name value="${esc(t.name)}" placeholder="¿A dónde vas?"></div>
    <div class="tb-dates">
      <label class="tb-date"><span>SALIDA</span>
        <input type="date" data-trip-start value="${t.startDate || ''}"></label>
      <label class="tb-date"><span>REGRESO</span>
        <input type="date" data-trip-end value="${t.endDate || ''}"></label>
    </div>
    <div class="tb-count ${cd.past ? 'past' : ''}">${cd.text}</div>
    <div class="tb-status">${pend ? `<span class="pill warn">${pend} pendientes</span>` : `<span class="pill ok">Todo listo</span>`}</div>
  </div>`;

  const tabs = `
  <div class="tabs">
    <button class="tab ${view.tab === 'lists' ? 'is-active' : ''}" data-tab="lists">Listas</button>
    <button class="tab ${view.tab === 'legs' ? 'is-active' : ''}" data-tab="legs">Trayectos</button>
  </div>`;

  let body = '';
  if (view.tab === 'lists') {
    body = `${renderListsBlock(t.lists, { context: 'trip' })}
      <button class="btn wide" data-add-list>+ Añadir lista</button>`;
  } else {
    body = renderLegs(t);
  }

  return `
  <header class="topbar">
    <button class="btn ghost" data-nav="home">‹ Viajes</button>
    <div class="topbar-actions">
      <button class="btn ghost small" data-save-as-tpl>Guardar como plantilla</button>
      <button class="icon-btn danger" data-del-trip="${t.id}" title="Borrar viaje">🗑</button>
    </div>
  </header>
  <main class="wrap">
    ${header}
    ${tabs}
    ${body}
  </main>
  ${bottomNav('home')}`;
}

/* ---------- Bloque de listas (compartido viaje/plantilla) ---------- */
function renderListsBlock(lists, { context }) {
  if (!lists.length) {
    return `<div class="empty small"><p class="muted">Sin listas todavía.</p></div>`;
  }
  return lists.map((l) => {
    const pend = context === 'trip' ? l.items.filter(nodePending).length : 0;
    return `<section class="list-card" data-list="${l.id}">
      <div class="list-head">
        <input class="list-title" data-list-name="${l.id}" value="${esc(l.name)}" placeholder="Nombre de la lista">
        ${context === 'trip' && pend ? `<span class="pill warn tiny">${pend}</span>` : ''}
        <button class="icon-btn danger" data-del-list="${l.id}" title="Borrar lista">✕</button>
      </div>
      <div class="items">
        ${l.items.map((it) => renderItem(l.id, it, context)).join('')}
      </div>
      <button class="btn ghost small add-item" data-add-item="${l.id}">+ Artículo</button>
    </section>`;
  }).join('');
}

function statusChip(node, kind, ids) {
  const attr = `data-status-${kind}="${ids}"`;
  const opts = STATUSES.map((s) =>
    `<option value="${s.id}" ${node.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('');
  return `<select class="status status-${node.status}" ${attr}>${opts}</select>`;
}

function qtyControl(node, kind, ids) {
  const missing = clampInt(node.qtyWanted) - clampInt(node.qtyDone);
  return `<div class="qty">
    <span class="qty-label">En maleta</span>
    <div class="stepper">
      <button class="step" data-qtydone-dec-${kind}="${ids}">−</button>
      <span class="qty-num">${clampInt(node.qtyDone)}</span>
      <button class="step" data-qtydone-inc-${kind}="${ids}">+</button>
    </div>
    <span class="qty-sep">/</span>
    <div class="stepper">
      <button class="step" data-qtywant-dec-${kind}="${ids}">−</button>
      <span class="qty-num want">${clampInt(node.qtyWanted)}</span>
      <button class="step" data-qtywant-inc-${kind}="${ids}">+</button>
    </div>
    <span class="qty-want-label">objetivo</span>
    ${missing > 0 ? `<span class="missing">faltan ${missing}</span>` : `<span class="missing done">completo</span>`}
  </div>`;
}

function renderItem(listId, it, context) {
  const ids = `${listId}:${it.id}`;
  return `<div class="item ${context === 'trip' && !nodePending(it) ? 'is-done' : ''}">
    <div class="item-main">
      <input class="item-name" data-item-name="${ids}" value="${esc(it.name)}" placeholder="Artículo">
      ${context === 'trip' ? qtyControl(it, 'item', ids) : ''}
      ${statusChip(it, 'item', ids)}
      <button class="icon-btn danger tiny" data-del-item="${ids}" title="Borrar">✕</button>
    </div>
  </div>`;
}

/* ---------- Trayectos ---------- */
function renderLegs(t) {
  const legs = [...(t.legs || [])].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const rows = legs.map((leg) => {
    const ty = legType(leg.type);
    const cd = countdown(leg.datetime);
    return `<div class="leg" data-leg="${leg.id}">
      <div class="leg-line">
        <span class="leg-ico">${ty.icon}</span>
        <select class="leg-type" data-leg-type="${leg.id}">
          ${LEG_TYPES.map((x) => `<option value="${x.id}" ${x.id === leg.type ? 'selected' : ''}>${x.label}</option>`).join('')}
        </select>
        <input class="leg-name" data-leg-name="${leg.id}" value="${esc(leg.name)}" placeholder="p. ej. Seúl → Busan">
        <button class="icon-btn danger tiny" data-del-leg="${leg.id}" title="Borrar">✕</button>
      </div>
      <div class="leg-line">
        <input type="datetime-local" class="leg-dt" data-leg-dt="${leg.id}" value="${leg.datetime || ''}">
        <span class="leg-count ${cd.past ? 'past' : ''}">${cd.text}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="legs">
    ${legs.length ? rows : `<div class="empty small"><p class="muted">Sin trayectos. Añade trenes, buses o vuelos internos.</p></div>`}
    <button class="btn wide" data-add-leg>+ Añadir trayecto</button>
  </div>`;
}

/* ============================================================
   EVENTOS (delegación)
   ============================================================ */
function bindDynamic() {
  // Navegación inferior
  $$('[data-nav]').forEach((b) => b.onclick = () => {
    const n = b.dataset.nav;
    if (n === 'notify') return openNotifySheet();
    go(n);
  });
}

// Delegación global para clicks
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-open-trip],[data-open-tpl],[data-new-trip],[data-new-tpl],[data-tab],[data-del-trip],[data-del-tpl],[data-del-list],[data-del-item],[data-del-leg],[data-add-list],[data-add-list-tpl],[data-add-item],[data-add-leg],[data-save-as-tpl],[data-qtydone-inc-item],[data-qtydone-dec-item],[data-qtywant-inc-item],[data-qtywant-dec-item]');
  if (!el) return;
  const d = el.dataset;

  if (d.openTrip) return go('trip', { tripId: d.openTrip, tab: 'lists' });
  if (d.openTpl) return go('template', { templateId: d.openTpl });
  if ('newTrip' in d) return createTripFlow();
  if ('newTpl' in d) return createTemplate();
  if ('tab' in d) { view.tab = d.tab; return render(); }

  if (d.delTrip) return confirmDelete('¿Borrar este viaje y todas sus listas?', () => {
    store.data.trips = store.data.trips.filter((x) => x.id !== d.delTrip);
    store.save(); scheduleReminderSync(); go('home');
  });
  if (d.delTpl) return confirmDelete('¿Borrar esta plantilla?', () => {
    store.data.templates = store.data.templates.filter((x) => x.id !== d.delTpl);
    store.save(); render();
  });

  const t = currentTrip() || currentTemplate();

  if (d.delList) { removeList(d.delList); return saveRender(); }
  if (d.delItem) { const [l, i] = d.delItem.split(':'); removeItem(l, i); return saveRender(); }
  if (d.delLeg) { const tr = currentTrip(); tr.legs = tr.legs.filter((x) => x.id !== d.delLeg); scheduleReminderSync(); return saveRender(); }

  if ('addList' in d || 'addListTpl' in d) { t.lists.push(newList()); return saveRender(); }
  if (d.addItem) { findList(d.addItem).items.push(newItem()); return saveRender(); }
  if ('addLeg' in d) {
    const tr = currentTrip(); tr.legs = tr.legs || [];
    tr.legs.push({ id: uid(), type: 'train', name: '', datetime: '', notified1d: false, notified1h: false });
    return saveRender();
  }
  if ('saveAsTpl' in d) return saveTripAsTemplate();

  // Steppers de cantidad
  const stepper = [
    ['qtydoneIncItem', 'qtyDone', +1], ['qtydoneDecItem', 'qtyDone', -1],
    ['qtywantIncItem', 'qtyWanted', +1], ['qtywantDecItem', 'qtyWanted', -1],
  ];
  for (const [key, field, delta] of stepper) {
    if (d[key]) { adjustQty(d[key], field, delta); return saveRender(); }
  }
});

// Delegación de inputs (texto/fecha/estado)
app.addEventListener('input', (e) => {
  const el = e.target, d = el.dataset;
  if ('tripName' in d) { currentTrip().name = el.value; store.save(); return updateBoards(); }
  if ('tripStart' in d) { currentTrip().startDate = el.value; resetTripFlags(); store.save(); return updateBoards(); }
  if ('tripEnd' in d) { currentTrip().endDate = el.value; store.save(); return; }
  if ('tplName' in d) { currentTemplate().name = el.value; store.save(); return; }

  if ('listName' in d) { findList(d.listName).name = el.value; store.save(); return; }
  if ('itemName' in d) { const [l, i] = d.itemName.split(':'); findItem(l, i).name = el.value; store.save(); return; }

  if ('legName' in d) { findLeg(d.legName).name = el.value; store.save(); return; }
  if ('legDt' in d) { const lg = findLeg(d.legDt); lg.datetime = el.value; lg.notified1d = lg.notified1h = false; store.save(); scheduleReminderSync(); return updateBoards(); }
});

// Selects (estado / tipo de trayecto)
app.addEventListener('change', (e) => {
  const el = e.target, d = el.dataset;
  if ('statusItem' in d) { const [l, i] = d.statusItem.split(':'); findItem(l, i).status = el.value; return saveRender(); }
  if ('legType' in d) { findLeg(d.legType).type = el.value; return saveRender(); }
});

/* ---------- Helpers de mutación ---------- */
function container() { return currentTrip() || currentTemplate(); }
function findList(id) { return container().lists.find((l) => l.id === id); }
function findItem(lid, iid) { return findList(lid).items.find((i) => i.id === iid); }
function findLeg(id) { return currentTrip().legs.find((l) => l.id === id); }
function removeList(id) { const c = container(); c.lists = c.lists.filter((l) => l.id !== id); }
function removeItem(lid, iid) { const l = findList(lid); l.items = l.items.filter((i) => i.id !== iid); }

function adjustQty(ids, field, delta) {
  const [lid, iid] = ids.split(':');
  const node = findItem(lid, iid);
  node[field] = clampInt(node[field] + delta);
  if (node.qtyDone > node.qtyWanted && field === 'qtyDone') node.qtyWanted = node.qtyDone;
  // Autocompletar estado: si ya está todo metido, marcar listo
  if (field === 'qtyDone' && node.qtyDone >= node.qtyWanted && node.qtyWanted > 0) node.status = 'ready';
}

function saveRender() { store.save(); render(); }

// Actualiza solo las cuentas atrás/estados sin re-renderizar todo (para no perder foco al escribir)
function updateBoards() {
  const t = currentTrip();
  if (!t) return;
  const cdEl = $('.tb-count');
  if (cdEl) {
    const cd = countdown(t.startDate);
    cdEl.textContent = cd.text; cdEl.classList.toggle('past', cd.past);
  }
}
function resetTripFlags() {
  const t = currentTrip();
  if (t) { t.notified2d = false; t.notified1d = false; }
  scheduleReminderSync();
}

/* ============================================================
   FLUJOS: crear viaje (desde cero / plantilla), plantillas
   ============================================================ */
function createTripFlow() {
  const tpls = store.data.templates;
  const options = ['Empezar desde cero', ...tpls.map((t) => `Plantilla: ${t.name}`), 'Cancelar'];
  openSheet('Nuevo viaje', 'Elige cómo empezar', options.map((label, i) => ({
    label,
    kind: i === 0 ? 'primary' : (i === options.length - 1 ? 'ghost' : 'default'),
    action: () => {
      closeSheet();
      if (label === 'Cancelar') return;
      const trip = {
        id: uid(), name: '', startDate: '', endDate: '',
        lists: label === 'Empezar desde cero' ? [] : cloneLists(tpls[i - 1].lists, true),
        legs: [], notified2d: false, notified1d: false,
      };
      store.data.trips.push(trip); store.save(); scheduleReminderSync();
      go('trip', { tripId: trip.id, tab: 'lists' });
    },
  })));
}

function createTemplate() {
  const t = { id: uid(), name: 'Nueva plantilla', lists: [newList('Lista 1')] };
  store.data.templates.push(t); store.save();
  go('template', { templateId: t.id });
}

function saveTripAsTemplate() {
  const t = currentTrip();
  const tpl = { id: uid(), name: (t.name || 'Viaje') + ' (plantilla)', lists: cloneLists(t.lists, true) };
  store.data.templates.push(tpl); store.save();
  toast('Guardado como plantilla');
}

function saveTripAsTemplateFromLists() {} // reservado

/* ============================================================
   HOJA MODAL (sheet) + confirmaciones + toast
   ============================================================ */
function openSheet(title, subtitle, actions) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-backdrop';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
    <h2 class="sheet-title">${esc(title)}</h2>
    ${subtitle ? `<p class="sheet-sub muted">${esc(subtitle)}</p>` : ''}
    <div class="sheet-actions"></div>
  </div>`;
  const wrap = $('.sheet-actions', el);
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = `btn wide ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'ghost' ? 'ghost' : ''}`;
    b.textContent = a.label;
    b.onclick = a.action;
    wrap.appendChild(b);
  });
  el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
  document.body.appendChild(el);
}
function closeSheet() { $$('.sheet-backdrop').forEach((e) => e.remove()); }
function confirmDelete(msg, onYes) {
  openSheet('Confirmar', msg, [
    { label: 'Sí, borrar', kind: 'primary', action: () => { closeSheet(); onYes(); } },
    { label: 'Cancelar', kind: 'ghost', action: closeSheet },
  ]);
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

/* ============================================================
   NOTIFICACIONES LOCALES (solo en la app nativa de Android)
   ============================================================ */

// Genera el calendario completo de avisos futuros a partir de los datos actuales.
function buildReminders() {
  const now = Date.now();
  const items = [];
  for (const t of store.data.trips) {
    if (t.startDate) {
      const start = new Date(t.startDate + 'T00:00:00').getTime();
      if (start > now) {
        const pend = tripPendingCount(t);
        const name = t.name || 'tu viaje';
        items.push({
          id: `${t.id}_2d`,
          title: `Faltan 2 días: ${name}`,
          body: pend > 0 ? `Tienes ${pend} artículos pendientes.` : 'Revisa tu equipaje.',
          sendAt: start - 2 * DAY,
        });
        items.push({
          id: `${t.id}_1d`,
          title: `Mañana sales: ${name}`,
          body: pend > 0 ? `Todavía quedan ${pend} artículos pendientes.` : '¡Todo listo!',
          sendAt: start - DAY,
        });
      }
    }
    for (const leg of (t.legs || [])) {
      if (!leg.datetime) continue;
      const dt = new Date(leg.datetime).getTime();
      if (dt > now) {
        const ty = legType(leg.type).label;
        const legName = leg.name || t.name || 'trayecto';
        items.push({
          id: `${leg.id}_1d`,
          title: `${ty} mañana: ${legName}`,
          body: `Salida: ${fmtDateTime(leg.datetime)}`,
          sendAt: dt - DAY,
        });
        items.push({
          id: `${leg.id}_1h`,
          title: `${ty} en 1 hora: ${legName}`,
          body: `Salida: ${fmtDateTime(leg.datetime)}`,
          sendAt: dt - HOUR,
        });
      }
    }
  }
  return items.filter((item) => item.sendAt > now);
}

/* ---------- ¿Estamos dentro de la app nativa (Capacitor)? ---------- */
function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
function localNotifications() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}
function notifEnabled() { return localStorage.getItem('viajes_notif') === 'on'; }

// Android exige id numérico: convierte el id de texto del aviso en un entero estable.
function notifNumericId(strId) {
  let h = 0;
  for (let i = 0; i < strId.length; i++) { h = (Math.imul(h, 31) + strId.charCodeAt(i)) | 0; }
  return Math.abs(h) || 1;
}

// Reprograma en el sistema todos los avisos futuros (cancela los anteriores primero).
async function syncReminders() {
  const LN = localNotifications();
  if (!isNative() || !LN || !notifEnabled()) return;
  try {
    const pending = await LN.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const items = buildReminders();
    if (!items.length) return;
    await LN.schedule({
      notifications: items.map((it) => ({
        id: notifNumericId(it.id),
        title: it.title,
        body: it.body,
        schedule: { at: new Date(it.sendAt), allowWhileIdle: true },
      })),
    });
  } catch (e) { console.error('syncReminders:', e); }
}

// Debounce: reprograma tras cambiar fechas (evita hacerlo en cada tecla).
let _reminderTimer = null;
function scheduleReminderSync() {
  if (!isNative()) return;
  clearTimeout(_reminderTimer);
  _reminderTimer = setTimeout(syncReminders, 1500);
}

// Pide permiso (Android 13+) y activa los avisos.
async function enableNotifications() {
  const LN = localNotifications();
  if (!LN) return false;
  try {
    const res = await LN.requestPermissions();
    if (res.display !== 'granted') return false;
    localStorage.setItem('viajes_notif', 'on');
    await syncReminders();
    return true;
  } catch (e) { console.error('enableNotifications:', e); return false; }
}

async function disableNotifications() {
  localStorage.setItem('viajes_notif', 'off');
  const LN = localNotifications();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch (e) { /* silencioso */ }
}

/* ============================================================
   AVISOS (hoja de ajustes)
   ============================================================ */
// Hoja de ajustes de avisos
async function openNotifySheet() {
  // En la PWA (iOS/escritorio) no hay notificaciones: solo en la app de Android.
  if (!isNative()) {
    openSheet('Avisos', 'Las notificaciones solo están disponibles en la app de Android (Mis Viajes).', [
      { label: 'Entendido', kind: 'primary', action: closeSheet },
    ]);
    return;
  }

  const on = notifEnabled();
  const actions = [];

  if (!on) {
    actions.push({
      label: 'Activar avisos', kind: 'primary', action: async () => {
        const ok = await enableNotifications();
        closeSheet();
        toast(ok ? 'Avisos activados' : 'No se han podido activar (permiso denegado)');
      },
    });
  } else {
    actions.push({
      label: 'Aviso de prueba', kind: 'primary', action: async () => {
        closeSheet();
        const LN = localNotifications();
        try {
          await LN.schedule({ notifications: [{
            id: 999999,
            title: 'Aviso de prueba',
            body: 'Las notificaciones funcionan en este dispositivo.',
            schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          }] });
          toast('Te llegará en ~5 segundos');
        } catch (e) { toast('No se pudo programar el aviso'); }
      },
    });
    actions.push({
      label: 'Desactivar avisos', kind: 'default', action: async () => {
        await disableNotifications();
        closeSheet();
        toast('Avisos desactivados');
      },
    });
  }

  actions.push({ label: 'Cerrar', kind: 'ghost', action: closeSheet });

  openSheet('Avisos', on ? 'Avisos activados' : 'Sin activar', actions);
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function boot() {
  store.load();
  go('home');
  // Service worker (solo para caché offline de la PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Avisos: solo en la app nativa de Android. Reprograma al abrir y al volver a ella.
  if (isNative()) {
    syncReminders();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncReminders(); });
  }
  // Cerrar hojas con Escape
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}
boot();
