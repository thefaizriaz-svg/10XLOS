import { STORE, migrate, getStatus, isSecured, getUserEmail, secureAccount, signInToRestore, signOutAccount } from './data.js';

const root = document.getElementById('appRoot');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function truncate(s, n = 44) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function getPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const parts = String(path).split('.');
  const last = parts.pop();
  const target = parts.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function logChange(state, text) {
  if (!state.meta) state.meta = { recentChanges: [] };
  if (!state.meta.recentChanges) state.meta.recentChanges = [];
  state.meta.recentChanges.unshift({ text, ts: Date.now() });
  state.meta.recentChanges = state.meta.recentChanges.slice(0, 6);
}
function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}
function buildReflectionText(state) {
  const i = state.identity, b = state.blueprint, s = state.system;
  const lines = [];
  const h = (t) => lines.push(`\n## ${t}\n`);
  const p = (t) => lines.push(t || '');
  const list = (arr) => (arr || []).forEach(v => lines.push(`- ${v}`));

  lines.push(`# LOS — Reflection`);
  lines.push(`Exported ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`);

  h('Identity'); p(i.statement);
  h('Mission'); p(i.mission);
  h('Vision'); p(i.vision);
  h('Core Values'); list(i.values);
  h('Principles'); list(i.principles);
  h('Decision Rules'); list(i.decisionRules);
  h('Non-Negotiables'); list(i.nonNegotiables);
  h('Success'); p(i.success);
  h('Failure'); p(i.failure);
  h('Life Philosophy'); p(i.philosophy);

  h('Current Season'); p(b.season);
  h('Priorities'); list(b.priorities);
  h('Things To Ignore'); list(b.ignore);

  h('Goals');
  GOAL_CATEGORIES.forEach(cat => {
    const goalsInCat = state.goals.filter(g => (g.category || 'growth') === cat.key);
    if (!goalsInCat.length) return;
    lines.push(`\n### ${cat.label}`);
    goalsInCat.forEach(g => {
      const dl = g.deadline ? deadlineInfo(g.deadline, g.progress) : null;
      lines.push(`- ${g.title} (${g.progress}%)${dl ? ` — ${dl.dateLabel}, ${dl.text}` : ''}\n  ${g.why}`);
    });
  });

  h('Brain');
  const cats = Array.from(new Set(state.brain.map(n => n.category)));
  cats.forEach(c => {
    lines.push(`\n### ${c}`);
    state.brain.filter(n => n.category === c).forEach(n => lines.push(`- ${n.title}: ${n.content}`));
  });

  h('System — Daily'); list(s.dailyUse);
  h('System — Weekly'); list(s.weekly);
  h('System — Monthly'); list(s.monthly);
  h('Operating Rule'); p(s.rule);

  return lines.join('\n');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function isOverdue(iso, progress) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return false;
  return d.getTime() < new Date().setHours(0, 0, 0, 0) && progress < 100;
}

const GOAL_CATEGORIES = [
  { key: 'growth', label: 'Personal Development & Skill', color: 'var(--primary)' },
  { key: 'material', label: 'Things & Material', color: 'var(--accent)' },
  { key: 'career', label: 'Career & Economic', color: '#7C9CFF' }
];

function deadlineInfo(iso, progress) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  const done = progress >= 100;
  const overdue = diffDays < 0 && !done;
  let text;
  if (done) text = 'Completed';
  else if (overdue) text = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  else if (diffDays === 0) text = 'Due today';
  else text = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
  return { text, overdue, done, dateLabel: formatDate(iso) };
}

/* ---------------- Progress dial SVG ---------------- */
function dialSVG(pct, size = 72) {
  const r = (size / 2) - 6;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="5"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1FCB9C" stroke-width="5"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${c} ${c})"/>
    <text x="${c}" y="${c + 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace"
      font-size="14" fill="#F2F4F7">${pct}</text>
  </svg>`;
}

/* ---------------- Icons ---------------- */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"/></svg>',
  goals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/></svg>',
  blueprint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l3 6 6 .9-4.5 4.2 1 6-5.5-3-5.5 3 1-6L3 9.9 9 9z"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4a3 3 0 00-3 3v1a3 3 0 000 6v1a3 3 0 003 3M15 4a3 3 0 013 3v1a3 3 0 010 6v1a3 3 0 01-3 3M9 4v16M15 4v16"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 000-3l1-1.7-1.7-1.7-1.7 1a1.7 1.7 0 00-3 0l-1-1.7L11.3 8l1 1.7a1.7 1.7 0 00-3 0l-1.7-1L5.9 8.4l1 1.7a1.7 1.7 0 000 3l-1 1.7 1.7 1.7 1.7-1a1.7 1.7 0 003 0l1 1.7 1.7-1.7-1-1.7a1.7 1.7 0 003 0z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v13a2 2 0 01-2 2H9a2 2 0 01-2-2V7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 13l4 4L19 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
};

/* ---------------- Small render helpers ---------------- */
function editBtn(path, label, cls) {
  return `<button class="${cls || 'icon-btn corner'}" data-edit-field="${path}" data-field-label="${escapeHtml(label)}" aria-label="Edit ${escapeHtml(label)}">${ICONS.edit}</button>`;
}

function renderEditableList(path, items, label) {
  return `
    <ul class="list-clean editable">
      ${items.map((v, idx) => `
        <li>
          <span class="li-text" data-edit-field="${path}.${idx}" data-field-label="${escapeHtml(label)} #${idx + 1}">${escapeHtml(v)}</span>
          <button class="li-delete" data-list-path="${path}" data-list-index="${idx}" aria-label="Remove item">${ICONS.trash}</button>
        </li>
      `).join('')}
    </ul>
    <button class="add-list-item" data-list-path="${path}" data-list-label="${escapeHtml(label)}">${ICONS.plus} Add ${escapeHtml(label)}</button>
  `;
}

/* ---------------- Renderers ---------------- */
function renderHome(state) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const activeAction = state.actions.find(a => a.status === 'Active');
  const avg = state.goals.length ? Math.round(state.goals.reduce((s, g) => s + g.progress, 0) / state.goals.length) : 0;
  const changes = (state.meta && state.meta.recentChanges) || [];

  return `
    <div class="greeting">${greet}.</div>
    <div class="date-line">${dateStr} · <span class="mono">${avg}% aligned</span></div>

    <div class="card mission-card" id="missionCard">
      <span class="card-label light">Today's Mission</span>
      <p>${escapeHtml(state.home.mission)}</p>
      <button class="icon-btn on-dark" id="editMissionBtn" aria-label="Edit mission">${ICONS.edit}</button>
    </div>

    <div class="card editable">
      ${editBtn('home.visionReminder', 'Vision Reminder')}
      <span class="card-label">Vision</span>
      <div class="vision-line" style="padding-right:30px">${escapeHtml(state.home.visionReminder)}</div>
    </div>

    <div class="card">
      <div class="field-line">
        <div>
          <span class="card-label">Today's Reflection</span>
          <div class="vision-line">${escapeHtml(state.home.reflection)}</div>
        </div>
        <button class="icon-btn sm" data-edit-field="home.reflection" data-field-label="Today's Reflection" aria-label="Edit reflection">${ICONS.edit}</button>
      </div>
      <div class="field-line" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
        <div>
          <span class="card-label">Quick Reminder</span>
          <div class="vision-line">${escapeHtml(state.home.quickReminder)}</div>
        </div>
        <button class="icon-btn sm" data-edit-field="home.quickReminder" data-field-label="Quick Reminder" aria-label="Edit reminder">${ICONS.edit}</button>
      </div>
    </div>

    <button class="snapshot-link" id="snapshotBtn">
      <div class="snapshot-header">
        <span class="section-title" style="margin:0">Progress Snapshot</span>
        <span class="snapshot-arrow">${ICONS.chevron}</span>
      </div>
      <div class="dial-row">
        ${state.goals.map(g => `
          <div class="dial">
            ${dialSVG(g.progress)}
            <div class="dial-title">${escapeHtml(g.title)}</div>
          </div>
        `).join('')}
      </div>
    </button>

    <div class="section-title">Focus Right Now</div>
    <div class="card editable">
      ${activeAction ? `
        <button class="icon-btn corner" data-edit-action="${activeAction.id}" aria-label="Edit focus action">${ICONS.edit}</button>
        <div class="goal-title" style="font-size:16px;padding-right:30px">${escapeHtml(activeAction.title)}</div>
        <div class="goal-why">${escapeHtml(activeAction.why)}</div>
      ` : `<div class="empty-state" style="padding:6px 0">No active action right now.</div>`}
      <button class="add-list-item" id="changeFocusBtn" style="margin-top:14px">${ICONS.plus} ${activeAction ? 'Change focus' : 'Set a focus action'}</button>
    </div>

    <div class="section-title">Recent Changes</div>
    <div class="card">
      ${changes.length ? changes.map(c => `
        <div class="change-row"><span>${escapeHtml(c.text)}</span><span class="mono change-time">${timeAgo(c.ts)}</span></div>
      `).join('') : `<div class="empty-state" style="padding:6px 0">No changes yet — edits you make will show up here.</div>`}
    </div>
  `;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function dateKey(date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return dateKey(new Date());
}

function isApplicableDay(action, date) {
  const days = (action.days && action.days.length) ? action.days : WEEKDAYS;
  return days.includes(WEEKDAYS[date.getDay()]);
}

function recurringStats(action) {
  const start = new Date((action.startDate || todayKey()) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const log = action.log || {};
  const maxDays = action.durationDays || Infinity;
  const cursor = new Date(start);
  let calendarDay = 0, elapsed = 0, done = 0;
  const recent = [];

  while (cursor < today && calendarDay < maxDays) {
    if (isApplicableDay(action, cursor)) {
      const key = dateKey(cursor);
      const wasDone = !!log[key];
      elapsed++;
      if (wasDone) done++;
      recent.push({ date: key, done: wasDone });
    }
    calendarDay++;
    cursor.setDate(cursor.getDate() + 1);
  }

  const todayApplicable = calendarDay < maxDays && isApplicableDay(action, today);
  const todayDone = !!log[todayKey()];
  const rate = elapsed > 0 ? Math.round((done / elapsed) * 100) : (todayDone ? 100 : 0);

  return {
    elapsed, done, missed: elapsed - done, rate,
    todayApplicable, todayDone,
    recent: recent.slice(-14),
    dayNumber: calendarDay + 1,
    maxDays: action.durationDays || null
  };
}

function actionContribution(action) {
  if (action.kind === 'recurring') return recurringStats(action).rate;
  return action.status === 'Completed' ? 100 : 0;
}

function computeAutoProgress(goalId, actions) {
  const linked = actions.filter(a => a.goalId === goalId);
  if (!linked.length) return null;
  const totalPct = linked.reduce((sum, a) => sum + actionContribution(a), 0);
  const pct = Math.round(totalPct / linked.length);
  const completedCount = linked.filter(a => a.kind !== 'recurring' && a.status === 'Completed').length;
  return { pct, done: completedCount, total: linked.length };
}

function syncGoalProgress(state) {
  state.goals.forEach(g => {
    const auto = computeAutoProgress(g.id, state.actions);
    if (auto) g.progress = auto.pct;
    if (g.progress >= 100 && !g.completedAt) g.completedAt = Date.now();
    if (g.progress < 100 && g.completedAt) g.completedAt = null;
  });
}

function renderGoalCard(g, state) {
  const linked = state.actions.filter(a => a.goalId === g.id);
  const auto = computeAutoProgress(g.id, state.actions);
  const progress = auto ? auto.pct : g.progress;
  const isDone = progress >= 100;
  const dl = g.deadline ? deadlineInfo(g.deadline, progress) : null;
  const doneDate = g.completedAt ? new Date(g.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return `
    <div class="card goal-card ${isDone ? 'completed-card' : ''}" data-goal="${g.id}">
      <div class="goal-top">
        <div>
          <div class="goal-title ${isDone ? 'strike' : ''}">${escapeHtml(g.title)}</div>
          <div class="goal-why">${escapeHtml(g.why)}</div>
          ${isDone ? `<div class="deadline-line done">Completed ${doneDate}</div>` : (dl ? `<div class="deadline-line ${dl.overdue ? 'overdue' : ''}">${dl.dateLabel} · ${dl.text}</div>` : '')}
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-edit-goal="${g.id}" aria-label="Edit goal">${ICONS.edit}</button>
          <button class="icon-btn danger" data-delete-goal="${g.id}" aria-label="Delete goal">${ICONS.trash}</button>
        </div>
      </div>
      ${auto ? `
        <div class="progress-controls readonly">
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span class="progress-pct mono">${progress}%</span>
        </div>
        <div class="progress-hint">${progress}% average across ${auto.total} action${auto.total === 1 ? '' : 's'} \u2014 measured automatically.</div>
      ` : `
        <div class="progress-controls">
          <button class="stepper-btn" data-action="dec" data-goal="${g.id}" aria-label="Decrease progress">–</button>
          <div class="progress-track"><div class="progress-fill" style="width:${g.progress}%"></div></div>
          <button class="stepper-btn" data-action="inc" data-goal="${g.id}" aria-label="Increase progress">+</button>
          <span class="progress-pct mono">${g.progress}%</span>
        </div>
        ${!isDone ? `<div class="progress-hint">Add actions below to measure this automatically</div>` : ''}
      `}
      ${isDone ? `<button class="add-list-item" data-reopen-goal="${g.id}" style="margin-top:12px">${ICONS.plus} Reopen this goal</button>` : ''}
      <div class="linked-actions">
        ${linked.length ? linked.map(a => a.kind === 'recurring' ? renderRecurringActionRow(a) : renderOnceActionRow(a)).join('') : `<div class="empty-state small">No actions linked yet.</div>`}
      </div>
      <button class="add-action-link" data-add-action-to="${g.id}">+ Add action to this goal</button>
    </div>
  `;
}

function renderOnceActionRow(a) {
  return `
    <div class="linked-action">
      <div class="linked-action-left">
        <button class="check-circle ${a.status === 'Completed' ? 'done' : ''}" data-toggle-action="${a.id}" aria-label="Toggle complete">${a.status === 'Completed' ? ICONS.check : ''}</button>
        <span class="${a.status === 'Completed' ? 'strike' : ''}">${escapeHtml(a.title)}</span>
      </div>
      <div class="linked-action-right">
        <span class="status-pill ${a.status.toLowerCase().replace(' ', '-')}">${a.status}</span>
        <button class="icon-btn sm" data-edit-action="${a.id}" aria-label="Edit action">${ICONS.edit}</button>
        <button class="icon-btn sm danger" data-delete-action="${a.id}" aria-label="Delete action">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

function renderRecurringActionRow(a) {
  const stats = recurringStats(a);
  return `
    <div class="linked-action recurring">
      <div class="linked-action-left">
        <button class="check-circle recurring-toggle ${stats.todayDone ? 'done' : ''} ${!stats.todayApplicable ? 'off' : ''}" data-toggle-recurring="${a.id}" aria-label="Toggle today" ${!stats.todayApplicable ? 'disabled' : ''}>${stats.todayDone ? ICONS.check : ''}</button>
        <span>${escapeHtml(a.title)}</span>
      </div>
      <div class="linked-action-right">
        <span class="status-pill recurring-pill">${stats.rate}%</span>
        <button class="icon-btn sm" data-edit-action="${a.id}" aria-label="Edit action">${ICONS.edit}</button>
        <button class="icon-btn sm danger" data-delete-action="${a.id}" aria-label="Delete action">${ICONS.trash}</button>
      </div>
    </div>
    <div class="recurring-stats">
      <span>${stats.done}/${stats.elapsed} days shown up${stats.maxDays ? ` \u00b7 day ${Math.min(stats.dayNumber, stats.maxDays)}/${stats.maxDays}` : ''}</span>
    </div>
    ${stats.recent.length ? `
      <div class="recurring-strip">
        ${stats.recent.map(r => `<span class="strip-dot ${r.done ? 'done' : 'missed'}"></span>`).join('')}
      </div>
    ` : ''}
  `;
}

function renderGoals(state) {
  const completed = state.goals.filter(g => g.progress >= 100);
  return `
    ${GOAL_CATEGORIES.map((cat, idx) => {
      const goalsInCat = state.goals.filter(g => (g.category || 'growth') === cat.key && g.progress < 100);
      return `
        <div class="category-header ${idx === 0 ? 'first' : ''}" id="cat-${cat.key}" style="--cat-color:${cat.color}">
          <span class="category-dot"></span>
          <span class="category-name">${escapeHtml(cat.label)}</span>
          <span class="category-count mono">${goalsInCat.length}</span>
        </div>
        ${goalsInCat.length ? goalsInCat.map(g => renderGoalCard(g, state)).join('') : `<div class="empty-state small">Nothing here yet.</div>`}
      `;
    }).join('')}
    <div class="category-header" id="cat-completed" style="--cat-color:#7C8592">
      <span class="category-dot"></span>
      <span class="category-name">Completed</span>
      <span class="category-count mono">${completed.length}</span>
    </div>
    ${completed.length ? completed.map(g => renderGoalCard(g, state)).join('') : `<div class="empty-state small">Finished goals will land here automatically.</div>`}
    <button class="add-goal-btn" id="addGoalBtn">${ICONS.plus} Add a new goal</button>
  `;
}

function renderBlueprint(state) {
  const i = state.identity, b = state.blueprint;
  return `
    <div class="section-title" style="margin-top:18px">Identity</div>
    <div class="card editable">
      ${editBtn('identity.statement', 'Identity')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(i.statement)}</div>
    </div>

    <div class="section-title">Mission</div>
    <div class="card editable">
      ${editBtn('identity.mission', 'Mission')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(i.mission)}</div>
    </div>

    <div class="section-title">Vision</div>
    <div class="card editable">
      ${editBtn('identity.vision', 'Vision')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(i.vision)}</div>
    </div>

    <div class="section-title">Core Values</div>
    <div class="card">${renderEditableList('identity.values', i.values, 'Core Values')}</div>

    <div class="section-title">Principles</div>
    <div class="card">${renderEditableList('identity.principles', i.principles, 'Principles')}</div>

    <div class="section-title">Decision Rules</div>
    <div class="card">${renderEditableList('identity.decisionRules', i.decisionRules, 'Decision Rules')}</div>

    <div class="section-title">Non-Negotiables</div>
    <div class="card">${renderEditableList('identity.nonNegotiables', i.nonNegotiables, 'Non-Negotiables')}</div>

    <div class="section-title">Success</div>
    <div class="card editable">
      ${editBtn('identity.success', 'Success')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(i.success)}</div>
    </div>

    <div class="section-title">Failure</div>
    <div class="card editable">
      ${editBtn('identity.failure', 'Failure')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(i.failure)}</div>
    </div>

    <div class="section-title">Current Season</div>
    <div class="card editable">
      ${editBtn('blueprint.season', 'Current Season')}
      <div class="vision-line" style="padding-right:30px">${escapeHtml(b.season)}</div>
      <div class="linked-actions">
        <div class="goal-why" style="margin-bottom:6px"><strong style="color:var(--ink)">Priorities</strong></div>
        ${renderEditableList('blueprint.priorities', b.priorities, 'Priorities')}
      </div>
    </div>

    <div class="section-title">Things To Ignore</div>
    <div class="card">${renderEditableList('blueprint.ignore', b.ignore, 'Things To Ignore')}</div>

    <div class="section-title">Life Philosophy</div>
    <div class="card editable">
      ${editBtn('identity.philosophy', 'Life Philosophy')}
      <div class="philosophy-quote" style="margin:0;padding-right:30px">${escapeHtml(i.philosophy)}</div>
    </div>
  `;
}

function renderBrain(state, activeCategory) {
  const categories = ['All', ...Array.from(new Set(state.brain.map(n => n.category)))];
  const notes = activeCategory && activeCategory !== 'All'
    ? state.brain.filter(n => n.category === activeCategory)
    : state.brain;

  return `
    <div class="section-title" style="margin-top:18px">Brain</div>
    <div class="chip-row">
      ${categories.map(c => `<button class="chip ${c === (activeCategory || 'All') ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
    </div>
    ${notes.length ? notes.map(n => `
      <div class="card">
        <div class="goal-top">
          <span class="card-label">${escapeHtml(n.category)}</span>
          <div class="card-actions">
            <button class="icon-btn" data-edit-note="${n.id}" aria-label="Edit note">${ICONS.edit}</button>
            <button class="icon-btn danger" data-delete-note="${n.id}" aria-label="Delete note">${ICONS.trash}</button>
          </div>
        </div>
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-content">${escapeHtml(n.content)}</div>
      </div>
    `).join('') : `<div class="empty-state">Nothing here yet. Tap + to add your first note.</div>`}
  `;
}

function renderSystem(state) {
  const s = state.system;
  return `
    <div class="section-title" style="margin-top:18px">Daily</div>
    <div class="card">${renderEditableList('system.dailyUse', s.dailyUse, 'Daily')}</div>

    <div class="section-title">Weekly</div>
    <div class="card">${renderEditableList('system.weekly', s.weekly, 'Weekly')}</div>

    <div class="section-title">Monthly</div>
    <div class="card">${renderEditableList('system.monthly', s.monthly, 'Monthly')}</div>

    <div class="rule-box editable">
      ${editBtn('system.rule', 'Operating Rule', 'icon-btn corner')}
      <div style="padding-right:30px">${escapeHtml(s.rule)}</div>
    </div>

    <div class="section-title">Account</div>
    <div class="card">
      ${isSecured() ? `
        <div class="system-row"><span>Secured as</span><span class="action-link status-synced">${escapeHtml(getUserEmail())}</span></div>
        <div class="system-row"><span>This device</span><button class="action-link" id="signOutBtn" style="color:var(--danger)">Sign out</button></div>
      ` : `
        <div class="goal-why" style="margin-bottom:14px">Your data currently lives only on this device. Secure it with an email + password so you can get it back if you clear browser data or switch phones \u2014 nothing about your existing data changes.</div>
        <button class="add-goal-btn" id="secureAccountBtn">${ICONS.plus} Secure my account</button>
      `}
      <button class="add-list-item" id="signInRestoreBtn" style="margin-top:10px">Already secured on another device? Sign in</button>
    </div>

    <div class="section-title">Application</div>
    <div class="card">
      <div class="system-row"><span>Firebase connection</span><span class="action-link status-${getStatus()}" id="firebaseStatus">${getStatus() === 'synced' ? 'Synced' : getStatus() === 'error' ? 'Connection error' : 'Connecting…'}</span></div>
      <div class="system-row"><span>Export as Reflection</span><button class="action-link" id="reflectionBtn">Download</button></div>
      <div class="system-row"><span>Export data (backup)</span><button class="action-link" id="exportBtn">Download</button></div>
      <div class="system-row"><span>Import data (restore)</span><button class="action-link" id="importBtn">Choose file</button></div>
      <input type="file" id="importFile" accept="application/json" style="display:none">
      <div class="system-row"><span>Reset to blueprint</span><button class="action-link" id="resetBtn">Reset</button></div>
    </div>
  `;
}

/* ---------------- Router ---------------- */
const SCREENS = {
  home: { render: renderHome, icon: 'home', label: 'Home' },
  goals: { render: renderGoals, icon: 'goals', label: 'Goals' },
  blueprint: { render: renderBlueprint, icon: 'blueprint', label: 'Blueprint' },
  brain: { render: renderBrain, icon: 'brain', label: 'Brain' },
  system: { render: renderSystem, icon: 'system', label: 'System' }
};

let currentTab = 'home';
let activeBrainCategory = 'All';
let editing = null;

function buildShell() {
  root.innerHTML = `
    <div class="auth-gate" id="authGate">
      <div class="auth-gate-card">
        <span class="drawer-mark" style="margin-bottom:18px">10<span class="mark-x">X</span></span>
        <h2>Welcome to LOS</h2>
        <p>Sign in to load your real data on this device, or continue as a guest with a fresh, separate LOS.</p>
        <button class="btn-primary" id="gateSignInBtn" style="width:100%;margin-bottom:10px">Sign In</button>
        <button class="btn-secondary" id="gateGuestBtn" style="width:100%">Continue as Guest</button>
      </div>
    </div>
    <div class="topbar">
      <button class="hamburger" id="menuBtn" aria-label="Open menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
      <span class="eyebrow" id="screenLabel">Home</span>
      <span style="width:38px"></span>
    </div>
    <div id="screens"></div>
    <button class="fab" id="fabBtn" aria-label="Quick add">${ICONS.plus}</button>

    <div class="drawer-backdrop" id="drawerBackdrop"></div>
    <nav class="drawer" id="drawer">
      <div class="drawer-header">
        <span class="drawer-mark">10<span class="mark-x">X</span></span>
        <div>
          <div class="drawer-title">LOS</div>
          <div class="drawer-sub">Life Operating System</div>
        </div>
      </div>
      <div class="drawer-nav" id="drawerNav"></div>
      <div class="drawer-footer">A compass, not a manager.</div>
    </nav>

    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-sheet">
        <h3 id="modalTitle">Quick Add</h3>
        <div id="typeRow">
          <label class="field-label">Type</label>
          <select class="field-select" id="addType">
            <option value="goal">Goal</option>
            <option value="action">Action</option>
            <option value="note">Brain note</option>
          </select>
        </div>
        <div id="addFields"></div>
        <div class="modal-actions">
          <button class="btn-danger" id="deleteFromModal" style="display:none">Delete</button>
          <button class="btn-secondary" id="cancelAdd">Cancel</button>
          <button class="btn-primary" id="saveAdd">Save</button>
        </div>
      </div>
    </div>
  `;

  const screensEl = document.getElementById('screens');
  Object.keys(SCREENS).forEach(key => {
    const div = document.createElement('div');
    div.className = 'screen' + (key === 'home' ? ' active' : '');
    div.id = 'screen-' + key;
    screensEl.appendChild(div);
  });

  const drawerNav = document.getElementById('drawerNav');
  Object.entries(SCREENS).forEach(([key, s]) => {
    const btn = el(`<button class="drawer-item ${key === 'home' ? 'active' : ''}" data-tab="${key}">${ICONS[s.icon]}<span>${s.label}</span></button>`);
    btn.addEventListener('click', () => { switchTab(key); closeDrawer(); });
    drawerNav.appendChild(btn);

    if (key === 'goals') {
      GOAL_CATEGORIES.forEach(cat => {
        const subBtn = el(`<button class="drawer-subitem" style="--cat-color:${cat.color}"><span class="drawer-subdot"></span>${escapeHtml(cat.label)}</button>`);
        subBtn.addEventListener('click', () => {
          switchTab('goals');
          closeDrawer();
          setTimeout(() => {
            const target = document.getElementById('cat-' + cat.key);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        });
        drawerNav.appendChild(subBtn);
      });
      const completedSub = el(`<button class="drawer-subitem" style="--cat-color:#7C8592"><span class="drawer-subdot"></span>Completed</button>`);
      completedSub.addEventListener('click', () => {
        switchTab('goals');
        closeDrawer();
        setTimeout(() => {
          const target = document.getElementById('cat-completed');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      });
      drawerNav.appendChild(completedSub);
    }
  });

  document.getElementById('menuBtn').addEventListener('click', openDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
  document.getElementById('fabBtn').addEventListener('click', () => openAddModal());
  document.getElementById('cancelAdd').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.getElementById('addType').addEventListener('change', renderModalFields);
  document.getElementById('saveAdd').addEventListener('click', saveModal);
  document.getElementById('deleteFromModal').addEventListener('click', deleteFromModal);
  document.getElementById('gateSignInBtn').addEventListener('click', () => {
    hideGate(true);
    openAccountModal('signin');
  });
  document.getElementById('gateGuestBtn').addEventListener('click', () => hideGate(true));
}

function switchTab(key) {
  currentTab = key;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + key).classList.add('active');
  document.querySelectorAll('.drawer-item').forEach(t => t.classList.toggle('active', t.dataset.tab === key));
  document.getElementById('screenLabel').textContent = SCREENS[key].label;
  document.getElementById('screens').scrollTop = 0;
  renderAll();
}

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

let gateResolved = false;

function hideGate(remember) {
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.remove('open');
  if (remember) {
    try { sessionStorage.setItem('los_gate_seen', '1'); } catch (e) {}
  }
}

function maybeShowGate() {
  if (gateResolved) return;
  const status = getStatus();
  if (status !== 'synced' && status !== 'error') return; // wait for auth to actually resolve
  gateResolved = true;
  if (isSecured()) return; // already signed in for real, no gate needed
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem('los_gate_seen') === '1'; } catch (e) {}
  if (alreadySeen) return;
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.add('open');
}

function renderAll() {
  const state = STORE.state;
  Object.keys(SCREENS).forEach(key => {
    const container = document.getElementById('screen-' + key);
    if (!container.classList.contains('active')) return;
    container.innerHTML = key === 'brain' ? renderBrain(state, activeBrainCategory) : SCREENS[key].render(state);
    attachScreenListeners(key, state);
    wireGenericEditables(container);
  });
  maybeShowGate();
}

function wireGenericEditables(container) {
  container.querySelectorAll('[data-edit-field]').forEach(node => {
    node.addEventListener('click', () => openFieldModal(node.dataset.editField, node.dataset.fieldLabel || 'Field'));
  });
  container.querySelectorAll('.li-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this item?')) return;
      const s = STORE.state;
      const arr = getPath(s, btn.dataset.listPath);
      const idx = Number(btn.dataset.listIndex);
      const removed = arr.splice(idx, 1);
      logChange(s, `Removed "${truncate(removed[0])}"`);
      STORE.save(s);
      renderAll();
    });
  });
  container.querySelectorAll('.add-list-item[data-list-path]').forEach(btn => {
    btn.addEventListener('click', () => openListAddModal(btn.dataset.listPath, btn.dataset.listLabel || 'item'));
  });
}

function attachScreenListeners(key, state) {
  if (key === 'home') {
    const editMissionBtn = document.getElementById('editMissionBtn');
    if (editMissionBtn) editMissionBtn.addEventListener('click', () => openEditModal('mission', null));
    document.querySelectorAll('[data-edit-action]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal('action', btn.dataset.editAction));
    });
    const changeFocusBtn = document.getElementById('changeFocusBtn');
    if (changeFocusBtn) changeFocusBtn.addEventListener('click', openFocusPickModal);
    const snapshotBtn = document.getElementById('snapshotBtn');
    if (snapshotBtn) snapshotBtn.addEventListener('click', () => switchTab('goals'));
  }

  if (key === 'goals') {
    document.querySelectorAll('.stepper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = STORE.state;
        const goal = s.goals.find(g => g.id === btn.dataset.goal);
        if (!goal) return;
        const delta = btn.dataset.action === 'inc' ? 5 : -5;
        goal.progress = Math.max(0, Math.min(100, goal.progress + delta));
        logChange(s, `${goal.title} progress → ${goal.progress}%`);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-edit-goal]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal('goal', btn.dataset.editGoal));
    });
    document.querySelectorAll('[data-delete-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this goal? Its linked actions stay but lose the link.')) return;
        const s = STORE.state;
        const g = s.goals.find(g => g.id === btn.dataset.deleteGoal);
        s.goals = s.goals.filter(g => g.id !== btn.dataset.deleteGoal);
        if (g) logChange(s, `Deleted goal "${g.title}"`);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-reopen-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = STORE.state;
        const g = s.goals.find(g => g.id === btn.dataset.reopenGoal);
        if (!g) return;
        const linkedActions = s.actions.filter(a => a.goalId === g.id);
        const lastCompletedOnce = linkedActions.filter(a => a.kind !== 'recurring' && a.status === 'Completed').slice(-1)[0];
        if (lastCompletedOnce) {
          lastCompletedOnce.status = 'Active';
        } else {
          const key = todayKey();
          const recurringDoneToday = linkedActions.find(a => a.kind === 'recurring' && a.log && a.log[key]);
          if (recurringDoneToday) {
            delete recurringDoneToday.log[key];
          } else if (!linkedActions.length) {
            g.progress = Math.max(0, g.progress - 10);
          }
        }
        logChange(s, `Reopened goal "${g.title}"`);
        syncGoalProgress(s);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-toggle-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = STORE.state;
        const a = s.actions.find(x => x.id === btn.dataset.toggleAction);
        if (!a) return;
        a.status = a.status === 'Completed' ? 'Active' : 'Completed';
        logChange(s, `${a.title} marked ${a.status}`);
        syncGoalProgress(s);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-toggle-recurring]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = STORE.state;
        const a = s.actions.find(x => x.id === btn.dataset.toggleRecurring);
        if (!a) return;
        if (!a.log) a.log = {};
        const key = todayKey();
        if (a.log[key]) {
          delete a.log[key];
          logChange(s, `${a.title}: today unmarked`);
        } else {
          a.log[key] = true;
          logChange(s, `${a.title}: showed up today`);
        }
        syncGoalProgress(s);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-edit-action]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal('action', btn.dataset.editAction));
    });
    document.querySelectorAll('[data-delete-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this action?')) return;
        const s = STORE.state;
        const a = s.actions.find(a => a.id === btn.dataset.deleteAction);
        s.actions = s.actions.filter(a => a.id !== btn.dataset.deleteAction);
        if (a) logChange(s, `Deleted action "${a.title}"`);
        syncGoalProgress(s);
        STORE.save(s);
        renderAll();
      });
    });
    document.querySelectorAll('[data-add-action-to]').forEach(btn => {
      btn.addEventListener('click', () => openAddModal('action', btn.dataset.addActionTo));
    });
    const addGoalBtn = document.getElementById('addGoalBtn');
    if (addGoalBtn) addGoalBtn.addEventListener('click', () => openAddModal('goal'));
  }

  if (key === 'brain') {
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeBrainCategory = chip.dataset.cat;
        renderAll();
      });
    });
    document.querySelectorAll('[data-edit-note]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal('note', btn.dataset.editNote));
    });
    document.querySelectorAll('[data-delete-note]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this note?')) return;
        const s = STORE.state;
        const n = s.brain.find(n => n.id === btn.dataset.deleteNote);
        s.brain = s.brain.filter(n => n.id !== btn.dataset.deleteNote);
        if (n) logChange(s, `Deleted note "${n.title}"`);
        STORE.save(s);
        renderAll();
      });
    });
  }

  if (key === 'system') {
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');
    const reflectionBtn = document.getElementById('reflectionBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const secureAccountBtn = document.getElementById('secureAccountBtn');
    const signInRestoreBtn = document.getElementById('signInRestoreBtn');
    if (secureAccountBtn) secureAccountBtn.addEventListener('click', () => openAccountModal('secure'));
    if (signInRestoreBtn) signInRestoreBtn.addEventListener('click', () => openAccountModal('signin'));
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', async () => {
      if (!confirm('Signing out starts a fresh, empty LOS on THIS device. Your real data stays safe in Firestore under your email — sign back in anytime to get it back. Continue?')) return;
      try {
        await signOutAccount();
      } catch (err) {
        alert(accountErrorMessage(err));
      }
    });
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'los-export.json'; a.click();
      URL.revokeObjectURL(url);
    });
    if (reflectionBtn) reflectionBtn.addEventListener('click', () => {
      const text = buildReflectionText(state);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'los-reflection.md'; a.click();
      URL.revokeObjectURL(url);
    });
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm('This replaces everything currently in LOS with this backup file. Continue?')) {
          importFile.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            const restored = migrate(parsed);
            logChange(restored, 'Restored from backup file');
            STORE.save(restored);
            renderAll();
          } catch (err) {
            alert("Couldn't read that file — make sure it's a LOS export (Export data → the .json file).");
          }
          importFile.value = '';
        };
        reader.readAsText(file);
      });
    }
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (confirm('This permanently erases every goal, action, note, and edit you\u2019ve made, and reloads the original blueprint. This cannot be undone unless you have an exported backup. Continue?')) {
        STORE.reset();
        renderAll();
      }
    });
  }
}

/* ---------------- Add / Edit modal ---------------- */
function openAddModal(forceType, presetGoalId) {
  editing = { type: forceType || null, id: null, presetGoalId: presetGoalId || null };
  const typeSelect = document.getElementById('addType');
  document.getElementById('typeRow').style.display = forceType ? 'none' : 'block';
  if (forceType) typeSelect.value = forceType;
  document.getElementById('modalTitle').textContent = 'Quick Add';
  document.getElementById('deleteFromModal').style.display = 'none';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function openEditModal(type, id) {
  const state = STORE.state;
  let item = null;
  if (type === 'goal') item = state.goals.find(g => g.id === id);
  if (type === 'action') item = state.actions.find(a => a.id === id);
  if (type === 'note') item = state.brain.find(n => n.id === id);
  if (type === 'mission') item = { mission: state.home.mission };

  editing = { type, id, item };
  document.getElementById('typeRow').style.display = 'none';
  document.getElementById('modalTitle').textContent = 'Edit ' + (type === 'mission' ? "Today's Mission" : type);
  document.getElementById('deleteFromModal').style.display = type === 'mission' ? 'none' : 'inline-block';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function openFieldModal(path, label) {
  const state = STORE.state;
  editing = { type: 'field', path, label, value: getPath(state, path) };
  document.getElementById('typeRow').style.display = 'none';
  document.getElementById('modalTitle').textContent = 'Edit ' + label;
  document.getElementById('deleteFromModal').style.display = 'none';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function openListAddModal(path, label) {
  editing = { type: 'listadd', path, label };
  document.getElementById('typeRow').style.display = 'none';
  document.getElementById('modalTitle').textContent = 'Add to ' + label;
  document.getElementById('deleteFromModal').style.display = 'none';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function openAccountModal(mode) {
  editing = { type: mode === 'secure' ? 'secure-account' : 'signin-account' };
  document.getElementById('typeRow').style.display = 'none';
  document.getElementById('modalTitle').textContent = mode === 'secure' ? 'Secure My Account' : 'Sign In To Restore';
  document.getElementById('deleteFromModal').style.display = 'none';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function accountErrorMessage(err) {
  const code = err && err.code;
  if (code === 'auth/email-already-in-use') return 'That email is already secured to an account. Try "Sign in" instead.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found for that email.';
  return 'Something went wrong: ' + (err && err.message ? err.message : 'unknown error');
}

function openFocusPickModal() {
  editing = { type: 'focuspick' };
  document.getElementById('typeRow').style.display = 'none';
  document.getElementById('modalTitle').textContent = 'Set Focus';
  document.getElementById('deleteFromModal').style.display = 'none';
  document.getElementById('saveAdd').style.display = 'none';
  document.getElementById('modalBackdrop').classList.add('open');
  renderModalFields();
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('saveAdd').style.display = '';
  editing = null;
}

function renderModalFields() {
  const state = STORE.state;
  const wrap = document.getElementById('addFields');
  const type = editing && editing.type ? editing.type : document.getElementById('addType').value;
  const item = editing ? editing.item : null;

  if (type === 'goal') {
    wrap.innerHTML = `
      <label class="field-label">Title</label>
      <input class="field-input" id="f_title" placeholder="e.g. Health" value="${item ? escapeHtml(item.title) : ''}">
      <label class="field-label">Why</label>
      <textarea class="field-textarea" id="f_why" placeholder="Why does this matter?">${item ? escapeHtml(item.why) : ''}</textarea>
      <label class="field-label">Category</label>
      <select class="field-select" id="f_category">
        ${GOAL_CATEGORIES.map(c => `<option value="${c.key}" ${item && (item.category || 'growth') === c.key ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
      </select>
      <label class="field-label">Deadline (optional)</label>
      <input class="field-input" type="date" id="f_deadline" value="${item && item.deadline ? item.deadline : ''}">
    `;
  } else if (type === 'action') {
    const kind = item ? (item.kind || 'once') : 'once';
    const selDays = item && item.days && item.days.length ? item.days : WEEKDAYS;
    wrap.innerHTML = `
      <label class="field-label">Title</label>
      <input class="field-input" id="f_title" placeholder="What are you doing?" value="${item ? escapeHtml(item.title) : ''}">
      <label class="field-label">Why</label>
      <textarea class="field-textarea" id="f_why" placeholder="Why does this matter?">${item ? escapeHtml(item.why) : ''}</textarea>
      <label class="field-label">Linked Goal</label>
      <select class="field-select" id="f_goal">
        ${state.goals.map(g => `<option value="${g.id}" ${(item && item.goalId === g.id) || (editing.presetGoalId === g.id) ? 'selected' : ''}>${escapeHtml(g.title)}</option>`).join('')}
      </select>
      <label class="field-label">Type</label>
      <select class="field-select" id="f_kind">
        <option value="once" ${kind === 'once' ? 'selected' : ''}>One-time action</option>
        <option value="recurring" ${kind === 'recurring' ? 'selected' : ''}>Recurring (daily habit)</option>
      </select>
      <div id="onceFields" style="${kind === 'recurring' ? 'display:none' : ''}">
        <label class="field-label">Status</label>
        <select class="field-select" id="f_status">
          ${['Not Started', 'Active', 'Completed'].map(s => `<option ${item && item.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div id="recurringFields" style="${kind === 'once' ? 'display:none' : ''}">
        <label class="field-label">Repeat on</label>
        <div class="weekday-picker">
          ${WEEKDAYS.map(d => `<button type="button" class="weekday-btn ${selDays.includes(d) ? 'active' : ''}" data-day="${d}">${d[0]}</button>`).join('')}
        </div>
        <label class="field-label">Duration in days (optional)</label>
        <input class="field-input" type="number" min="1" id="f_duration" placeholder="e.g. 90" value="${item && item.durationDays ? item.durationDays : ''}">
      </div>
    `;
    const kindSelect = wrap.querySelector('#f_kind');
    kindSelect.addEventListener('change', () => {
      const isRecurring = kindSelect.value === 'recurring';
      wrap.querySelector('#onceFields').style.display = isRecurring ? 'none' : 'block';
      wrap.querySelector('#recurringFields').style.display = isRecurring ? 'block' : 'none';
    });
    wrap.querySelectorAll('.weekday-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('active'));
    });
  } else if (type === 'note') {
    wrap.innerHTML = `
      <label class="field-label">Title</label>
      <input class="field-input" id="f_title" placeholder="Note title" value="${item ? escapeHtml(item.title) : ''}">
      <label class="field-label">Category</label>
      <input class="field-input" id="f_category" placeholder="Ideas, Books, AI, Business..." value="${item ? escapeHtml(item.category) : ''}">
      <label class="field-label">Content</label>
      <textarea class="field-textarea" id="f_content" placeholder="What did you learn?">${item ? escapeHtml(item.content) : ''}</textarea>
    `;
  } else if (type === 'mission') {
    wrap.innerHTML = `
      <label class="field-label">Today's Mission</label>
      <textarea class="field-textarea" id="f_mission" placeholder="What matters most today?">${item ? escapeHtml(item.mission) : ''}</textarea>
    `;
  } else if (type === 'field') {
    wrap.innerHTML = `
      <label class="field-label">${escapeHtml(editing.label)}</label>
      <textarea class="field-textarea" id="f_field" style="min-height:120px">${escapeHtml(editing.value || '')}</textarea>
    `;
  } else if (type === 'listadd') {
    wrap.innerHTML = `
      <label class="field-label">${escapeHtml(editing.label)}</label>
      <textarea class="field-textarea" id="f_listitem" placeholder="New item"></textarea>
    `;
  } else if (type === 'focuspick') {
    wrap.innerHTML = `
      <div class="focus-pick-list">
        ${state.actions.length ? state.actions.map(a => `
          <button class="focus-pick-item" data-pick-action="${a.id}">
            <span>${escapeHtml(a.title)}</span>
            <span class="status-pill ${a.status.toLowerCase().replace(' ', '-')}">${a.status}</span>
          </button>
        `).join('') : `<div class="empty-state small">No actions yet \u2014 add one from Goals first.</div>`}
      </div>
    `;
    wrap.querySelectorAll('[data-pick-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = STORE.state;
        s.actions.forEach(a => { if (a.status === 'Active') a.status = 'Not Started'; });
        const chosen = s.actions.find(a => a.id === btn.dataset.pickAction);
        if (chosen) {
          chosen.status = 'Active';
          logChange(s, `Set focus: "${chosen.title}"`);
        }
        STORE.save(s);
        closeModal();
        renderAll();
      });
    });
  } else if (type === 'secure-account') {
    wrap.innerHTML = `
      <div class="goal-why" style="margin-bottom:14px">This links an email + password to your existing data \u2014 nothing is lost or reset.</div>
      <label class="field-label">Email</label>
      <input class="field-input" type="email" id="f_email" placeholder="you@example.com">
      <label class="field-label">Password</label>
      <input class="field-input" type="password" id="f_password" placeholder="At least 6 characters">
    `;
  } else if (type === 'signin-account') {
    wrap.innerHTML = `
      <div class="goal-why" style="margin-bottom:14px">Enter the email + password you secured earlier to bring that data to this device.</div>
      <label class="field-label">Email</label>
      <input class="field-input" type="email" id="f_email" placeholder="you@example.com">
      <label class="field-label">Password</label>
      <input class="field-input" type="password" id="f_password" placeholder="Your password">
    `;
  }
}

async function saveModal() {
  const state = STORE.state;
  const type = editing.type || document.getElementById('addType').value;

  if (type === 'secure-account') {
    const email = document.getElementById('f_email').value.trim();
    const password = document.getElementById('f_password').value;
    if (!email || password.length < 6) {
      alert('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    try {
      await secureAccount(email, password);
      closeModal();
      renderAll();
    } catch (err) {
      alert(accountErrorMessage(err));
    }
    return;
  }

  if (type === 'signin-account') {
    const email = document.getElementById('f_email').value.trim();
    const password = document.getElementById('f_password').value;
    if (!email || !password) {
      alert('Enter your email and password.');
      return;
    }
    try {
      await signInToRestore(email, password);
      closeModal();
      renderAll();
    } catch (err) {
      alert(accountErrorMessage(err));
    }
    return;
  }

  if (type === 'field') {
    const val = document.getElementById('f_field').value.trim();
    setPath(state, editing.path, val);
    logChange(state, `Updated ${editing.label}`);
    STORE.save(state);
    closeModal();
    renderAll();
    return;
  }

  if (type === 'listadd') {
    const val = document.getElementById('f_listitem').value.trim();
    if (!val) return;
    const arr = getPath(state, editing.path);
    arr.push(val);
    logChange(state, `Added to ${editing.label}: "${truncate(val)}"`);
    STORE.save(state);
    closeModal();
    renderAll();
    return;
  }

  if (type === 'mission') {
    state.home.mission = document.getElementById('f_mission').value.trim() || state.home.mission;
    logChange(state, "Updated Today's Mission");
    STORE.save(state);
    closeModal();
    renderAll();
    return;
  }

  const title = document.getElementById('f_title').value.trim();
  if (!title) return;

  if (type === 'goal') {
    const why = document.getElementById('f_why').value.trim();
    const deadline = document.getElementById('f_deadline').value || '';
    const category = document.getElementById('f_category').value;
    if (editing.id) {
      const g = state.goals.find(g => g.id === editing.id);
      g.title = title; g.why = why; g.deadline = deadline; g.category = category;
      logChange(state, `Updated goal "${title}"`);
    } else {
      state.goals.push({ id: 'g' + Date.now(), title, why, deadline, category, progress: 0 });
      logChange(state, `Added goal "${title}"`);
    }
  } else if (type === 'action') {
    const why = document.getElementById('f_why').value.trim();
    const goalId = document.getElementById('f_goal').value;
    const kind = document.getElementById('f_kind').value;
    if (editing.id) {
      const a = state.actions.find(a => a.id === editing.id);
      a.title = title; a.why = why; a.goalId = goalId; a.kind = kind;
      if (kind === 'recurring') {
        const days = Array.from(document.querySelectorAll('.weekday-btn.active')).map(b => b.dataset.day);
        const durationVal = document.getElementById('f_duration').value;
        a.days = days.length ? days : WEEKDAYS;
        a.durationDays = durationVal ? parseInt(durationVal, 10) : null;
        if (!a.log) a.log = {};
        if (!a.startDate) a.startDate = todayKey();
      } else {
        a.status = document.getElementById('f_status').value;
      }
      logChange(state, `Updated action "${title}"`);
    } else {
      const newAction = { id: 'a' + Date.now(), title, why, goalId, kind };
      if (kind === 'recurring') {
        const days = Array.from(document.querySelectorAll('.weekday-btn.active')).map(b => b.dataset.day);
        const durationVal = document.getElementById('f_duration').value;
        newAction.days = days.length ? days : WEEKDAYS;
        newAction.durationDays = durationVal ? parseInt(durationVal, 10) : null;
        newAction.startDate = todayKey();
        newAction.log = {};
        newAction.status = 'Active';
      } else {
        newAction.status = document.getElementById('f_status').value;
      }
      state.actions.push(newAction);
      logChange(state, `Added action "${title}"`);
    }
  } else if (type === 'note') {
    const category = document.getElementById('f_category').value.trim() || 'Ideas';
    const content = document.getElementById('f_content').value.trim();
    if (editing.id) {
      const n = state.brain.find(n => n.id === editing.id);
      n.title = title; n.category = category; n.content = content;
      logChange(state, `Updated note "${title}"`);
    } else {
      state.brain.push({ id: 'b' + Date.now(), title, category, content });
      logChange(state, `Added note "${title}"`);
    }
  }

  syncGoalProgress(state);
  STORE.save(state);
  closeModal();
  renderAll();
}

function deleteFromModal() {
  if (!editing || !editing.id) return;
  if (!confirm('Delete this?')) return;
  const state = STORE.state;
  if (editing.type === 'goal') {
    const g = state.goals.find(g => g.id === editing.id);
    state.goals = state.goals.filter(g => g.id !== editing.id);
    if (g) logChange(state, `Deleted goal "${g.title}"`);
  }
  if (editing.type === 'action') {
    const a = state.actions.find(a => a.id === editing.id);
    state.actions = state.actions.filter(a => a.id !== editing.id);
    if (a) logChange(state, `Deleted action "${a.title}"`);
  }
  if (editing.type === 'note') {
    const n = state.brain.find(n => n.id === editing.id);
    state.brain = state.brain.filter(n => n.id !== editing.id);
    if (n) logChange(state, `Deleted note "${n.title}"`);
  }
  syncGoalProgress(state);
  STORE.save(state);
  closeModal();
  renderAll();
}

/* ---------------- Init ---------------- */
buildShell();
renderAll();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
