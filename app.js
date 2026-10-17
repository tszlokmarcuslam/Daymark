const STORAGE = { events: 'daymark.events.v1', sessions: 'daymark.sessions.v1', availability: 'daymark.availability.v1', theme: 'daymark.theme.v1', themeColors: 'daymark.theme-colors.v1', demoCleanup: 'daymark.demo-cleanup.v1' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DEFAULT_AVAILABILITY = [90, 90, 90, 90, 90, 90, 120];
const DEMO_EVENT_SIGNATURES = new Set([
  'Seminar: research ethics|PSYC 201|class|2026-10-18',
  'Reading response|PSYC 201|assignment|2026-10-20',
  'Problem set 4|MATH 118|assignment|2026-10-22',
  'Statistics quiz|STAT 102|test|2026-10-24',
  'Midterm exam|HIST 140|exam|2026-10-28'
]);
const state = {
  events: readStorage(STORAGE.events, []),
  sessions: readStorage(STORAGE.sessions, []),
  availability: readStorage(STORAGE.availability, DEFAULT_AVAILABILITY),
  theme: readStorage(STORAGE.theme, 'system'),
  themeColors: readStorage(STORAGE.themeColors, { background: '#f6f7f3', accent: '#123f35' }),
  offset: 0,
  view: 'week',
  mode: 'calendar'
};
let toastTimer;

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
function saveStorage() {
  try {
    localStorage.setItem(STORAGE.events, JSON.stringify(state.events));
    localStorage.setItem(STORAGE.sessions, JSON.stringify(state.sessions));
    localStorage.setItem(STORAGE.availability, JSON.stringify(state.availability));
    localStorage.setItem(STORAGE.theme, JSON.stringify(state.theme));
    localStorage.setItem(STORAGE.themeColors, JSON.stringify(state.themeColors));
  } catch {
    showToast('Browser storage is unavailable. Your changes may not persist after closing this page.');
  }
}
function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function dateAtOffset(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return localDate(date);
}
function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = parseLocalDate(value);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
function addDays(value, amount) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}
function dateLabel(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(parseLocalDate(value));
}
function dateDistance(value) {
  const today = localDate();
  const days = Math.round((parseLocalDate(value) - parseLocalDate(today)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `In ${days} days`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
if (!Array.isArray(state.events)) state.events = [];
if (!Array.isArray(state.availability) || state.availability.length !== 7) state.availability = [...DEFAULT_AVAILABILITY];
if (!['light', 'dark', 'system', 'ubuntu', 'custom'].includes(state.theme)) state.theme = 'system';
if (!state.themeColors || !/^#[\da-f]{6}$/i.test(state.themeColors.background) || !/^#[\da-f]{6}$/i.test(state.themeColors.accent)) state.themeColors = { background: '#f6f7f3', accent: '#123f35' };
let demoCleanupDone = false;
try { demoCleanupDone = localStorage.getItem(STORAGE.demoCleanup) === 'done'; }
catch { demoCleanupDone = true; }
if (!demoCleanupDone) {
  const removedIds = new Set(state.events.filter(event => DEMO_EVENT_SIGNATURES.has(`${event.title}|${event.course}|${event.type}|${event.date}`)).map(event => event.id));
  if (removedIds.size) {
    state.events = state.events.filter(event => !removedIds.has(event.id));
    state.sessions = state.sessions.filter(session => !removedIds.has(session.sourceId));
    saveStorage();
  }
  try { localStorage.setItem(STORAGE.demoCleanup, 'done'); }
  catch { /* Keep the current session free of sample data if storage is unavailable. */ }
}
applyTheme(state.theme);

function applyTheme(theme) {
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme === 'custom' ? 'custom' : theme;
  const root = document.documentElement;
  for (const property of ['--canvas', '--paper', '--line', '--ink', '--muted', '--green', '--green-2', '--accent-ink']) root.style.removeProperty(property);
  root.dataset.theme = resolvedTheme;
  document.querySelector('meta[name="theme-color"]').content = resolvedTheme === 'custom' ? state.themeColors.accent : resolvedTheme === 'ubuntu' ? '#2c001e' : resolvedTheme === 'dark' ? '#111a15' : '#123f35';
  if (resolvedTheme === 'custom') {
    const background = state.themeColors.background;
    const accent = state.themeColors.accent;
    const backgroundIsLight = colorLuminance(background) > 0.18;
    const foreground = backgroundIsLight ? '#1e2b27' : '#edf3ee';
    root.style.setProperty('--canvas', background);
    root.style.setProperty('--paper', mixHex(background, foreground, 0.06));
    root.style.setProperty('--line', mixHex(background, foreground, 0.16));
    root.style.setProperty('--ink', foreground);
    root.style.setProperty('--muted', mixHex(background, foreground, 0.62));
    root.style.setProperty('--green', accent);
    root.style.setProperty('--green-2', mixHex(accent, '#000000', 0.18));
    root.style.setProperty('--accent-ink', colorLuminance(accent) > 0.18 ? '#17251d' : '#ffffff');
  }
  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.checked = input.value === theme;
  });
  document.getElementById('customThemeFields').hidden = theme !== 'custom';
  document.getElementById('themeBackground').value = state.themeColors.background;
  document.getElementById('themeAccent').value = state.themeColors.accent;
}
function colorLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function mixHex(first, second, amount) {
  const firstChannels = first.slice(1).match(/../g).map(value => parseInt(value, 16));
  const secondChannels = second.slice(1).match(/../g).map(value => parseInt(value, 16));
  return `#${firstChannels.map((value, index) => Math.round(value * (1 - amount) + secondChannels[index] * amount).toString(16).padStart(2, '0')).join('')}`;
}
  function generatePlan() {
    const assessments = state.events
      .filter(event => event.type !== 'class')
      .sort((first, second) => first.date.localeCompare(second.date));
    const sessions = [];
    const usedMinutes = new Map();
    const starts = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '20:30'];
    for (const task of assessments) {
      let remaining = Math.max(30, Number(task.effortHours || 1) * 60);
      const firstDay = task.date < addDays(localDate(), 1) ? task.date : (task.date > addDays(localDate(), 14) ? addDays(task.date, -14) : localDate());
      for (let day = firstDay; day < task.date && remaining > 0; day = addDays(day, 1)) {
        const weekday = parseLocalDate(day).getDay();
        const dailyLimit = Math.max(0, Number(state.availability[weekday]) || 0);
        let scheduledToday = usedMinutes.get(day) || 0;
        while (remaining > 0 && scheduledToday < dailyLimit) {
          const duration = Math.min(60, remaining, dailyLimit - scheduledToday);
          const startTime = starts.find(start => isSlotFree(day, start, duration, sessions));
          if (!startTime) break;
          sessions.push({ id: id(), sourceId: task.id, title: task.title, course: task.course, type: 'study', date: day, startTime, endTime: addMinutes(startTime, duration), duration });
          remaining -= duration;
          scheduledToday += duration;
          usedMinutes.set(day, scheduledToday);
        }
      }
      task.unscheduledMinutes = remaining;
    }
    state.sessions = sessions;
    saveStorage();
    render();
    const unfinished = assessments.reduce((total, item) => total + (item.unscheduledMinutes || 0), 0);
    showToast(unfinished ? `Plan built. ${formatDuration(unfinished)} still needs time; adjust study hours or estimates.` : 'Your study plan is ready. Sessions avoid your scheduled classes.');
  }
  function addMinutes(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const result = hours * 60 + mins + minutes;
    return `${String(Math.floor(result / 60)).padStart(2, '0')}:${String(result % 60).padStart(2, '0')}`;
  }
  function overlaps(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
  }
  function isSlotFree(day, start, duration, sessions) {
    const end = addMinutes(start, duration);
    const classes = state.events.filter(event => event.type === 'class' && event.date === day && event.startTime && event.endTime);
    const planned = sessions.filter(session => session.date === day);
    return ![...classes, ...planned].some(event => overlaps(start, end, event.startTime, event.endTime));
  }
  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours ? `${hours}h` : ''}${hours && remainder ? ' ' : ''}${remainder ? `${remainder}m` : ''}` || '0m';
  }
  function formatTime(value) {
    if (!value) return '';
    const [hour, minute] = value.split(':').map(Number);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: minute ? '2-digit' : undefined }).format(new Date(2000, 0, 1, hour, minute));
  }
  function eventsOn(day) {
    return [
      ...state.events.filter(event => event.date === day),
      ...state.sessions.filter(session => session.date === day)
    ].sort((first, second) => (first.startTime || (first.type === 'study' ? '16:00' : '12:00')).localeCompare(second.startTime || (second.type === 'study' ? '16:00' : '12:00')));
  }
  function render() {
    renderHeading();
    renderSummary();
    renderWeek();
    renderTimeline();
    renderAvailability();
  }
  function renderHeading() {
    const start = dateAtOffset(state.offset);
    const end = addDays(start, 6);
    const timeline = state.view === 'timeline';
    document.getElementById('weekLabel').textContent = `${dateLabel(start)} – ${dateLabel(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
    document.getElementById('viewName').textContent = timeline ? 'Course timeline' : 'Study plan';
    document.getElementById('pageTitle').textContent = timeline ? 'Course timeline' : 'Study plan';
    document.getElementById('pageSubtitle').textContent = timeline ? 'A clear view of classes, tests and due dates.' : 'A calmer view of what’s coming up.';
    document.getElementById('weekControls').hidden = timeline;
    document.getElementById('weekView').hidden = timeline;
    document.getElementById('timelineView').hidden = !timeline;
    document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  }
  function renderSummary() {
    const start = dateAtOffset(state.offset);
    const end = addDays(start, 6);
    const sessions = state.sessions.filter(session => session.date >= start && session.date <= end);
    const minutes = sessions.reduce((total, session) => total + session.duration, 0);
    document.getElementById('studyHours').textContent = `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h`;
    const upcoming = state.events.filter(event => event.type !== 'class' && event.date >= localDate()).sort((first, second) => first.date.localeCompare(second.date))[0];
    document.getElementById('nextDeadline').textContent = upcoming ? upcoming.title : 'Nothing due';
    document.getElementById('nextDeadlineMeta').textContent = upcoming ? `${upcoming.course} · ${dateDistance(upcoming.date)}` : 'Add an assessment to begin';
    document.getElementById('eventCount').textContent = `${state.events.length} ${state.events.length === 1 ? 'event' : 'events'}`;
  }
  function renderWeek() {
    const grid = document.getElementById('weekGrid');
    const start = dateAtOffset(state.offset);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const hasItems = days.some(day => eventsOn(day).length);
    document.getElementById('weekEmpty').hidden = hasItems;
    grid.hidden = !hasItems || state.mode !== 'calendar';
    document.getElementById('weekList').hidden = !hasItems || state.mode !== 'list';
    grid.innerHTML = days.map(day => {
      const date = parseLocalDate(day);
      const items = eventsOn(day);
      return `<article class="day-column ${day === localDate() ? 'is-today' : ''}"><header class="day-head"><span class="day-name">${SHORT_DAYS[date.getDay()]}</span><span class="day-number">${date.getDate()}</span></header><div class="day-items">${items.length ? items.map(renderEventCard).join('') : '<div class="day-empty">Open</div>'}</div></article>`;
    }).join('');
    document.getElementById('weekList').innerHTML = days.flatMap(day => eventsOn(day).map(event => `<article class="list-row"><span class="list-date">${dateLabel(day, { weekday: 'short', month: 'short', day: 'numeric' })}${day === localDate() ? ' · Today' : ''}</span><div><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.course)}${event.type === 'study' ? ` · ${formatDuration(event.duration)}` : ''}</small></div><span class="type-pill type-${event.type}">${event.type === 'study' ? 'Study session' : escapeHTML(event.type)}</span><span class="list-meta">${event.startTime ? formatTime(event.startTime) : dateDistance(day)}</span></article>`)).join('');
  }
  function renderEventCard(event) {
    const isStudy = event.type === 'study';
    const time = event.startTime ? `${formatTime(event.startTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}` : (isStudy ? '' : 'Due today');
    const label = isStudy ? 'Study session' : event.type;
    return `<div class="event-card ${event.type}"><span class="event-time">${escapeHTML(time || (isStudy ? formatDuration(event.duration) : ''))}</span><strong>${escapeHTML(event.title)}</strong><span class="event-course">${escapeHTML(event.course)}</span><span class="event-type">${escapeHTML(label)}${isStudy ? ` · ${formatDuration(event.duration)}` : ''}</span></div>`;
  }
  function renderTimeline() {
    const rows = document.getElementById('timelineRows');
    const events = [...state.events].sort((first, second) => first.date.localeCompare(second.date));
    document.getElementById('timelineEmpty').hidden = events.length > 0;
    document.querySelector('.timeline-table-wrap').hidden = events.length === 0;
    rows.innerHTML = events.map(event => `<tr><td class="timeline-title">${escapeHTML(event.title)}</td><td>${escapeHTML(event.course)}</td><td><span class="type-pill type-${event.type}">${escapeHTML(event.type)}</span></td><td>${dateLabel(event.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}${event.type === 'class' && event.startTime ? `<br><small>${formatTime(event.startTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}</small>` : ''}</td><td>${event.type === 'class' ? '—' : `${Number(event.effortHours || 0)} hours`}</td><td><button class="delete-event" data-delete="${escapeHTML(event.id)}" aria-label="Delete ${escapeHTML(event.title)}" title="Delete event">×</button></td></tr>`).join('');
  }
  function renderAvailability() {
    document.getElementById('availabilityList').innerHTML = DAYS.map((day, index) => `<div class="availability-row"><label for="availability-${index}">${day}</label><select id="availability-${index}" name="day-${index}"><option value="0" ${state.availability[index] === 0 ? 'selected' : ''}>Unavailable</option><option value="60" ${state.availability[index] === 60 ? 'selected' : ''}>1 hour</option><option value="90" ${state.availability[index] === 90 ? 'selected' : ''}>1.5 hours</option><option value="120" ${state.availability[index] === 120 ? 'selected' : ''}>2 hours</option><option value="180" ${state.availability[index] === 180 ? 'selected' : ''}>3 hours</option></select></div>`).join('');
  }
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
}
function openDialog(idValue) {
  document.getElementById(idValue).showModal();
}
function closeDialog(idValue) {
  document.getElementById(idValue).close();
}
function setView(view) {
  state.view = view;
  render();
}
function importCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one event.');
  const headers = rows[0].map(value => value.trim().toLowerCase());
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  if (indexes.title === undefined || indexes.date === undefined) throw new Error('CSV needs at least title and date columns.');
  const allowed = new Set(['class', 'assignment', 'test', 'exam']);
  const imported = rows.slice(1).filter(row => row.some(value => value.trim())).map((row, index) => {
    const value = name => indexes[name] === undefined ? '' : (row[indexes[name]] || '').trim();
    const type = (value('type') || 'assignment').toLowerCase();
    const date = value('date');
    if (!isValidDateString(date)) throw new Error(`Row ${index + 2}: date must be a real date in YYYY-MM-DD format.`);
    if (!allowed.has(type)) throw new Error(`Row ${index + 2}: type must be class, assignment, test or exam.`);
    const startTime = value('starttime') || value('start time');
    const endTime = value('endtime') || value('end time');
    if (type === 'class' && (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime)) throw new Error(`Row ${index + 2}: classes need valid startTime and endTime values.`);
    const effortText = value('efforthours') || value('effort hours');
    const effort = Number(effortText || (type === 'exam' ? 5 : type === 'class' ? 0 : 2));
    if (type !== 'class' && (!Number.isFinite(effort) || effort < 0.5 || effort > 80)) throw new Error(`Row ${index + 2}: effortHours must be between 0.5 and 80.`);
    return { id: id(), title: value('title'), course: value('course') || 'Course', type, date, startTime, endTime, effortHours: type === 'class' ? 0 : Math.max(0.5, effort), calendarKey: `csv:${date}:${type}:${value('course')}:${value('title')}:${startTime}` };
  });
  if (!imported.length || imported.some(event => !event.title)) throw new Error('Each event needs a title.');
  commitImportedEvents(imported, 'CSV');
}
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function splitOutsideQuotes(value, delimiter) {
  const parts = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '"') quoted = !quoted;
    else if (value[index] === delimiter && !quoted) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start));
  return parts;
}
function findOutsideQuotes(value, character) {
  let quoted = false;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '"') quoted = !quoted;
    else if (value[index] === character && !quoted) return index;
  }
  return -1;
}
function parseICSProperty(line) {
  const colonIndex = findOutsideQuotes(line, ':');
  if (colonIndex < 0) return null;
  const [namePart, ...parameterParts] = splitOutsideQuotes(line.slice(0, colonIndex), ';');
  const parameters = {};
  for (const part of parameterParts) {
    const equals = part.indexOf('=');
    if (equals < 0) continue;
    parameters[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1).replace(/^"|"$/g, '');
  }
  const rawValue = line.slice(colonIndex + 1);
  const value = rawValue.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1');
  return { name: namePart.toUpperCase(), parameters, rawValue, value };
}
function localParts(date) {
  return { date: localDate(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
}
function zonedDateTime(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let attempt = 0; attempt < 3; attempt++) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, Number(part.value)]));
    timestamp += target - Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  }
  return new Date(timestamp);
}
function parseICSDate(property) {
  const value = property.rawValue;
  if (/^\d{8}$/.test(value)) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    if (!isValidDateString(date)) throw new Error('Calendar contains an invalid date.');
    return { date, time: '', dateOnly: true, parts: { year: Number(value.slice(0, 4)), month: Number(value.slice(4, 6)), day: Number(value.slice(6, 8)), hour: 0, minute: 0, second: 0 }, timeZone: property.parameters.TZID || '', utc: false };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!match) throw new Error('Calendar contains a date format this planner cannot read.');
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0) };
  const wallDate = `${match[1]}-${match[2]}-${match[3]}`;
  if (!isValidDateString(wallDate) || parts.hour > 23 || parts.minute > 59 || parts.second > 59) throw new Error('Calendar contains an invalid date or time.');
  const utc = Boolean(match[7]);
  const timeZone = property.parameters.TZID || '';
  let date;
  if (utc) date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  else if (timeZone) {
    try { date = zonedDateTime(parts, timeZone); }
    catch { throw new Error(`Calendar uses a time zone this browser cannot read: ${timeZone}.`); }
  } else date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return { ...localParts(date), dateOnly: false, parts, timeZone, utc };
}
function shiftICSDate(value, days) {
  const base = new Date(Date.UTC(value.parts.year, value.parts.month - 1, value.parts.day + days, value.parts.hour, value.parts.minute, value.parts.second));
  const parts = { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate(), hour: value.parts.hour, minute: value.parts.minute, second: value.parts.second };
  if (value.dateOnly) return { ...value, date: localDate(new Date(parts.year, parts.month - 1, parts.day, 12)), parts };
  let instant;
  if (value.utc) instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  else if (value.timeZone) instant = zonedDateTime(parts, value.timeZone);
  else instant = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return { ...value, ...localParts(instant), parts };
}
function recurrenceInstances(start, ruleProperty, exdateProperties) {
  const exclusions = new Set();
  for (const property of exdateProperties) {
    for (const value of property.rawValue.split(',')) {
      try {
        const exclusion = parseICSDate({ ...property, rawValue: value });
        exclusions.add(exclusion.dateOnly ? `${exclusion.date}|*` : `${exclusion.date}|${exclusion.time}`);
      } catch { /* Ignore malformed exclusions; keep the source event. */ }
    }
  }
  const included = value => !exclusions.has(`${value.date}|*`) && !exclusions.has(`${value.date}|${value.time}`);
  const instances = included(start) ? [start] : [];
  if (!ruleProperty) return instances;
  const rule = Object.fromEntries(ruleProperty.value.split(';').map(entry => {
    const split = entry.indexOf('=');
    return split < 0 ? [entry.toUpperCase(), ''] : [entry.slice(0, split).toUpperCase(), entry.slice(split + 1)];
  }));
  const frequency = rule.FREQ;
  if (!['DAILY', 'WEEKLY'].includes(frequency)) throw new Error(`This calendar uses an unsupported repeat pattern: ${frequency || 'unknown'}.`);
  const interval = Math.max(1, Math.min(52, Number(rule.INTERVAL) || 1));
  const count = Math.max(1, Math.min(400, Number(rule.COUNT) || 400));
  const until = rule.UNTIL ? parseICSDate({ rawValue: rule.UNTIL, parameters: {} }) : null;
  const weekdays = new Set((rule.BYDAY || '').split(',').map(day => day.slice(-2)).filter(Boolean));
  const weekdayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const mondayWeek = value => Math.floor((parseLocalDate(value).getTime() / 86400000 + 3) / 7);
  const startWeek = mondayWeek(start.date);
  let generatedCount = 1;
  for (let offset = 1; offset <= 370 && generatedCount < count; offset++) {
    const occurrence = shiftICSDate(start, offset);
    let matches = false;
    if (frequency === 'DAILY') matches = offset % interval === 0;
    else {
      const dayCode = weekdayCodes[parseLocalDate(occurrence.date).getDay()];
      matches = (mondayWeek(occurrence.date) - startWeek) % interval === 0 && (weekdays.size ? weekdays.has(dayCode) : dayCode === weekdayCodes[parseLocalDate(start.date).getDay()]);
    }
    if (!matches) continue;
    if (until && (occurrence.date > until.date || (!until.dateOnly && occurrence.date === until.date && occurrence.time > until.time))) break;
    generatedCount++;
    if (included(occurrence)) instances.push(occurrence);
  }
  return instances;
}
function classifyCalendarEvent(summary, description, start, hasEnd) {
  const text = `${summary} ${description}`.toLowerCase();
  if (/\b(final|midterm|exam)\b/.test(text)) return 'exam';
  if (/\b(quiz|test)\b/.test(text)) return 'test';
  if (/\b(assignment|homework|problem set|paper|project|due)\b/.test(text)) return 'assignment';
  return !start.dateOnly && hasEnd ? 'class' : 'assignment';
}
function parseICS(text) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '');
  if (!source.includes('BEGIN:VCALENDAR')) throw new Error('This file does not look like an iCalendar (.ics) file.');
  const components = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT' && current) { components.push(current); current = null; }
    else if (current) {
      const property = parseICSProperty(line);
      if (property) (current[property.name] ||= []).push(property);
    }
  }
  if (!components.length) throw new Error('No calendar events were found in this file.');
  if (components.length > 2000) throw new Error('This calendar has too many source events to import at once.');
  const imported = [];
  for (const component of components) {
    if (component.STATUS?.[0]?.value.toUpperCase() === 'CANCELLED') continue;
    const summary = component.SUMMARY?.[0]?.value.trim();
    if (!summary || !component.DTSTART?.[0]) continue;
    const start = parseICSDate(component.DTSTART[0]);
    const end = component.DTEND?.[0] ? parseICSDate(component.DTEND[0]) : null;
    const description = component.DESCRIPTION?.[0]?.value || '';
    const type = classifyCalendarEvent(summary, description, start, Boolean(end));
    const title = summary.replace(/^(assignment|quiz|test|exam|lecture|class):\s*/i, '').trim() || summary;
    const category = component['X-CANVAS-COURSE-NAME']?.[0]?.value || component['X-CANVAS-COURSE']?.[0]?.value || component.CATEGORIES?.[0]?.value.split(',')[0];
    const describedCourse = /(?:course|class)\s*:\s*([^\r\n]+)/i.exec(description)?.[1]?.trim();
    const codeCourse = /^([A-Z]{2,8}\s?\d{2,4})\s*[-:]\s*.+/.exec(summary)?.[1];
    const course = category || describedCourse || codeCourse || 'Canvas';
    const uid = component.UID?.[0]?.value || `${summary}-${start.date}-${start.time}`;
    const occurrences = recurrenceInstances(start, component.RRULE?.[0], component.EXDATE || []);
    for (const occurrence of occurrences) {
      const dayOffset = Math.round((parseLocalDate(occurrence.date) - parseLocalDate(start.date)) / 86400000);
      const occurrenceEnd = end ? shiftICSDate(end, dayOffset) : null;
      const startTime = type === 'class' ? occurrence.time : '';
      const endTime = type === 'class' ? (occurrenceEnd?.time || addMinutes(occurrence.time, 60)) : '';
      if (type === 'class' && endTime <= startTime) continue;
      imported.push({
        id: id(), title, course, type, date: occurrence.date, startTime, endTime,
        effortHours: type === 'exam' ? 5 : type === 'test' ? 3 : type === 'class' ? 0 : 2,
        calendarKey: `${uid}:${occurrence.date}:${occurrence.time}`
      });
    }
  }
  if (!imported.length) throw new Error('No usable, non-cancelled events were found in this calendar.');
  return imported;
}
function commitImportedEvents(imported, source) {
  const knownKeys = new Set(state.events.map(event => event.calendarKey).filter(Boolean));
  const additions = imported.filter(event => {
    if (!event.calendarKey) return true;
    if (knownKeys.has(event.calendarKey)) return false;
    knownKeys.add(event.calendarKey);
    return true;
  });
  if (!additions.length) {
    closeDialog('importDialog');
    showToast('Those calendar events are already on your timeline.');
    return;
  }
  state.events.push(...additions);
  closeDialog('importDialog');
  generatePlan();
  showToast(`Imported ${additions.length} ${additions.length === 1 ? 'event' : 'events'} from ${source}.`);
}
async function fetchCalendarFeed(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('Enter a valid Canvas calendar feed URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use the HTTPS Canvas feed link without embedded credentials.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.href, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Canvas returned ${response.status}. Check the feed link and try again.`);
    if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Calendar feed is larger than the 5 MB import limit.');
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error('Calendar feed is larger than the 5 MB import limit.');
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('The link did not return an iCalendar feed. Check that you copied the Canvas Calendar Feed URL.');
    commitImportedEvents(parseICS(text), 'Canvas feed');
    document.getElementById('feedUrl').value = '';
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The feed request timed out. Download the .ics file and import it instead.');
    if (error instanceof TypeError) throw new Error('The browser could not read this Canvas link because of cross-origin access rules. Download the .ics file and import it instead.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

for (const button of document.querySelectorAll('.nav-item[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
document.getElementById('previousWeek').addEventListener('click', () => { state.offset -= 7; render(); });
document.getElementById('nextWeek').addEventListener('click', () => { state.offset += 7; render(); });
document.getElementById('todayButton').addEventListener('click', () => { state.offset = 0; render(); });
document.getElementById('buildPlanButton').addEventListener('click', generatePlan);
document.querySelectorAll('.toggle-option').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll('.toggle-option').forEach(option => {
    const selected = option === button;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-selected', String(selected));
  });
  renderWeek();
}));
document.getElementById('addEventButton').addEventListener('click', () => {
  document.getElementById('eventForm').reset();
  document.getElementById('eventDate').value = dateAtOffset(1);
  document.getElementById('timeFields').hidden = true;
  document.getElementById('effortField').hidden = false;
  openDialog('eventDialog');
});
document.getElementById('emptyAddButton').addEventListener('click', () => document.getElementById('addEventButton').click());
document.getElementById('timelineAddButton').addEventListener('click', () => document.getElementById('addEventButton').click());
document.getElementById('eventType').addEventListener('change', event => {
  const isClass = event.target.value === 'class';
  document.getElementById('timeFields').hidden = !isClass;
  document.getElementById('effortField').hidden = isClass;
  document.getElementById('eventFormHint').textContent = isClass ? 'Class times are treated as fixed commitments when study sessions are placed.' : 'The study estimate helps spread preparation across the days before this deadline.';
});
document.getElementById('eventForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const type = form.get('type');
  const newEvent = { id: id(), title: String(form.get('title')).trim(), course: String(form.get('course')).trim(), type, date: String(form.get('date')), startTime: type === 'class' ? String(form.get('startTime')) : '', endTime: type === 'class' ? String(form.get('endTime')) : '', effortHours: type === 'class' ? 0 : Number(form.get('effortHours')) };
  if (type === 'class' && newEvent.endTime <= newEvent.startTime) { showToast('Class end time needs to be after its start time.'); return; }
  state.events.push(newEvent);
  closeDialog('eventDialog');
  generatePlan();
});
document.getElementById('availabilityButton').addEventListener('click', () => openDialog('availabilityDialog'));
document.getElementById('settingsButton').addEventListener('click', () => openDialog('settingsDialog'));
document.querySelectorAll('input[name="theme"]').forEach(input => input.addEventListener('change', event => {
  state.theme = event.target.value;
  applyTheme(state.theme);
  saveStorage();
}));
for (const [id, color] of [['themeBackground', 'background'], ['themeAccent', 'accent']]) {
  document.getElementById(id).addEventListener('input', event => {
    state.themeColors[color] = event.target.value;
    state.theme = 'custom';
    applyTheme(state.theme);
    saveStorage();
  });
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme(state.theme);
});
let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  document.getElementById('installAppButton').hidden = false;
});
document.getElementById('installAppButton').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.getElementById('installAppButton').hidden = true;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.getElementById('installAppButton').hidden = true;
});
document.getElementById('availabilityForm').addEventListener('submit', event => {
  event.preventDefault();
  state.availability = DAYS.map((_, index) => Number(new FormData(event.currentTarget).get(`day-${index}`)));
  closeDialog('availabilityDialog');
  generatePlan();
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
document.getElementById('timelineRows').addEventListener('click', event => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  state.events = state.events.filter(item => item.id !== button.dataset.delete);
  generatePlan();
});
function openImportDialog() {
  document.getElementById('calendarFile').value = '';
  openDialog('importDialog');
}
document.getElementById('importButton').addEventListener('click', openImportDialog);
document.getElementById('timelineImportButton').addEventListener('click', openImportDialog);
document.getElementById('calendarFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Calendar file is larger than the 5 MB import limit.');
    const text = await file.text();
    if (text.includes('BEGIN:VCALENDAR') || /\.(ics|ical)$/i.test(file.name)) commitImportedEvents(parseICS(text), 'calendar file');
    else importCSV(text);
  } catch (error) {
    showToast(error.message || 'Could not read that calendar file.');
  }
  event.target.value = '';
});
document.getElementById('feedForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Reading…';
  try { await fetchCalendarFeed(document.getElementById('feedUrl').value.trim()); }
  catch (error) { showToast(error.message || 'Could not read the Canvas feed.'); }
  finally { button.disabled = false; button.textContent = 'Import link'; }
});
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
if (state.sessions.length === 0 && state.events.some(event => event.type !== 'class')) generatePlan();
else render();
