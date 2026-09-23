(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === 'class') e.className = v; else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(n, v);
  }
  for (const c of k.flat()) e.append(c instanceof Node ? c : String(c == null ? '' : c));
  return e;
};
const store = {
  get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
async function api(p, o = {}) {
  const tok = store.get('nn-token', ''), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeout || 120000);
  try {
    const r = await fetch('/api' + p, { method: o.method || 'GET', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { status: r.status });
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out');
    if (e instanceof TypeError) throw new Error('Server unreachable (offline?)');
    throw e;
  } finally { clearTimeout(t); }
}

const S = { view: 'chat', task: null, tasks: [], providers: [], files: [], selected: new Set(), review: null, open: new Set(), online: true, busy: false, note: '' };
const chatLog = store.get('nn-chat', []);
const persist = () => store.set('nn-chat', chatLog.slice(-100));
const panel = $('#panel'), orb = $('#orb');

const setTheme = (t) => { document.documentElement.dataset.theme = t; store.set('nn-theme', t); $('meta[name=theme-color]').content = t === 'dark' ? '#02030a' : '#f4f7ff'; };
setTheme(store.get('nn-theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
const TABS = [['chat', 'Chat'], ['tasks', 'Agents'], ['files', 'Files'], ['settings', 'Settings']];
const body = h('main'), foot = h('footer', {}, 'CHECKING…'), dot = h('span', { class: 'dot' }), banner = h('div', { class: 'banner', hidden: '' }, 'Offline — reconnect to continue');
const nav = h('nav');
panel.append(h('header', {}, h('div', { class: 'brand' }, dot, 'NONONICK AI'), h('button', { class: 'icon', 'aria-label': 'Toggle theme', onclick: () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); } }, '◐'), h('button', { class: 'icon', 'aria-label': 'Close', onclick: () => toggle(false) }, '×')), nav, banner, body, foot);
function toggle(open) { panel.classList.toggle('open', open); panel.setAttribute('aria-hidden', String(!open)); if (open) { refresh(); render(); } }
function render() {
  nav.replaceChildren(...TABS.map(([k, l]) => h('button', { class: S.view === k ? 'on' : '', onclick: () => { S.view = k; S.review = null; render(); refresh(); } }, l)));
  const top = body.scrollTop; body.replaceChildren(S.review ? approval() : ({ chat: chatView, tasks: tasksView, files: filesView, settings: settingsView })[S.view]());
  if (S.view === 'chat') body.scrollTop = body.scrollHeight; else body.scrollTop = top; orb.classList.toggle('busy', S.tasks.some((t) => ['planning', 'running'].includes(t.status)));
}
const pill = (s) => h('span', { class: 'pill ' + s }, s.replace('_', ' '));
function push(role, text, extra = {}) { const m = { role, text, ...extra }; chatLog.push(m); return m; }
function chatView() {
  const ta = h('textarea', { class: 'inp', rows: '3', placeholder: 'Ask anything, or describe a project to build…' }); const ag = h('input', { type: 'checkbox' });
  const send = h('button', { class: 'btn', disabled: S.busy ? '' : false, onclick: async () => {
    const text = ta.value.trim(); if (!text || S.busy) return; ta.value = ''; S.busy = true;
    if (ag.checked) { try { const r = await api('/tasks', { method: 'POST', body: { goal: text, files: [...S.selected] } }); S.task = r.id; S.view = 'tasks'; } catch (e) { push('assistant', e.message, { err: 1 }); } S.busy = false; persist(); render(); refresh(); return; }
    push('user', text); const pend = push('assistant', '…'); render();
    try { const r = await api('/chat', { method: 'POST', body: { messages: chatLog.filter((m) => !m.err && m !== pend).slice(-20).map((m) => ({ role: m.role, content: m.text })) } }); pend.text = r.text; pend.meta = r.provider + ' · ' + r.model + (r.attempts.length ? ` · ${r.attempts.length} failover` : ''); } catch (e) { pend.text = e.message; pend.err = 1; }
    S.busy = false; persist(); render();
  } }, S.busy ? 'WORKING…' : 'SEND');
  return h('div', {}, chatLog.length ? h('div', { class: 'msgs' }, chatLog.map((m) => h('div', { class: 'msg ' + m.role + (m.err ? ' err' : '') }, m.text, m.meta ? h('small', {}, m.meta) : ''))) : h('div', { class: 'empty' }, 'Ask a question, or tick “Run as agent task” to have agents build something.'), ta, h('label', { class: 'row' }, ag, `Run as agent task${S.selected.size ? ` (${S.selected.size} file(s) attached)` : ''}`), send, chatLog.length ? h('button', { class: 'ghost', onclick: () => { chatLog.length = 0; persist(); render(); } }, 'Clear history') : '');
}
async function refresh() {
  try { if (S.view === 'tasks' || S.tasks.length === 0) S.tasks = (await api('/tasks')).tasks; if (S.view === 'tasks' && S.task) S.detail = await api('/tasks/' + S.task); if (S.view === 'files') S.files = (await api('/files')).files; if (S.view === 'settings') S.providers = (await api('/providers')).providers; S.note = ''; } catch (e) { S.note = e.message; }
  if (panel.classList.contains('open') && !S.review) { const a = document.activeElement; if (!(a && a.tagName === 'TEXTAREA')) render(); }
}
function tasksView() { if (S.task && S.detail && S.detail.id === S.task) return detail(S.detail); return h('div', {}, S.note ? h('div', { class: 'note err' }, S.note) : '', S.tasks.length ? S.tasks.map((t) => h('div', { class: 'card', onclick: () => { S.task = t.id; S.detail = null; refresh(); } }, pill(t.status), ' ', t.goal.slice(0, 90), h('div', { class: 'msg small' }, `${t.agents} agent(s)`))) : h('div', { class: 'empty' }, 'No agent tasks yet. Use Chat with “Run as agent task”.')); }
function detail(t) { const live = ['planning', 'running'].includes(t.status); const box = h('div', {}, h('button', { class: 'ghost', onclick: () => { S.task = null; S.detail = null; render(); } }, '← All tasks'), h('h3', {}, t.goal), pill(t.status), live ? h('span', { class: 'spin' }) : '', t.error ? h('div', { class: 'note err' }, t.error) : ''); box.append(h('h4', {}, 'AGENTS')); if (!t.agents.length) box.append(h('div', { class: 'empty' }, 'Planning…')); t.agents.forEach((a) => { const k = t.id + a.id; box.append(h('details', { ...(S.open.has(k) ? { open: '' } : {}), ontoggle: (e) => (e.target.open ? S.open.add(k) : S.open.delete(k)) }, h('summary', {}, pill(a.status), ' ', a.role, a.provider ? ` · ${a.provider}/${a.model}` : '', a.depth ? ' · spawned' : ''), h('pre', {}, a.output || a.error || a.task))); }); if (t.result) box.append(h('h4', {}, 'RESULT'), h('pre', {}, t.result)); if (t.files.length) { box.append(h('h4', {}, 'FILES'), t.files.map((f) => h('div', { class: 'card static' }, f))); if (t.files.includes('index.html')) box.append(h('h4', {}, 'PREVIEW'), h('iframe', { sandbox: 'allow-scripts', src: `/preview/${t.id}/index.html`, title: 'Preview' })); } if (t.validation) box.append(h('h4', {}, 'TESTS'), h('div', { class: 'note' + (t.validation.errors.length ? ' err' : '') }, t.validation.errors.length ? t.validation.errors.join('\n') : `Validation passed (${t.validation.checked} file(s))`)); box.append(h('h4', {}, 'TOOL ACTIVITY'), h('pre', {}, t.log.slice(-25).map((l) => new Date(l.at).toLocaleTimeString() + '  ' + l.msg).join('\n'))); if (t.status === 'awaiting_approval') box.append(h('button', { class: 'btn danger', onclick: async () => { try { S.review = await api(`/tasks/${t.id}/deploy`); S.result = ''; render(); } catch (e) { S.note = e.message; render(); } } }, 'REVIEW & DEPLOY')); return box; }
function approval() { const m = S.review, bad = m.validation.errors.length; const btn = h('button', { class: 'btn danger', disabled: bad || !m.files.length || S.busy ? '' : false, onclick: async () => { S.busy = true; render(); try { const r = await api(`/tasks/${m.taskId}/deploy`, { method: 'POST', body: { confirm: true, manifestHash: m.hash } }); S.result = `Deployed ${r.deployed} file(s).`; S.review = null; S.task = null; S.detail = null; } catch (e) { S.result = e.message; } S.busy = false; if (S.review) S.review.error = S.result; refresh(); render(); } }, 'DEPLOY'); return h('div', { class: 'approve' }, h('h2', {}, 'Deploy this version?'), h('div', { class: 'msg small' }, m.goal), h('h4', {}, `${m.files.length} FILE(S) WILL BE DEPLOYED`), m.files.map((f) => h('div', { class: 'card static' }, `${f.path}  ·  ${f.bytes} B  ·  ${f.sha256.slice(0, 10)}`)), bad ? h('div', { class: 'note err' }, 'Blocked by validation:\n' + m.validation.errors.join('\n')) : h('div', { class: 'note' }, 'All validation checks passed.'), m.targetConfigured ? '' : h('div', { class: 'note err' }, 'No deployment target configured (DEPLOY_DIR). Deploy will be refused.'), S.review.error ? h('div', { class: 'note err' }, S.review.error) : '', btn, h('button', { class: 'btn', onclick: () => { S.review = null; render(); } }, 'CANCEL')); }
function filesView() { const inp = h('input', { type: 'file', multiple: '', onchange: async () => { for (const f of inp.files) { try { if (f.size > 12e6) throw new Error(f.name + ' is larger than 12 MB'); const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Read failed')); r.readAsDataURL(f); }); await api('/files', { method: 'POST', body: { name: f.name, content: b64 } }); } catch (e) { S.note = e.message; } } refresh(); } }); return h('div', {}, h('div', { class: 'row' }, inp), S.note ? h('div', { class: 'note err' }, S.note) : '', h('h4', {}, 'PROJECT FILES — TICK TO ATTACH TO NEXT AGENT TASK'), S.files.length ? S.files.map((f) => h('label', { class: 'card static row' }, h('input', { type: 'checkbox', ...(S.selected.has(f.name) ? { checked: '' } : {}), onchange: (e) => (e.target.checked ? S.selected.add(f.name) : S.selected.delete(f.name)) }), `${f.name} (${f.bytes} B)`)) : h('div', { class: 'empty' }, 'No files uploaded yet.')); }
function settingsView() { const tok = h('input', { class: 'inp', type: 'password', placeholder: 'Access token (APP_TOKEN)', value: store.get('nn-token', ''), autocomplete: 'off' }); return h('div', {}, h('h4', {}, 'ACCESS'), tok, h('button', { class: 'btn', onclick: () => { store.set('nn-token', tok.value.trim()); refresh(); render(); } }, 'SAVE TOKEN'), h('h4', {}, 'THEME'), h('div', { class: 'row' }, ['dark', 'light'].map((t) => h('button', { class: 'btn', onclick: () => setTheme(t) }, t.toUpperCase()))), h('h4', {}, 'AI PROVIDERS (READ-ONLY, SET IN .ENV ON THE SERVER)'), S.note ? h('div', { class: 'note err' }, S.note) : '', S.providers.map((p) => h('div', { class: 'card static' }, h('b', {}, p.name), ' ', h('span', { class: 'pill ' + (p.configured ? 'done' : 'failed') }, p.configured ? 'ready' : 'not configured'), h('div', {}, p.models.join(', ') || 'no models set')))); }
async function health() { try { const r = await fetch('/api/health', { cache: 'no-store' }); if (!r.ok) throw 0; S.online = true; dot.className = 'dot'; foot.textContent = 'SERVER ONLINE • AGENTS RUN SERVER-SIDE'; } catch { S.online = false; dot.className = 'dot off'; foot.textContent = 'SERVER OFFLINE'; } banner.hidden = S.online && navigator.onLine; }
addEventListener('online', health); addEventListener('offline', health); health(); setInterval(health, 15000); setInterval(() => { if (panel.classList.contains('open') && (S.view === 'tasks' || S.tasks.some((t) => ['planning', 'running'].includes(t.status)))) refresh(); }, 2000);
const POS = 'nn-orb-pos'; let pid = null, drag = false, sx = 0, sy = 0, ox = 0, oy = 0; const place = (x, y) => { x = Math.max(8, Math.min(x, innerWidth - orb.offsetWidth - 8)); y = Math.max(8, Math.min(y, innerHeight - orb.offsetHeight - 8)); orb.style.left = x + 'px'; orb.style.top = y + 'px'; return { x, y }; }; const saved = store.get(POS, null); saved ? place(saved.x, saved.y) : place(innerWidth - 92, innerHeight - 170);
orb.addEventListener('pointerdown', (e) => { pid = e.pointerId; drag = false; sx = e.clientX; sy = e.clientY; const r = orb.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; try { orb.setPointerCapture(pid); } catch { /* ignore */ } }); orb.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; drag = true; orb.classList.add('dragging'); place(e.clientX - ox, e.clientY - oy); }); orb.addEventListener('pointerup', (e) => { if (e.pointerId !== pid) return; pid = null; orb.classList.remove('dragging'); if (drag) { const r = orb.getBoundingClientRect(); const p = place(r.left + r.width / 2 < innerWidth / 2 ? 8 : innerWidth - r.width - 8, r.top); store.set(POS, p); } else toggle(!panel.classList.contains('open')); }); orb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(true); } }); addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); }); addEventListener('resize', () => { const r = orb.getBoundingClientRect(); place(r.left, r.top); }); render();
})();
