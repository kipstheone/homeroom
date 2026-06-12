"use strict";
/* ============================================================
   ODO — app logic
   ============================================================ */
const APP_VERSION = "v7";

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayStr() { return fmtDate(new Date()); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function dayDiff(from, to) { return Math.round((parseDate(to) - parseDate(from)) / 864e5); }
function startOfWeek(s) { const d = parseDate(s); const shift = (d.getDay() + 6) % 7; d.setDate(d.getDate() - shift); return fmtDate(d); } // Monday start
function niceDate(s) { const d = parseDate(s); return DOW[d.getDay()] + ", " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
}
function relDay(s) {
  const dd = dayDiff(todayStr(), s);
  if (dd === 0) return "today";
  if (dd === 1) return "tomorrow";
  if (dd === -1) return "yesterday";
  if (dd < 0) return Math.abs(dd) + " days ago";
  if (dd < 7) return DOW_FULL[parseDate(s).getDay()];
  return niceDate(s);
}

/* ---------- constants ---------- */
const TYPES = ["Homework", "Quiz", "Test", "Project", "Paper", "Reading", "Lab", "Other"];
const STATUSES = ["Not started", "In progress", "Done"];
const COLORS = [
  "#e2654f", "#ec8c4e", "#d9a43c", "#9ab544",
  "#5fb36a", "#45b6a1", "#56a7da", "#6c8de0",
  "#9b82e2", "#b96fcd", "#e272b2", "#ed8092",
  "#b6543c", "#5f7d54", "#8a6a52", "#6e7480",
];
const COURSE_COLORS = COLORS;
const TAG_COLORS = COLORS;
const HL_COLORS = ["", "#e3edf7", "#fdeae6", "#fbf3d9", "#e7f2e3", "#f2ebf6", "#fbe8f0", "#efefec"];
const PALETTES = [
  { id: "hearth", name: "Hearth", swatch: "#b6543c" },
  { id: "meadow", name: "Meadow", swatch: "#5c7f52" },
  { id: "tide", name: "Tide", swatch: "#46708f" },
  { id: "dusk", name: "Dusk", swatch: "#7d5a78" },
  { id: "ember", name: "Ember", swatch: "#a87b24" },
];
const LOOKS = [
  { id: "paper", name: "Paper", desc: "white, modern-cozy, Notion-ish" },
  { id: "cozy", name: "Cozy", desc: "warm serif, library corners" },
  { id: "modern", name: "Modern", desc: "clean sans, crisp edges" },
  { id: "retro", name: "Retro", desc: "chunky print-shop borders" },
  { id: "bubbly", name: "Bubbly", desc: "round, soft, friendly" },
];
const EMPTY_LINES = [
  "Nothing here. Go touch grass.",
  "Blissfully empty.",
  "Not a thing. Enjoy it.",
  "All clear. Suspiciously clear.",
  "Empty. The dream.",
];
const emptyLine = seed => EMPTY_LINES[Math.abs(seed) % EMPTY_LINES.length];

/* ---------- state ---------- */
const DEFAULTS = {
  courses: [],       // {id,name,code,color,meetingTimes,room,instructor,email,officeHours,syllabusUrl,grading,description,textbooks,updatedAt,deleted}
  assignments: [],   // {id,title,courseId,type,status,due,time,notes,gcalId,updatedAt,deleted}
  tasks: [],         // {id,title,day:'YYYY-MM-DD'|'someday',done,order,updatedAt,deleted}
  routines: [],      // {id,title,time,days:[0-6],order,updatedAt,deleted}
  routineChecks: {}, // {'YYYY-MM-DD': {routineId:true, ...}}
  routineCheckMeta: {}, // {'YYYY-MM-DD': lastModifiedTs}
  tags: {},          // {tagName: colorHex}
  tagsMeta: {},      // {tagName: lastModifiedTs}
  __m2: true,        // look-migration flag
  links: [            // {id,title,url,color,updatedAt,deleted}
    { id: "lk-gmail", title: "Gmail", url: "https://mail.google.com", color: "#b6543c", updatedAt: 1, deleted: false },
    { id: "lk-canvas", title: "Canvas", url: "https://canvas.instructure.com", color: "#5f7d54", updatedAt: 1, deleted: false },
  ],
  settings: {
    theme: "auto", palette: "hearth", look: "paper", dashLayout: null, banner: "", userName: "",
    testLookahead: 14, weeksShown: 1,
    gcalClientId: "", gcalCalendarId: "",
    supaUrl: "", supaKey: "", syncId: "",
  },
};
let S = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem("homeroom_v1");
    if (raw) {
      const o = JSON.parse(raw);
      const st = {
        ...structuredClone(DEFAULTS), ...o,
        settings: { ...DEFAULTS.settings, ...(o.settings || {}) },
      };
      if (!o.__m2) { st.settings.look = "paper"; st.__m2 = true; } /* one-time: new default look */
      return st;
    }
  } catch (e) { console.warn("state load failed", e); }
  return structuredClone(DEFAULTS);
}
function persist() { localStorage.setItem("homeroom_v1", JSON.stringify(S)); }
function save() { persist(); scheduleCloudPush(); }
const alive = arr => arr.filter(x => !x.deleted);
const courseById = id => S.courses.find(c => c.id === id && !c.deleted);
const courseLabel = id => { const c = courseById(id); return c ? (c.code || c.name) : "No course"; };
const courseColor = id => { const c = courseById(id); return c ? c.color : "#9a8f7b"; };

/* runtime ui state (not persisted) */
const UI = {
  view: "home", dashTab: "tomorrow", boardOffset: 0,
  routineDate: todayStr(), calMonth: null, calMode: "month",
  asgCourse: "all", asgType: "all", asgHideDone: false,
  homeCal: null, linkEdit: false, arrange: false, weekMode: "list",
};

/* ---------- theme ---------- */
function applyTheme() {
  const pref = S.settings.theme;
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.palette = S.settings.palette || "hearth";
  document.documentElement.dataset.look = S.settings.look || "cozy";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

/* ---------- toast / modal / confirm ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function openModal(html) {
  $("#modal").innerHTML = html;
  $("#modal-veil").classList.add("open");
}
function closeModal() {
  $("#modal-veil").classList.remove("open");
  $("#modal").innerHTML = "";
}
$("#modal-veil").addEventListener("pointerdown", e => { if (e.target.id === "modal-veil") closeModal(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function confirmBox(title, body, yesLabel, onYes, danger) {
  openModal(`
    <h2>${esc(title)}</h2>
    <p style="color:var(--ink-soft)">${esc(body)}</p>
    <div class="modal-actions">
      <button class="btn ghost" id="cf-no">Cancel</button>
      <button class="btn ${danger ? "danger" : "primary"}" id="cf-yes">${esc(yesLabel)}</button>
    </div>`);
  $("#cf-no").onclick = closeModal;
  $("#cf-yes").onclick = () => { closeModal(); onYes(); };
}

/* ---------- navigation ---------- */
function nav(view) {
  UI.view = view;
  $$("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  /* mobile floating add button */
  const fabActions = {
    home: () => assignmentEditor(null),
    week: () => taskEditor(null),
    routine: () => routineEditor(null, parseDate(UI.routineDate).getDay()),
    calendar: () => assignmentEditor(null),
    courses: () => courseEditor(null),
  };
  const fab = $("#fab");
  if (fab) {
    fab.classList.toggle("hidden", !fabActions[view]);
    fab.onclick = fabActions[view] || null;
  }
  render();
  $("#main").scrollTop = 0;
}
$$("[data-nav]").forEach(b => b.addEventListener("click", () => nav(b.dataset.nav)));

function render() {
  ({ home: renderHome, week: renderWeek, routine: renderRoutine, calendar: renderCalendar, courses: renderCourses, settings: renderSettings })[UI.view]();
}

/* ---------- shared option builders ---------- */
const courseOptions = sel => `<option value="">No course</option>` +
  alive(S.courses).map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.code ? c.code + " — " + c.name : c.name)}</option>`).join("");
const typeOptions = sel => TYPES.map(t => `<option ${t === sel ? "selected" : ""}>${t}</option>`).join("");
const statusOptions = sel => STATUSES.map(t => `<option ${t === sel ? "selected" : ""}>${t}</option>`).join("");
const typeChipClass = t => ({ Test: "c-accent", Quiz: "c-gold", Project: "c-plum", Paper: "c-plum", Homework: "c-blue", Reading: "c-green", Lab: "c-green" }[t] || "c-faint");
const TYPE_GLYPHS = {
  Test: '<path d="M12 3 22 21 2 21Z"/>',
  Quiz: '<path d="M12 2 22 12 12 22 2 12Z"/>',
  Homework: '<circle cx="12" cy="12" r="9"/>',
  Project: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  Paper: '<path d="M5 2h10l4 4v16H5Z"/>',
  Reading: '<path d="M2 5c3.3-1.6 6.7-1.6 10 0c3.3-1.6 6.7-1.6 10 0v15c-3.3-1.6-6.7-1.6-10 0c-3.3-1.6-6.7-1.6-10 0Z"/>',
  Lab: '<path d="M9 2h6v3l5 13a2.5 2.5 0 0 1-2.4 3.5H6.4A2.5 2.5 0 0 1 4 18L9 5Z"/>',
  Other: '<circle cx="12" cy="12" r="5"/>',
};
const typeGlyph = (t, sz = 10) =>
  `<svg class="tg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor">${TYPE_GLYPHS[t] || TYPE_GLYPHS.Other}</svg>`;

/* ---------- tags ---------- */
function tagColor(name) {
  if (!S.tags[name]) {
    S.tags[name] = TAG_COLORS[Object.keys(S.tags).length % TAG_COLORS.length];
    S.tagsMeta[name] = Date.now();
    persist();
  }
  return S.tags[name];
}
function tagManager() {
  const names = Object.keys(S.tags).sort((a, b) => a.localeCompare(b));
  openModal(`
    <h2>Tags</h2>
    <p class="hint" style="margin:-8px 0 14px">Pick any color to repaint a tag everywhere. The × removes it from every to-do.</p>
    ${names.length ? names.map((n, i) => `
      <div class="field">
        <label style="text-transform:none;letter-spacing:0;display:flex;align-items:center;justify-content:space-between;gap:8px">${tagChip(n)}
          <button class="iconbtn" data-tagdel="${esc(n)}" aria-label="delete tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </label>
        ${colorPickRow("tagc-" + i, S.tags[n])}
      </div>`).join("") : `<div class="empty">No tags yet — type some while adding a to-do.</div>`}
    <div class="modal-actions"><button class="btn primary" id="tg-done">Done</button></div>`);
  names.forEach((n, i) => wireColorPick("tagc-" + i, c => {
    if (!c) return; /* tags always need a color */
    S.tags[n] = c;
    S.tagsMeta[n] = Date.now();
    save();
    tagManager();
  }));
  $$("#modal [data-tagdel]").forEach(b => b.onclick = () => {
    const name = b.dataset.tagdel;
    delete S.tags[name];
    delete S.tagsMeta[name];
    for (const t of S.tasks) {
      if (t.tags && t.tags.includes(name)) { t.tags = t.tags.filter(x => x !== name); t.updatedAt = Date.now(); }
    }
    save();
    tagManager();
  });
  $("#tg-done").onclick = () => { closeModal(); render(); };
}
function tagChip(name) {
  const c = tagColor(name);
  return `<span class="tagchip" style="background:color-mix(in srgb, ${c} 20%, var(--card));color:color-mix(in srgb, ${c} 62%, var(--ink))">${esc(name)}</span>`;
}
function parseTags(str) {
  return [...new Set(String(str || "").split(",").map(s => s.trim()).filter(Boolean))].slice(0, 8);
}
function daysLeftLabel(due) {
  const d = dayDiff(todayStr(), due);
  if (d < 0) return { txt: Math.abs(d) + " over", cls: "urgent" };
  if (d === 0) return { txt: "due today", cls: "urgent" };
  if (d === 1) return { txt: "1 day", cls: "soon" };
  if (d <= 3) return { txt: d + " days", cls: "soon" };
  return { txt: d + " days", cls: "" };
}

/* ============================================================
   ASSIGNMENTS (Main Tasks)
   ============================================================ */
function upsertAssignment(data, existing) {
  if (existing) Object.assign(existing, data, { updatedAt: Date.now() });
  else S.assignments.push({ id: uid(), gcalId: "", deleted: false, ...data, updatedAt: Date.now() });
  save();
  gcalQueuePush();
}
function assignmentEditor(a, presetDue) {
  const isNew = !a;
  a = a || { title: "", courseId: "", type: "Homework", status: "Not started", due: presetDue || todayStr(), time: "", notes: "" };
  openModal(`
    <h2>${isNew ? "New assignment" : "Edit assignment"}</h2>
    <div class="field"><label>Title</label><input id="ae-title" value="${esc(a.title)}" placeholder="e.g. Problem set 4" autocomplete="off"></div>
    <div class="fieldrow">
      <div class="field"><label>Course</label><select id="ae-course">${courseOptions(a.courseId)}</select></div>
      <div class="field"><label>Type</label><select id="ae-type">${typeOptions(a.type)}</select></div>
    </div>
    <div class="fieldrow">
      <div class="field"><label>Due date</label><input id="ae-due" type="date" value="${esc(a.due)}"></div>
      <div class="field"><label>Time <span style="text-transform:none;font-weight:400">(optional)</span></label><input id="ae-time" type="time" value="${esc(a.time || "")}"></div>
    </div>
    <div class="field"><label>Status</label><select id="ae-status">${statusOptions(a.status)}</select></div>
    <div class="field"><label>Notes</label><textarea id="ae-notes" placeholder="Anything worth remembering…">${esc(a.notes || "")}</textarea></div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn ghost danger" id="ae-del">Delete</button>`}
      <span class="spacer"></span>
      <button class="btn ghost" id="ae-cancel">Cancel</button>
      <button class="btn primary" id="ae-save">${isNew ? "Add it" : "Save"}</button>
    </div>`);
  $("#ae-cancel").onclick = closeModal;
  if (!isNew) $("#ae-del").onclick = () => confirmBox("Delete assignment?", `"${a.title}" will be removed here and from Google Calendar.`, "Delete", () => {
    a.deleted = true; a.updatedAt = Date.now(); save(); gcalQueuePush(); render(); toast("Deleted");
  }, true);
  $("#ae-save").onclick = () => {
    const title = $("#ae-title").value.trim();
    if (!title) { toast("Give it a title first"); return; }
    if (!$("#ae-due").value) { toast("Pick a due date"); return; }
    upsertAssignment({
      title, courseId: $("#ae-course").value, type: $("#ae-type").value,
      status: $("#ae-status").value, due: $("#ae-due").value,
      time: $("#ae-time").value, notes: $("#ae-notes").value.trim(),
    }, isNew ? null : a);
    closeModal(); render(); toast(isNew ? "Assignment added" : "Saved");
  };
  $("#ae-title").focus();
}
function assignmentDetail(a) {
  const c = courseById(a.courseId);
  const over = a.status !== "Done" && dayDiff(todayStr(), a.due) < 0;
  openModal(`
    <h2 style="align-items:flex-start"><span>${esc(a.title)}</span></h2>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin:-6px 0 14px">
      <span class="chip ${typeChipClass(a.type)}">${typeGlyph(a.type, 9)}${esc(a.type)}</span>
      ${c ? `<span class="chip" style="background:${c.color}22;color:${c.color}">${esc(c.code || c.name)}</span>` : ""}
      <span class="chip ${a.status === "Done" ? "c-green" : "c-faint"}">${esc(a.status)}</span>
      ${over ? `<span class="chip" style="background:var(--accent-soft);color:var(--danger)">overdue</span>` : ""}
    </div>
    <div class="course-detail-grid" style="margin-bottom:6px">
      <div class="cdrow"><span class="k">Due</span><span class="v">${niceDate(a.due)} (${relDay(a.due)})${a.time ? " · " + fmtTime12(a.time) : ""}</span></div>
      <div class="cdrow"><span class="k">Course</span><span class="v">${c ? esc(c.name) : "—"}</span></div>
      ${a.notes ? `<div class="cdrow wide"><span class="k">Notes</span><span class="v">${esc(a.notes)}</span></div>` : ""}
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="ad-edit">Edit</button>
      <span class="spacer"></span>
      <button class="btn ghost" id="ad-close">Close</button>
      ${a.status !== "Done" ? `<button class="btn primary" id="ad-done">Mark done</button>` : `<button class="btn" id="ad-undone">Mark not done</button>`}
    </div>`);
  $("#ad-close").onclick = closeModal;
  $("#ad-edit").onclick = () => assignmentEditor(a);
  const flip = (status, msg) => { a.status = status; a.updatedAt = Date.now(); save(); gcalQueuePush(); render(); toast(msg); };
  if (a.status !== "Done") $("#ad-done").onclick = () =>
    confirmBox("Finish this one?", `Mark "${a.title}" as done — are you sure?`, "Yes, done", () => flip("Done", "Nice work."));
  else $("#ad-undone").onclick = () => { closeModal(); flip("In progress", "Back on the list"); };
}
const dueAssignments = () => alive(S.assignments).sort((x, y) => x.due.localeCompare(y.due) || (x.time || "99").localeCompare(y.time || "99"));

/* ============================================================
   DASHBOARD
   ============================================================ */
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const lines = [
    "one thing at a time.", "the syllabus fears you.", "coffee counts as a plan.",
    "small steps, big semester.", "future you says thanks.", "you've survived worse weeks.",
  ];
  return { part, line: lines[parseDate(todayStr()).getDate() % lines.length] };
}
function dueRowHtml(a) {
  const over = a.status !== "Done" && dayDiff(todayStr(), a.due) < 0;
  return `<div class="duerow ${a.status === "Done" ? "done" : ""}" data-asg="${a.id}">
    <span class="bar" style="background:${courseColor(a.courseId)}"></span>
    <span class="t">${esc(a.title)}</span>
    <span class="chip ${typeChipClass(a.type)}">${typeGlyph(a.type, 9)}${esc(a.type)}</span>
    <span class="when" ${over ? 'style="color:var(--danger)"' : ""}>${relDay(a.due)}${a.time ? " " + fmtTime12(a.time) : ""}</span>
  </div>`;
}
function dashCalHtml() {
  if (!UI.homeCal) { const d = new Date(); UI.homeCal = [d.getFullYear(), d.getMonth()]; }
  const [y, m] = UI.homeCal;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; /* Monday start */
  const dim = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((lead + dim) / 7);
  const byDay = {};
  for (const a of dueAssignments()) (byDay[a.due] = byDay[a.due] || []).push(a);
  const today = todayStr();
  let cells = "";
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(y, m, i - lead + 1);
    const ds = fmtDate(d);
    const inM = d.getMonth() === m;
    const evs = byDay[ds] || [];
    cells += `<div class="calcell ${inM ? "" : "dim"} ${ds === today ? "today" : ""}" data-mday="${ds}">
      <span class="dnum">${d.getDate()}</span>
      ${evs.slice(0, 2).map(a => `<span class="calev ${a.status === "Done" ? "struck" : ""}" style="background:${courseColor(a.courseId)}">${typeGlyph(a.type, 9)}${esc(a.title)}</span>`).join("")}
      ${evs.length > 2 ? `<span class="calmore">+${evs.length - 2} more</span>` : ""}
      <span class="dotbar">${evs.slice(0, 6).map(a => `<span class="evdot" style="background:${courseColor(a.courseId)};${a.status === "Done" ? "opacity:.35" : ""}"></span>`).join("")}</span>
    </div>`;
  }
  return `
    <div class="mc-head">
      <span class="mc-title">${MONTHS[m]} ${y}</span>
      <span style="display:flex;gap:5px">
        <button class="btn small" id="mc-prev" aria-label="previous month">‹</button>
        <button class="btn small ghost" id="mc-today">Today</button>
        <button class="btn small" id="mc-next" aria-label="next month">›</button>
      </span>
    </div>
    <div class="calgrid dashcal">
      ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<span class="dow">${d}</span>`).join("")}
      ${cells}
    </div>`;
}
const DASH_PANELS = ["links", "calendar", "coming", "courses", "routine", "weektasks"];
const DASH_DEFAULT = {
  links: { area: "top", ord: 0 }, calendar: { area: "top", ord: 1 },
  coming: { area: "left", ord: 0 }, courses: { area: "left", ord: 1 },
  routine: { area: "right", ord: 0 }, weektasks: { area: "right", ord: 1 },
};
function dashLayout() {
  const saved = S.settings.dashLayout || {};
  const out = {};
  for (const id of DASH_PANELS) out[id] = { ...DASH_DEFAULT[id], ...(saved[id] || {}) };
  return out;
}
function arrBar(area) {
  return `<div class="arrbar">
    <button data-arr="up" title="move up">↑</button>
    <button data-arr="down" title="move down">↓</button>
    <span class="arrsep"></span>
    <button data-arr="left" class="${area === "left" ? "on" : ""}" title="left column">L</button>
    <button data-arr="top" class="${area === "top" ? "on" : ""}" title="full width">W</button>
    <button data-arr="right" class="${area === "right" ? "on" : ""}" title="right column">R</button>
    <span class="arrsep"></span>
    <button data-arr="hl" title="header color">Color</button>
  </div>`;
}
function renderHome() {
  const g = greeting();
  const today = todayStr();
  const open = dueAssignments().filter(a => a.status !== "Done");
  const lookahead = S.settings.testLookahead || 14;
  const tabs = {
    tomorrow: open.filter(a => dayDiff(today, a.due) <= 1),
    week: open.filter(a => dayDiff(today, a.due) >= 0 && dayDiff(today, a.due) <= 7),
    tests: open.filter(a => (a.type === "Test" || a.type === "Quiz") && dayDiff(today, a.due) >= 0 && dayDiff(today, a.due) <= lookahead),
  };
  const list = tabs[UI.dashTab] || tabs.tomorrow;
  const tkey = t => t.day === "someday" ? "9999-99-99" : t.day;
  const myTasks = alive(S.tasks).filter(t => !t.done)
    .sort((a, b) => tkey(a).localeCompare(tkey(b)) || a.order - b.order).slice(0, 7);
  const dow = parseDate(today).getDay();
  const daily = dailyItems(dow);
  const hasDaily = daily.anytime.length || daily.timed.length;
  const courses = alive(S.courses);
  const links = alive(S.links);
  const lay = dashLayout();

  const panels = {
    links: `
      <h2>Quick links <button class="seemore" id="ql-edit">${UI.linkEdit ? "done editing" : "edit"}</button></h2>
      <div class="linkgrid">
        ${links.map(l => UI.linkEdit
          ? `<button class="linkchip editing" data-lkedit="${l.id}"><span class="lk-dot" style="background:${esc(l.color)}"></span>${esc(l.title)}</button>`
          : `<a class="linkchip" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="lk-dot" style="background:${esc(l.color)}"></span>${esc(l.title)}</a>`
        ).join("")}
        ${(UI.linkEdit || !links.length) ? `<button class="linkchip add" id="ql-add">+ add link</button>` : ""}
      </div>`,
    calendar: dashCalHtml(),
    coming: `
      <h2>Coming up</h2>
      <div class="dash-tabs">
        <button data-dtab="tomorrow" class="${UI.dashTab === "tomorrow" ? "active" : ""}">Due by tomorrow</button>
        <button data-dtab="week" class="${UI.dashTab === "week" ? "active" : ""}">Next 7 days</button>
        <button data-dtab="tests" class="${UI.dashTab === "tests" ? "active" : ""}">Tests · ${lookahead}d</button>
      </div>
      <div class="duelist">
        ${list.length ? list.map(dueRowHtml).join("") : `<div class="empty">${emptyLine(1 + parseDate(today).getDate())}</div>`}
      </div>`,
    courses: `
      <h2>Courses <button class="seemore" data-go="courses">manage</button></h2>
      ${courses.length ? `<div class="coursegrid">${courses.map(c => courseCardHtml(c)).join("")}</div>`
        : `<div class="empty">No courses yet — add them in the Courses tab.</div>`}`,
    routine: `
      <h2>Today <button class="seemore" data-go="routine">open</button></h2>
      ${hasDaily ? schedHtml(today, "data-hrck", true)
        : `<div class="empty">No routine set for ${DOW_FULL[dow]}s.</div>`}`,
    weektasks: `
      <h2>To-dos <button class="seemore" data-go="week">all</button></h2>
      ${myTasks.length ? `<div>${myTasks.map(t => {
        const dl = (t.day !== "someday") ? daysLeftLabel(t.day) : null;
        return `<div class="mini-todo ${t.done ? "done" : ""}">
          <span class="ck ${t.done ? "on" : ""}" data-tck="${t.id}" style="width:18px;height:18px"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
          <span class="tt" data-tedit="${t.id}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</span>${(t.tags || []).slice(0, 2).map(tagChip).join("")}</span>
          <span style="font-size:12px;color:var(--ink-soft);font-weight:600;white-space:nowrap">${t.day === "someday" ? "someday" : relDay(t.day)}</span>
          <span class="left-d ${dl ? dl.cls : ""}" style="font-size:11px;font-weight:800;min-width:54px;text-align:right">${dl ? dl.txt : ""}</span>
        </div>`;
      }).join("")}</div>`
        : `<div class="empty">${emptyLine(2 + parseDate(today).getDate())}</div>`}`,
  };
  const wrap = id => `<div class="card panel dashpanel ${UI.arrange ? "arranging" : ""} ${lay[id].hl ? "hl-on" : ""}" data-panel="${id}"${lay[id].hl ? ` style="--hl:${lay[id].hl}"` : ""}>
    ${UI.arrange ? arrBar(lay[id].area) : ""}${panels[id]}</div>`;
  const inArea = a => DASH_PANELS.filter(id => lay[id].area === a).sort((x, y) => lay[x].ord - lay[y].ord);

  $("#view-home").innerHTML = `
    ${S.settings.banner ? `<img class="banner" src="${S.settings.banner}" alt="">` : ""}
    <div class="viewhead">
      <div>
        <h1>${g.part}${S.settings.userName ? ", " + esc(S.settings.userName) : ""}.</h1>
        <svg class="squiggle" width="150" height="8" viewBox="0 0 150 8"><path d="M2 5 Q 14 1 26 5 T 50 5 T 74 5 T 98 5 T 122 5 T 146 5"/></svg>
        <div class="greeting">${niceDate(today)} — ${g.line}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" id="h-arrange">${UI.arrange ? "Done arranging" : "Arrange"}</button>
        <button class="btn primary" id="h-add">+ Assignment</button>
      </div>
    </div>
    <div class="dash-top">${inArea("top").map(wrap).join("")}</div>
    <div class="dash-grid">
      <div class="dash-col">${inArea("left").map(wrap).join("")}</div>
      <div class="dash-col">${inArea("right").map(wrap).join("")}</div>
    </div>`;

  $("#h-add").onclick = () => assignmentEditor(null);
  $("#h-arrange").onclick = () => { UI.arrange = !UI.arrange; renderHome(); };
  $$("#view-home [data-arr]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = b.closest("[data-panel]").dataset.panel;
    const cur = dashLayout();
    const act = b.dataset.arr;
    if (act === "hl") {
      const cycle = HL_COLORS;
      cur[id].hl = cycle[(cycle.indexOf(cur[id].hl || "") + 1) % cycle.length];
    } else if (act === "up" || act === "down") {
      const peers = DASH_PANELS.filter(p => cur[p].area === cur[id].area).sort((x, y) => cur[x].ord - cur[y].ord);
      const i = peers.indexOf(id);
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= peers.length) return;
      [peers[i], peers[j]] = [peers[j], peers[i]];
      peers.forEach((p, k) => cur[p].ord = k);
    } else {
      if (cur[id].area === act) return;
      cur[id].area = act;
      cur[id].ord = 99;
      for (const a of ["top", "left", "right"]) {
        DASH_PANELS.filter(p => cur[p].area === a).sort((x, y) => cur[x].ord - cur[y].ord).forEach((p, k) => cur[p].ord = k);
      }
    }
    S.settings.dashLayout = cur;
    persist();
    renderHome();
  });
  $$("#view-home [data-dtab]").forEach(b => b.onclick = () => { UI.dashTab = b.dataset.dtab; renderHome(); });
  $$("#view-home [data-go]").forEach(b => b.onclick = e => { e.stopPropagation(); nav(b.dataset.go); });
  $$("#view-home [data-asg]").forEach(r => r.onclick = () => { const a = S.assignments.find(x => x.id === r.dataset.asg); if (a) assignmentDetail(a); });
  $$("#view-home [data-course]").forEach(r => r.onclick = () => { const c = courseById(r.dataset.course); if (c) courseDetail(c); });
  /* dashboard calendar */
  $("#mc-prev").onclick = () => { const [yy, mm] = UI.homeCal; UI.homeCal = mm === 0 ? [yy - 1, 11] : [yy, mm - 1]; renderHome(); };
  $("#mc-next").onclick = () => { const [yy, mm] = UI.homeCal; UI.homeCal = mm === 11 ? [yy + 1, 0] : [yy, mm + 1]; renderHome(); };
  $("#mc-today").onclick = () => { const d = new Date(); UI.homeCal = [d.getFullYear(), d.getMonth()]; renderHome(); };
  $$("#view-home [data-mday]").forEach(b => b.onclick = () => dayModal(b.dataset.mday));
  /* quick links */
  $("#ql-edit").onclick = () => { UI.linkEdit = !UI.linkEdit; renderHome(); };
  const addBtn = $("#ql-add");
  if (addBtn) addBtn.onclick = () => linkEditor(null);
  $$("#view-home [data-lkedit]").forEach(b => b.onclick = () => {
    const l = S.links.find(x => x.id === b.dataset.lkedit);
    if (l) linkEditor(l);
  });
  /* routine check-off from home (checkbox or whole row) */
  $$("#view-home [data-hrck]").forEach(ck => ck.onclick = e => {
    e.stopPropagation();
    toggleRoutCheck(today, ck.dataset.hrck);
    renderHome();
  });
  $$("#view-home [data-sched]").forEach(row => row.onclick = () => {
    toggleRoutCheck(today, row.dataset.sched);
    renderHome();
  });
  /* to-dos on home */
  $$("#view-home [data-tck]").forEach(ck => ck.onclick = e => { e.stopPropagation(); toggleTaskDone(ck.dataset.tck); });
  $$("#view-home [data-tedit]").forEach(el => el.onclick = () => {
    const t = S.tasks.find(x => x.id === el.dataset.tedit);
    if (t) taskEditor(t);
  });
}
function linkEditor(l) {
  const isNew = !l;
  l = l || { title: "", url: "", color: TAG_COLORS[alive(S.links).length % TAG_COLORS.length] };
  let picked = l.color;
  openModal(`
    <h2>${isNew ? "New link" : "Edit link"}</h2>
    <div class="field"><label>Name</label><input id="lk-title" value="${esc(l.title)}" placeholder="e.g. Canvas, Gmail, Library"></div>
    <div class="field"><label>URL</label><input id="lk-url" value="${esc(l.url)}" placeholder="https://…" inputmode="url" autocomplete="off"></div>
    <div class="field"><label>Color</label><div class="colorpick" id="lk-colors">
      ${TAG_COLORS.map(col => `<button data-col="${col}" class="${col === l.color ? "sel" : ""}" style="background:${col}" aria-label="color"></button>`).join("")}
    </div></div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn ghost danger" id="lk-del">Delete</button>`}
      <span class="spacer"></span>
      <button class="btn ghost" id="lk-cancel">Cancel</button>
      <button class="btn primary" id="lk-save">${isNew ? "Add link" : "Save"}</button>
    </div>`);
  $$("#lk-colors button").forEach(b => b.onclick = () => {
    picked = b.dataset.col;
    $$("#lk-colors button").forEach(x => x.classList.toggle("sel", x === b));
  });
  $("#lk-cancel").onclick = closeModal;
  if (!isNew) $("#lk-del").onclick = () => {
    l.deleted = true; l.updatedAt = Date.now();
    save(); closeModal(); renderHome(); toast("Link removed");
  };
  $("#lk-save").onclick = () => {
    const title = $("#lk-title").value.trim();
    let url = $("#lk-url").value.trim();
    if (!title || !url) { toast("Name and URL, please"); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (isNew) S.links.push({ id: uid(), title, url, color: picked, deleted: false, updatedAt: Date.now() });
    else Object.assign(l, { title, url, color: picked, updatedAt: Date.now() });
    save(); closeModal(); renderHome(); toast(isNew ? "Link added" : "Saved");
  };
  $("#lk-title").focus();
}

/* ============================================================
   COURSES
   ============================================================ */
function courseCardHtml(c) {
  return `<div class="card coursecard" data-course="${c.id}">
    <span class="swatch" style="background:${c.color}"></span>
    <div class="code">${esc(c.code || "")}</div>
    <h3>${esc(c.name)}</h3>
    <div class="meta">
      ${c.meetingTimes ? `<span>${esc(c.meetingTimes)}</span>` : ""}
      ${c.room ? `<span>${esc(c.room)}</span>` : ""}
      ${c.instructor ? `<span>${esc(c.instructor)}</span>` : ""}
    </div>
  </div>`;
}
function renderCourses() {
  const courses = alive(S.courses);
  $("#view-courses").innerHTML = `
    <div class="viewhead">
      <div><h1>Courses</h1><div class="sub">Everything you need to know, one click deep.</div></div>
      <button class="btn primary" id="c-add">+ Course</button>
    </div>
    ${courses.length ? `<div class="coursegrid">${courses.map(courseCardHtml).join("")}</div>`
      : `<div class="empty" style="padding:40px">A blank slate. Add your first course and watch this place come alive.</div>`}`;
  $("#c-add").onclick = () => courseEditor(null);
  $$("#view-courses [data-course]").forEach(r => r.onclick = () => { const c = courseById(r.dataset.course); if (c) courseDetail(c); });
}
function courseDetail(c) {
  const fields = [
    ["Meeting times", c.meetingTimes], ["Room", c.room],
    ["Instructor", c.instructor], ["Contact", c.email],
    ["Office hours", c.officeHours], ["Course code", c.code],
  ];
  const wide = [["Grading scheme", c.grading], ["Textbooks", c.textbooks], ["Description", c.description]];
  const openCount = alive(S.assignments).filter(a => a.courseId === c.id && a.status !== "Done").length;
  openModal(`
    <h2><span style="display:flex;align-items:center;gap:9px"><span style="width:13px;height:13px;border-radius:4px;background:${c.color};flex-shrink:0"></span>${esc(c.name)}</span></h2>
    <div style="margin:-8px 0 14px;color:var(--ink-soft);font-size:13.5px">${esc(c.code || "")}${openCount ? ` · ${openCount} open assignment${openCount > 1 ? "s" : ""}` : ""}</div>
    <div class="course-detail-grid">
      ${fields.filter(f => f[1]).map(f => `<div class="cdrow"><span class="k">${f[0]}</span><span class="v">${esc(f[1])}</span></div>`).join("")}
      ${c.syllabusUrl ? `<div class="cdrow"><span class="k">Syllabus</span><span class="v"><a href="${esc(c.syllabusUrl)}" target="_blank" rel="noopener">open link</a></span></div>` : ""}
      ${wide.filter(f => f[1]).map(f => `<div class="cdrow wide"><span class="k">${f[0]}</span><span class="v">${esc(f[1])}</span></div>`).join("")}
      ${(c.custom || []).filter(x => x.k || x.v).map(x => `<div class="cdrow wide"><span class="k">${esc(x.k || "Info")}</span><span class="v">${esc(x.v)}</span></div>`).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn ghost danger" id="cd-del">Delete</button>
      <span class="spacer"></span>
      <button class="btn ghost" id="cd-close">Close</button>
      <button class="btn primary" id="cd-edit">Edit</button>
    </div>`);
  $("#cd-close").onclick = closeModal;
  $("#cd-edit").onclick = () => courseEditor(c);
  $("#cd-del").onclick = () => confirmBox("Delete course?", `"${c.name}" will be removed. Its assignments stay, just uncategorized.`, "Delete", () => {
    c.deleted = true; c.updatedAt = Date.now(); save(); render(); toast("Course removed");
  }, true);
}
const DAY_LETTERS = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
function meetingsLabel(meetings) {
  return (meetings || []).filter(m => m.days.length && m.start)
    .map(m => [...m.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DAY_LETTERS[d]).join("") + " " + fmtTime12(m.start) + (m.end ? "–" + fmtTime12(m.end) : ""))
    .join(" · ");
}
function customRowHtml(k, v) {
  return `<div class="fieldrow customrow">
    <div class="field"><label>Box name</label><input class="cf-k" value="${esc(k)}" placeholder="e.g. TA contact"></div>
    <div class="field"><label>Info</label><input class="cf-v" value="${esc(v)}" placeholder="…"></div>
    <button class="iconbtn cf-x" type="button" aria-label="remove box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>`;
}
function courseEditor(c) {
  const isNew = !c;
  c = c || { name: "", code: "", color: COURSE_COLORS[alive(S.courses).length % COURSE_COLORS.length], meetingTimes: "", meetings: [], room: "", instructor: "", email: "", officeHours: "", syllabusUrl: "", grading: "", description: "", textbooks: "", custom: [] };
  let pickedColor = c.color;
  let meets = (c.meetings || []).map(m => ({ days: [...(m.days || [])], start: m.start || "", end: m.end || "" }));
  openModal(`
    <h2>${isNew ? "New course" : "Edit course"}</h2>
    <div class="fieldrow">
      <div class="field" style="flex:2"><label>Course name</label><input id="ce-name" value="${esc(c.name)}" placeholder="e.g. Intro to Psychology"></div>
      <div class="field"><label>Code</label><input id="ce-code" value="${esc(c.code)}" placeholder="PSY 101"></div>
    </div>
    <div class="field"><label>Color</label><div class="colorpick" id="ce-colors">
      ${COURSE_COLORS.map(col => `<button data-col="${col}" class="${col === c.color ? "sel" : ""}" style="background:${col}" aria-label="color"></button>`).join("")}
    </div></div>
    <div class="field"><label>Meeting times</label>
      <div id="ce-meets"></div>
      <button class="btn small ghost" id="ce-addmeet" type="button">+ Add meeting time</button>
      <span class="hint">These drop straight into your Daily schedule as class blocks.</span>
    </div>
    <div class="field"><label>Room</label><input id="ce-room" value="${esc(c.room)}" placeholder="Hall 204"></div>
    <div class="fieldrow">
      <div class="field"><label>Instructor</label><input id="ce-inst" value="${esc(c.instructor)}" placeholder="Dr. …"></div>
      <div class="field"><label>Contact</label><input id="ce-email" value="${esc(c.email)}" placeholder="email / office"></div>
    </div>
    <div class="fieldrow">
      <div class="field"><label>Office hours</label><input id="ce-oh" value="${esc(c.officeHours)}" placeholder="Tu 2–4pm"></div>
      <div class="field"><label>Syllabus link</label><input id="ce-syl" value="${esc(c.syllabusUrl)}" placeholder="https://…"></div>
    </div>
    <div class="field"><label>Grading scheme</label><textarea id="ce-grade" placeholder="40% exams, 30% homework…">${esc(c.grading)}</textarea></div>
    <div class="field"><label>Textbooks</label><textarea id="ce-books">${esc(c.textbooks)}</textarea></div>
    <div class="field"><label>Description</label><textarea id="ce-desc">${esc(c.description)}</textarea></div>
    <div class="field"><label>Your own info boxes</label>
      <div id="ce-custom">${(c.custom || []).map(x => customRowHtml(x.k, x.v)).join("")}</div>
      <button class="btn small ghost" id="ce-addcustom" type="button">+ Add an info box</button>
      <span class="hint">Anything the form above forgot — TA contact, lab section, study group, club…</span>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="ce-cancel">Cancel</button>
      <button class="btn primary" id="ce-save">${isNew ? "Add course" : "Save"}</button>
    </div>`);
  const renderMeets = () => {
    $("#ce-meets").innerHTML = meets.map((m, i) => `
      <div class="meetrow">
        <div class="daypicker mini">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-mi="${i}" data-d="${d}" class="${m.days.includes(d) ? "on" : ""}">${DOW[d][0]}</button>`).join("")}</div>
        <input type="time" class="mr-t" data-mi="${i}" data-f="start" value="${esc(m.start)}">
        <span class="hint">–</span>
        <input type="time" class="mr-t" data-mi="${i}" data-f="end" value="${esc(m.end)}">
        <button class="iconbtn" type="button" data-mx="${i}" aria-label="remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>`).join("");
    $$("#ce-meets [data-d]").forEach(b => b.onclick = () => {
      const m = meets[+b.dataset.mi];
      const d = +b.dataset.d;
      m.days = m.days.includes(d) ? m.days.filter(x => x !== d) : [...m.days, d];
      renderMeets();
    });
    $$("#ce-meets .mr-t").forEach(inp => inp.onchange = () => { meets[+inp.dataset.mi][inp.dataset.f] = inp.value; });
    $$("#ce-meets [data-mx]").forEach(b => b.onclick = () => { meets.splice(+b.dataset.mx, 1); renderMeets(); });
  };
  renderMeets();
  $("#ce-addmeet").onclick = () => { meets.push({ days: [], start: "", end: "" }); renderMeets(); };
  const wireCustomRows = () => $$("#ce-custom .cf-x").forEach(b => b.onclick = () => b.closest(".customrow").remove());
  wireCustomRows();
  $("#ce-addcustom").onclick = () => {
    $("#ce-custom").insertAdjacentHTML("beforeend", customRowHtml("", ""));
    wireCustomRows();
    const rows = $$("#ce-custom .customrow");
    rows[rows.length - 1].querySelector(".cf-k").focus();
  };
  $$("#ce-colors button").forEach(b => b.onclick = () => {
    pickedColor = b.dataset.col;
    $$("#ce-colors button").forEach(x => x.classList.toggle("sel", x === b));
  });
  $("#ce-cancel").onclick = closeModal;
  $("#ce-save").onclick = () => {
    const name = $("#ce-name").value.trim();
    if (!name) { toast("The course needs a name"); return; }
    const meetings = meets.filter(m => m.days.length && m.start).map(m => ({ days: [...m.days], start: m.start, end: m.end || "" }));
    const data = {
      name, code: $("#ce-code").value.trim(), color: pickedColor,
      meetings, meetingTimes: meetingsLabel(meetings), room: $("#ce-room").value.trim(),
      instructor: $("#ce-inst").value.trim(), email: $("#ce-email").value.trim(),
      officeHours: $("#ce-oh").value.trim(), syllabusUrl: $("#ce-syl").value.trim(),
      grading: $("#ce-grade").value.trim(), textbooks: $("#ce-books").value.trim(),
      description: $("#ce-desc").value.trim(),
      custom: $$("#ce-custom .customrow").map(row => ({
        k: row.querySelector(".cf-k").value.trim(),
        v: row.querySelector(".cf-v").value.trim(),
      })).filter(x => x.k || x.v),
    };
    if (isNew) S.courses.push({ id: uid(), deleted: false, ...data, updatedAt: Date.now() });
    else Object.assign(c, data, { updatedAt: Date.now() });
    save(); closeModal(); render(); toast(isNew ? "Course added" : "Saved");
  };
  $("#ce-name").focus();
}

/* ============================================================
   WEEK BOARD (Tweek-style)
   ============================================================ */
function taskCardHtml(t) {
  const cstyle = t.color ? ` style="border-left:4px solid ${esc(t.color)};background:color-mix(in srgb, ${esc(t.color)} 11%, var(--card-2))"` : "";
  return `<div class="tk ${t.done ? "done" : ""}" data-id="${t.id}" data-kind="task"${cstyle}>
    <span class="ck ${t.done ? "on" : ""}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
    <span class="t">${esc(t.title)}</span>
  </div>`;
}
function mainCardHtml(a) {
  const done = a.status === "Done";
  return `<div class="tk main ${done ? "done" : ""}" data-id="${a.id}" data-kind="main">
    <span class="ck ${done ? "on" : ""}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
    <span class="t">${esc(a.title)}<span class="sub">${typeGlyph(a.type, 8)} ${esc(a.type.toUpperCase())}${a.courseId ? " · " + esc(courseLabel(a.courseId)) : ""}${a.time ? " · " + fmtTime12(a.time) : ""}</span></span>
  </div>`;
}
function dayColHtml(day) {
  const isToday = day === todayStr();
  const d = parseDate(day);
  const asg = dueAssignments().filter(a => a.due === day);
  const tasks = alive(S.tasks).filter(t => t.day === day).sort((a, b) => a.order - b.order);
  return `<div class="daycol ${isToday ? "today" : ""}" data-day="${day}">
    <div class="dayhead"><span class="dn">${isToday ? "Today" : DOW[d.getDay()]}</span><span class="dd">${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}</span></div>
    ${asg.map(mainCardHtml).join("")}
    ${tasks.map(taskCardHtml).join("")}
    <button class="addtask">+ add task</button>
  </div>`;
}
function renderWeek() { (UI.weekMode === "board" ? renderBoard : renderTodoList)(); }
function weekModeSeg() {
  return `<div class="seg" id="wm-seg">
    <button data-wm="list" class="${UI.weekMode !== "board" ? "active" : ""}">List</button>
    <button data-wm="board" class="${UI.weekMode === "board" ? "active" : ""}">Week board</button>
  </div>`;
}
function wireWeekSeg() {
  $$("#wm-seg button").forEach(b => b.onclick = () => { UI.weekMode = b.dataset.wm; renderWeek(); });
}
function todoRowHtml(t) {
  const dated = t.day !== "someday";
  const dl = (dated && !t.done) ? daysLeftLabel(t.day) : null;
  return `<div class="todo-row ${t.done ? "done" : ""}" data-tid="${t.id}">
    <span class="ck ${t.done ? "on" : ""}" data-tck="${t.id}" style="width:19px;height:19px"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
    <span class="tt">${esc(t.title)}${t.url ? ` <a class="lkico" href="${esc(t.url)}" target="_blank" rel="noopener" data-stop><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg></a>` : ""}${t.notes ? ` <span class="desc-dot">— ${esc(t.notes.length > 56 ? t.notes.slice(0, 56) + "…" : t.notes)}</span>` : ""}</span>
    <span class="tags">${(t.tags || []).map(tagChip).join("")}</span>
    <span class="due-d">${dated ? niceDate(t.day) : "someday"}</span>
    <span class="left-d ${dl ? dl.cls : ""}">${dl ? dl.txt : (t.done ? "done" : "—")}</span>
  </div>`;
}
function renderTodoList() {
  const ts = alive(S.tasks);
  const key = t => t.day === "someday" ? "9999-99-99" : t.day;
  const open = ts.filter(t => !t.done).sort((a, b) => key(a).localeCompare(key(b)) || a.order - b.order);
  const done = ts.filter(t => t.done).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 25);
  $("#view-week").innerHTML = `
    <div class="viewhead">
      <div><h1>To-dos</h1><div class="sub">Everything you owe yourself, in one list.</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${weekModeSeg()}
        <button class="btn small" id="td-tags">Tags</button>
        <button class="btn primary" id="td-add">+ To-do</button>
      </div>
    </div>
    <div class="card panel">
      <div class="todo-table">
        <div class="todo-head"><span></span><span>To-do</span><span style="text-align:right">Tags</span><span style="text-align:right">Due</span><span style="text-align:right">Days left</span></div>
        ${open.length ? open.map(todoRowHtml).join("") : `<div class="empty" style="margin:12px 4px">${emptyLine(4)}</div>`}
        <div class="todo-new" id="td-new"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> New to-do</div>
      </div>
    </div>
    ${done.length ? `
      <h2 style="font-size:15px;margin:20px 0 9px;color:var(--ink-faint)">Done</h2>
      <div class="card panel"><div class="todo-table">${done.map(todoRowHtml).join("")}</div></div>` : ""}`;
  wireWeekSeg();
  $("#td-tags").onclick = tagManager;
  $("#td-add").onclick = () => taskEditor(null);
  $("#td-new").onclick = () => taskEditor(null);
  $$("#view-week [data-tck]").forEach(ck => ck.onclick = e => { e.stopPropagation(); toggleTaskDone(ck.dataset.tck); });
  $$("#view-week [data-stop]").forEach(a => a.onclick = e => e.stopPropagation());
  $$("#view-week [data-tid]").forEach(r => r.onclick = () => {
    const t = S.tasks.find(x => x.id === r.dataset.tid);
    if (t) taskEditor(t);
  });
}
function renderBoard() {
  const start = addDays(startOfWeek(todayStr()), UI.boardOffset * 7);
  const span = S.settings.weeksShown || 1;
  const days = [];
  for (let i = 0; i < span * 7; i++) days.push(addDays(start, i));
  const last = days[days.length - 1];
  const someTasks = alive(S.tasks).filter(t => t.day === "someday").sort((a, b) => a.order - b.order);
  const rangeLabel = niceDate(start) + " – " + niceDate(last);
  $("#view-week").innerHTML = `
    <div class="viewhead">
      <div><h1>To-dos</h1><div class="sub">${rangeLabel}. Drag things where they belong.</div></div>
      <div class="weekswitch">
        ${weekModeSeg()}
        <button class="btn small" id="wk-prev" aria-label="previous">‹</button>
        <button class="btn small ghost" id="wk-today">Today</button>
        <button class="btn small" id="wk-next" aria-label="next">›</button>
        <select id="wk-span">
          ${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === span ? "selected" : ""}>${n} week${n > 1 ? "s" : ""}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="boardwrap"><div class="board" id="board">
      ${days.map(dayColHtml).join("")}
      <div class="daycol someday" data-day="someday">
        <div class="dayhead"><span class="dn">Someday</span><span class="dd">∞</span></div>
        ${someTasks.map(taskCardHtml).join("")}
        <button class="addtask">+ add task</button>
      </div>
    </div></div>`;
  $("#wk-prev").onclick = () => { UI.boardOffset -= 1; renderWeek(); };
  $("#wk-next").onclick = () => { UI.boardOffset += 1; renderWeek(); };
  $("#wk-today").onclick = () => { UI.boardOffset = 0; renderWeek(); };
  $("#wk-span").onchange = e => { S.settings.weeksShown = +e.target.value; save(); renderWeek(); };
  wireWeekSeg();
  $$("#board .addtask").forEach(btn => btn.onclick = () => inlineAddTask(btn));
  attachBoardEvents($("#board"));
}
function inlineAddTask(btn) {
  const col = btn.closest(".daycol");
  const input = document.createElement("input");
  input.className = "addinput";
  input.placeholder = "Type, then Enter";
  btn.replaceWith(input);
  input.focus();
  let settled = false; /* guard: Enter triggers both keydown and blur */
  const commit = () => {
    if (settled) return;
    settled = true;
    const title = input.value.trim();
    if (title) {
      const day = col.dataset.day;
      const peers = alive(S.tasks).filter(t => t.day === day);
      const order = peers.length ? Math.max(...peers.map(t => t.order)) + 1 : 1;
      S.tasks.push({ id: uid(), title, day, done: false, order, deleted: false, updatedAt: Date.now() });
      save();
    }
    renderWeek();
  };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { settled = true; renderWeek(); }
  });
  input.addEventListener("blur", commit);
}
function colorPickRow(id, current) {
  return `<div class="colorpick" id="${id}">
    <button data-col="" class="${!current ? "sel" : ""}" style="background:var(--bg-soft);border:2.5px dashed var(--line-strong)" aria-label="no color" title="no color"></button>
    ${TAG_COLORS.map(col => `<button data-col="${col}" class="${col === current ? "sel" : ""}" style="background:${col}" aria-label="color"></button>`).join("")}
  </div>`;
}
function wireColorPick(id, onPick) {
  $$("#" + id + " button").forEach(b => b.onclick = () => {
    onPick(b.dataset.col);
    $$("#" + id + " button").forEach(x => x.classList.toggle("sel", x === b));
  });
}
function taskEditor(t) {
  const isNew = !t;
  const base = t || { title: "", day: todayStr(), color: "", tags: [], notes: "", url: "" };
  let picked = base.color || "";
  const allTags = Object.keys(S.tags);
  openModal(`
    <h2>${isNew ? "New to-do" : "Edit to-do"}</h2>
    <div class="field"><label>To-do</label><input id="te-title" value="${esc(base.title)}" placeholder="e.g. Email advisor about overrides"></div>
    <div class="fieldrow">
      <div class="field"><label>Due / day</label><input id="te-day" type="date" value="${base.day === "someday" ? "" : esc(base.day)}"><span class="hint">Empty = Someday.</span></div>
      <div class="field"><label>Tags</label><input id="te-tags" value="${esc((base.tags || []).join(", "))}" placeholder="research, admin" list="te-taglist" autocomplete="off"><datalist id="te-taglist">${allTags.map(n => `<option value="${esc(n)}">`).join("")}</datalist><span class="hint">Comma-separated. New names become new tags.</span></div>
    </div>
    <div class="field"><label>Description</label><textarea id="te-notes" placeholder="optional details…">${esc(base.notes || "")}</textarea></div>
    <div class="field"><label>Link</label><input id="te-url" value="${esc(base.url || "")}" placeholder="https://… (optional)" inputmode="url" autocomplete="off"></div>
    <div class="field"><label>Color (week board)</label>${colorPickRow("te-colors", picked)}</div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn ghost danger" id="te-del">Delete</button>`}
      <span class="spacer"></span>
      <button class="btn ghost" id="te-cancel">Cancel</button>
      <button class="btn primary" id="te-save">${isNew ? "Add to-do" : "Save"}</button>
    </div>`);
  wireColorPick("te-colors", c => picked = c);
  $("#te-cancel").onclick = closeModal;
  if (!isNew) $("#te-del").onclick = () => { t.deleted = true; t.updatedAt = Date.now(); save(); closeModal(); render(); toast("Deleted"); };
  $("#te-save").onclick = () => {
    const title = $("#te-title").value.trim();
    if (!title) { toast("It needs words"); return; }
    let url = $("#te-url").value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const data = {
      title, day: $("#te-day").value || "someday", color: picked,
      tags: parseTags($("#te-tags").value), notes: $("#te-notes").value.trim(), url,
    };
    data.tags.forEach(tagColor); /* register colors for new tags */
    if (isNew) {
      const peers = alive(S.tasks).filter(x => x.day === data.day);
      const order = peers.length ? Math.max(...peers.map(x => x.order)) + 1 : 1;
      S.tasks.push({ id: uid(), done: false, order, deleted: false, ...data, updatedAt: Date.now() });
    } else {
      Object.assign(t, data, { updatedAt: Date.now() });
    }
    save(); closeModal(); render(); toast(isNew ? "To-do added" : "Saved");
  };
  $("#te-title").focus();
}
function toggleTaskDone(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done; t.updatedAt = Date.now();
  save(); render();
}
function attachBoardEvents(boardEl) {
  /* checkbox clicks (delegated) — pointer drag ignores .ck */
  boardEl.addEventListener("click", e => {
    const ck = e.target.closest(".ck");
    if (!ck) return;
    e.stopPropagation();
    const card = ck.closest(".tk");
    if (card.dataset.kind === "task") toggleTaskDone(card.dataset.id);
    else {
      const a = S.assignments.find(x => x.id === card.dataset.id);
      if (!a) return;
      if (a.status === "Done") { a.status = "In progress"; a.updatedAt = Date.now(); save(); gcalQueuePush(); render(); }
      else confirmBox("Finish this one?", `Mark "${a.title}" as done — are you sure?`, "Yes, done", () => {
        a.status = "Done"; a.updatedAt = Date.now(); save(); gcalQueuePush(); render(); toast("Nice work.");
      });
    }
  });

  /* unified mouse + touch drag */
  let drag = null;
  const cleanup = () => {
    if (!drag) return;
    drag.ghost?.remove();
    drag.card.classList.remove("dragging");
    $$(".daycol.dragover").forEach(c => c.classList.remove("dragover"));
    drag = null;
  };
  boardEl.addEventListener("pointerdown", e => {
    const card = e.target.closest(".tk");
    if (!card || e.target.closest(".ck")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = { card, id: card.dataset.id, kind: card.dataset.kind, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, pid: e.pointerId };
    try { card.setPointerCapture(e.pointerId); } catch (_) { }
  });
  boardEl.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 8) {
      /* on touch, a mostly-vertical gesture is a scroll — let the browser have it */
      if (e.pointerType !== "mouse" && Math.abs(e.clientY - drag.startY) > Math.abs(e.clientX - drag.startX) * 1.4) {
        drag = null;
        return;
      }
      drag.moved = true;
      const g = drag.card.cloneNode(true);
      g.classList.add("ghostfly");
      g.style.width = drag.card.offsetWidth + "px";
      document.body.appendChild(g);
      drag.ghost = g;
      drag.card.classList.add("dragging");
    }
    if (drag.moved) {
      e.preventDefault();
      drag.ghost.style.left = (e.clientX - drag.ghost.offsetWidth / 2) + "px";
      drag.ghost.style.top = (e.clientY - 24) + "px";
      const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".daycol");
      $$(".daycol").forEach(c => c.classList.toggle("dragover", c === col));
      const wrap = $(".boardwrap");
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        if (e.clientX > r.right - 44) wrap.scrollLeft += 13;
        else if (e.clientX < r.left + 44) wrap.scrollLeft -= 13;
      }
    }
  });
  const finish = e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    const moved = d.moved;
    cleanup();
    if (!moved) {  /* it was a tap */
      if (d.kind === "main") { const a = S.assignments.find(x => x.id === d.id); if (a) assignmentDetail(a); }
      else { const t = S.tasks.find(x => x.id === d.id); if (t) taskEditor(t); }
      return;
    }
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".daycol");
    if (!col) return;
    const day = col.dataset.day;
    if (d.kind === "main") {
      if (day === "someday") { toast("Assignments need a real due date"); renderWeek(); return; }
      const a = S.assignments.find(x => x.id === d.id);
      if (a && a.due !== day) {
        a.due = day; a.updatedAt = Date.now();
        save(); gcalQueuePush(); toast("Due " + relDay(day));
      }
      renderWeek();
    } else {
      const t = S.tasks.find(x => x.id === d.id);
      if (!t) return;
      const cardEls = [...col.querySelectorAll('.tk[data-kind="task"]')].filter(c => c.dataset.id !== d.id);
      let beforeId = null;
      for (const c of cardEls) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { beforeId = c.dataset.id; break; }
      }
      const peers = alive(S.tasks).filter(x => x.day === day && x.id !== t.id).sort((a, b) => a.order - b.order);
      let order;
      if (!peers.length) order = 1;
      else if (!beforeId) order = peers[peers.length - 1].order + 1;
      else {
        const idx = peers.findIndex(x => x.id === beforeId);
        const prevOrder = idx > 0 ? peers[idx - 1].order : peers[idx].order - 2;
        order = (prevOrder + peers[idx].order) / 2;
      }
      t.day = day; t.order = order; t.updatedAt = Date.now();
      save(); renderWeek();
    }
  };
  boardEl.addEventListener("pointerup", finish);
  boardEl.addEventListener("pointercancel", cleanup);
}

/* ============================================================
   DAILY (routines, classes, schedule)
   ============================================================ */
function dailyItems(dow) {
  const rs = alive(S.routines).filter(r => r.days.includes(dow));
  const timed = rs.filter(r => r.time).slice();
  /* course meeting times appear automatically as classes */
  for (const c of alive(S.courses)) {
    (c.meetings || []).forEach((m, i) => {
      if (m.days && m.days.includes(dow) && m.start) {
        timed.push({
          id: `crs-${c.id}-${i}`, title: c.code || c.name, kind: "class",
          time: m.start, endTime: m.end || "", color: c.color, courseId: c.id, isCourse: true, order: 0,
        });
      }
    });
  }
  timed.sort((a, b) => a.time.localeCompare(b.time) || (a.order || 0) - (b.order || 0));
  return { anytime: rs.filter(r => !r.time).sort((a, b) => a.order - b.order), timed };
}
function timeRange(r) {
  return r.time ? fmtTime12(r.time) + (r.endTime ? "–" + fmtTime12(r.endTime) : "") : "";
}
function schedItemHtml(r, checked, ckAttr) {
  if (r.kind === "class") {
    return `<div class="classblock ${checked ? "done" : ""}" data-sched="${r.id}" style="background:${esc(r.color || "var(--accent)")}">
      <span class="ck ${checked ? "on" : ""}" ${ckAttr}="${r.id}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
      <span class="cbt">${esc(r.title)}</span>
      ${r.time ? `<span class="range">${timeRange(r)}</span>` : ""}
    </div>`;
  }
  return `<div class="routline ${checked ? "done" : ""}" data-sched="${r.id}"${(r.color && !checked) ? ` style="background:color-mix(in srgb, ${esc(r.color)} 15%, transparent)"` : ""}>
    <span class="ck ${checked ? "on" : ""}" ${ckAttr}="${r.id}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
    <span class="rt">${esc(r.title)}</span>
    ${r.time ? `<span class="rtime">${timeRange(r)}</span>` : ""}
  </div>`;
}
function schedHtml(date, ckAttr, includeAnytime = true) {
  const dow = parseDate(date).getDay();
  const checks = S.routineChecks[date] || {};
  const { anytime, timed } = dailyItems(dow);
  if (!anytime.length && !timed.length) return "";
  let html = "";
  if (includeAnytime && anytime.length) {
    html += `<div class="sched-row"><span class="hr"></span><div class="si"><div class="sched-anytime">Anytime</div>${anytime.map(r => schedItemHtml(r, !!checks[r.id], ckAttr)).join("")}</div></div>`;
  }
  let lastHour = -1;
  for (const r of timed) {
    const h = +r.time.split(":")[0];
    const showHr = h !== lastHour;
    lastHour = h;
    html += `<div class="sched-row"><span class="hr">${showHr ? fmtTime12(String(h).padStart(2, "0") + ":00") : ""}</span><div class="si">${schedItemHtml(r, !!checks[r.id], ckAttr)}</div></div>`;
  }
  return `<div class="sched">${html}</div>`;
}
function toggleRoutCheck(date, id) {
  S.routineChecks[date] = S.routineChecks[date] || {};
  if (S.routineChecks[date][id]) delete S.routineChecks[date][id];
  else S.routineChecks[date][id] = true;
  S.routineCheckMeta[date] = Date.now();
  save();
}
function renderRoutine() {
  const date = UI.routineDate;
  const dow = parseDate(date).getDay();
  const checks = S.routineChecks[date] || {};
  const { anytime, timed } = dailyItems(dow);
  const asg = dueAssignments().filter(a => a.due === date);
  const dayTasks = alive(S.tasks).filter(t => t.day === date).sort((a, b) => a.order - b.order);
  const isToday = date === todayStr();
  $("#view-routine").innerHTML = `
    <div class="viewhead">
      <div><h1>Daily</h1><div class="sub">The shape of your day. Rearrange as life happens.</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="daynav">
          <button class="btn small" id="rt-prev" aria-label="previous day">‹</button>
          <span class="dlabel">${isToday ? "Today" : niceDate(date)}</span>
          <button class="btn small" id="rt-next" aria-label="next day">›</button>
          ${isToday ? "" : `<button class="btn small ghost" id="rt-today">Today</button>`}
        </div>
        <button class="btn primary small" id="rt-add">+ Routine</button>
      </div>
    </div>
    ${(!anytime.length && !timed.length) ? `<div class="empty">Nothing planned for ${DOW_FULL[dow]}s yet. Add routines and classes — your future self loves structure.</div>` : ""}
    ${anytime.length ? `
      <div class="sched-anytime" style="margin-bottom:6px">Anytime</div>
      <div class="routlist" id="rout-sortable" style="margin-bottom:18px">
        ${anytime.map(r => `
          <div class="routitem ${checks[r.id] ? "done" : ""}" data-rid="${r.id}"${(r.color && !checks[r.id]) ? ` style="background:color-mix(in srgb, ${esc(r.color)} 16%, var(--card));border-color:color-mix(in srgb, ${esc(r.color)} 42%, var(--line))"` : ""}>
            <span class="grab" aria-label="drag to reorder"><svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="9" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="4" cy="14" r="1.6"/><circle cx="10" cy="14" r="1.6"/></svg></span>
            <span class="ck ${checks[r.id] ? "on" : ""}" data-rck="${r.id}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
            <div class="body"><div class="t">${esc(r.title)}</div></div>
            <button class="iconbtn" data-redit="${r.id}" aria-label="edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>
          </div>`).join("")}
      </div>` : ""}
    ${timed.length ? `
      <div class="sched-anytime" style="margin-bottom:2px">Schedule</div>
      <div class="card panel" style="max-width:620px">${schedHtml(date, "data-rck", false)}</div>` : ""}
    ${(asg.length || dayTasks.length) ? `
      <h2 style="font-size:16px;margin:22px 0 10px;color:var(--ink-soft)">Also on this day</h2>
      <div class="routlist">
        ${asg.map(a => `
          <div class="routitem event mainasg ${a.status === "Done" ? "done" : ""}" data-asg="${a.id}">
            <span class="ck ${a.status === "Done" ? "on" : ""}" data-ack="${a.id}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
            <div class="body"><div class="t">${esc(a.title)}</div><div class="meta">${esc(a.type)}${a.courseId ? " · " + esc(courseLabel(a.courseId)) : ""}${a.time ? " · " + fmtTime12(a.time) : ""}</div></div>
          </div>`).join("")}
        ${dayTasks.map(t => `
          <div class="routitem event ${t.done ? "done" : ""}" data-task="${t.id}">
            <span class="ck ${t.done ? "on" : ""}" data-tck="${t.id}"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
            <div class="body"><div class="t">${esc(t.title)}</div><div class="meta">from the week board</div></div>
          </div>`).join("")}
      </div>` : ""}`;
  $("#rt-prev").onclick = () => { UI.routineDate = addDays(date, -1); renderRoutine(); };
  $("#rt-next").onclick = () => { UI.routineDate = addDays(date, 1); renderRoutine(); };
  if (!isToday) $("#rt-today").onclick = () => { UI.routineDate = todayStr(); renderRoutine(); };
  $("#rt-add").onclick = () => routineEditor(null, dow);
  $$("#view-routine [data-rck]").forEach(ck => ck.onclick = e => {
    e.stopPropagation();
    toggleRoutCheck(date, ck.dataset.rck);
    renderRoutine();
  });
  $$("#view-routine [data-redit]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const r = S.routines.find(x => x.id === b.dataset.redit);
    if (r) routineEditor(r, dow);
  });
  $$("#view-routine [data-sched]").forEach(row => row.onclick = e => {
    if (e.target.closest(".ck")) return;
    const id = row.dataset.sched;
    const cm = id.match(/^crs-(.+)-\d+$/);
    if (cm) { const c = courseById(cm[1]); if (c) courseDetail(c); return; }
    const r = S.routines.find(x => x.id === id);
    if (r) routineEditor(r, dow);
  });
  $$("#view-routine [data-ack]").forEach(ck => ck.onclick = e => {
    e.stopPropagation();
    const a = S.assignments.find(x => x.id === ck.dataset.ack);
    if (!a) return;
    if (a.status === "Done") { a.status = "In progress"; a.updatedAt = Date.now(); save(); gcalQueuePush(); renderRoutine(); }
    else confirmBox("Finish this one?", `Mark "${a.title}" as done — are you sure?`, "Yes, done", () => {
      a.status = "Done"; a.updatedAt = Date.now(); save(); gcalQueuePush(); renderRoutine(); toast("Nice work.");
    });
  });
  $$("#view-routine [data-tck]").forEach(ck => ck.onclick = e => { e.stopPropagation(); toggleTaskDone(ck.dataset.tck); });
  $$("#view-routine [data-asg]").forEach(row => row.onclick = e => {
    if (e.target.closest(".ck")) return;
    const a = S.assignments.find(x => x.id === row.dataset.asg);
    if (a) assignmentDetail(a);
  });
  attachRoutineDrag($("#rout-sortable"));
}
function attachRoutineDrag(listEl) {
  if (!listEl) return;
  let drag = null;
  listEl.addEventListener("pointerdown", e => {
    const h = e.target.closest(".grab");
    if (!h) return;
    const item = h.closest(".routitem");
    if (!item) return;
    e.preventDefault();
    drag = { item, pid: e.pointerId };
    item.classList.add("dragging");
    try { h.setPointerCapture(e.pointerId); } catch (_) { }
  });
  listEl.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    const items = [...listEl.querySelectorAll(".routitem[data-rid]")].filter(x => x !== drag.item);
    let placed = false;
    for (const it of items) {
      const r = it.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { listEl.insertBefore(drag.item, it); placed = true; break; }
    }
    if (!placed && items.length) items[items.length - 1].after(drag.item);
  });
  const up = e => {
    if (!drag) return;
    drag.item.classList.remove("dragging");
    [...listEl.querySelectorAll(".routitem[data-rid]")].forEach((it, i) => {
      const r = S.routines.find(x => x.id === it.dataset.rid);
      if (r && r.order !== i) { r.order = i; r.updatedAt = Date.now(); }
    });
    save();
    drag = null;
  };
  listEl.addEventListener("pointerup", up);
  listEl.addEventListener("pointercancel", up);
}
function routineEditor(r, defaultDow) {
  const isNew = !r;
  r = r || { title: "", time: "", endTime: "", kind: "routine", days: [0, 1, 2, 3, 4, 5, 6], color: "" };
  let days = [...r.days];
  let picked = r.color || "";
  let kind = r.kind === "class" ? "class" : "routine";
  openModal(`
    <h2>${isNew ? "New routine" : "Edit routine"}</h2>
    <div class="field"><label>Type</label><div class="seg" id="re-kind">
      <button data-k="routine" class="${kind === "routine" ? "active" : ""}">Routine</button>
      <button data-k="class" class="${kind === "class" ? "active" : ""}">Class</button>
    </div><span class="hint">Classes show as solid colored blocks in the schedule.</span></div>
    <div class="field" id="re-coursewrap" style="display:${kind === "class" ? "" : "none"}"><label>Course</label><select id="re-course">${courseOptions(r.courseId)}</select><span class="hint">Tip: meeting times saved on the course itself show up here automatically — use this only for extra sessions.</span></div>
    <div class="field" id="re-titlewrap"><label id="re-titlelabel">${kind === "class" ? "Label (optional)" : "What is it?"}</label><input id="re-title" value="${esc(r.title)}" placeholder="${kind === "class" ? "uses the course name if left empty" : "e.g. Gym, Review notes, Call home"}"></div>
    <div class="fieldrow">
      <div class="field"><label>Starts <span style="text-transform:none;font-weight:400">(optional)</span></label><input id="re-time" type="time" value="${esc(r.time || "")}"></div>
      <div class="field"><label>Ends <span style="text-transform:none;font-weight:400">(optional)</span></label><input id="re-end" type="time" value="${esc(r.endTime || "")}"></div>
    </div>
    <div class="field"><label>Which days?</label><div class="daypicker" id="re-days">
      ${[1, 2, 3, 4, 5, 6, 0].map(d => `<button data-d="${d}" class="${days.includes(d) ? "on" : ""}">${DOW[d]}</button>`).join("")}
    </div></div>
    <div class="field"><label>Color</label>${colorPickRow("re-colors", picked)}</div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn ghost danger" id="re-del">Delete</button>`}
      <span class="spacer"></span>
      <button class="btn ghost" id="re-cancel">Cancel</button>
      <button class="btn primary" id="re-save">${isNew ? "Add routine" : "Save"}</button>
    </div>`);
  $$("#re-days button").forEach(b => b.onclick = () => {
    const d = +b.dataset.d;
    if (days.includes(d)) days = days.filter(x => x !== d);
    else days.push(d);
    b.classList.toggle("on", days.includes(d));
  });
  $$("#re-kind button").forEach(b => b.onclick = () => {
    kind = b.dataset.k;
    $$("#re-kind button").forEach(x => x.classList.toggle("active", x === b));
    $("#re-coursewrap").style.display = kind === "class" ? "" : "none";
    $("#re-titlelabel").textContent = kind === "class" ? "Label (optional)" : "What is it?";
    $("#re-title").placeholder = kind === "class" ? "uses the course name if left empty" : "e.g. Gym, Review notes, Call home";
  });
  wireColorPick("re-colors", c => picked = c);
  $("#re-cancel").onclick = closeModal;
  if (!isNew) $("#re-del").onclick = () => confirmBox("Delete routine?", `"${r.title}" disappears from every day.`, "Delete", () => {
    r.deleted = true; r.updatedAt = Date.now(); save(); closeModal(); render(); toast("Routine removed");
  }, true);
  $("#re-save").onclick = () => {
    let title = $("#re-title").value.trim();
    const courseId = kind === "class" ? $("#re-course").value : "";
    if (!title && courseId) title = courseLabel(courseId);
    if (!title) { toast(kind === "class" ? "Pick a course or give it a label" : "Name the routine first"); return; }
    if (!days.length) { toast("Pick at least one day"); return; }
    const time = $("#re-time").value;
    const endTime = time ? $("#re-end").value : "";
    let color = picked;
    if (kind === "class" && !color && courseId) color = courseColor(courseId);
    if (isNew) {
      const order = S.routines.length ? Math.max(...S.routines.map(x => x.order)) + 1 : 0;
      S.routines.push({ id: uid(), title, kind, courseId, time, endTime, days, color, order, deleted: false, updatedAt: Date.now() });
    } else {
      Object.assign(r, { title, kind, courseId, time, endTime, days, color, updatedAt: Date.now() });
    }
    save(); closeModal(); render(); toast(isNew ? "Routine added" : "Saved");
  };
  $("#re-title").focus();
}

/* ============================================================
   CALENDAR (Master Calendar)
   ============================================================ */
function renderCalendar() {
  if (!UI.calMonth) { const d = new Date(); UI.calMonth = [d.getFullYear(), d.getMonth()]; }
  $("#view-calendar").innerHTML = `
    <div class="viewhead">
      <div><h1>Master Calendar</h1><div class="sub">Every deadline, nowhere to hide.</div></div>
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
        <div class="seg" id="cal-seg">
          <button data-cm="month" class="${UI.calMode === "month" ? "active" : ""}">Month</button>
          <button data-cm="table" class="${UI.calMode === "table" ? "active" : ""}">Table</button>
          <button data-cm="list" class="${UI.calMode === "list" ? "active" : ""}">All</button>
        </div>
        <button class="btn primary small" id="cal-add">+ Assignment</button>
      </div>
    </div>
    <div id="cal-body"></div>`;
  $("#cal-add").onclick = () => assignmentEditor(null);
  $$("#cal-seg button").forEach(b => b.onclick = () => { UI.calMode = b.dataset.cm; renderCalendar(); });
  if (UI.calMode === "month") renderCalMonth();
  else if (UI.calMode === "table") renderCalTable();
  else renderCalList();
}
function renderCalTable() {
  const [y, m] = UI.calMonth;
  const first = fmtDate(new Date(y, m, 1));
  const last = fmtDate(new Date(y, m + 1, 0));
  const list = dueAssignments().filter(a => a.due >= first && a.due <= last);
  $("#cal-body").innerHTML = `
    <div class="calhead">
      <h2>${MONTHS[m]} ${y}</h2>
      <div style="display:flex;gap:6px">
        <button class="btn small" id="cm-prev">‹</button>
        <button class="btn small ghost" id="cm-now">Today</button>
        <button class="btn small" id="cm-next">›</button>
      </div>
    </div>
    <div class="card panel"><div class="todo-table">
      <div class="todo-head"><span></span><span>Assignment</span><span style="text-align:right">Course · type</span><span style="text-align:right">Due</span><span style="text-align:right">Days left</span></div>
      ${list.length ? list.map(a => {
        const done = a.status === "Done";
        const dl = done ? null : daysLeftLabel(a.due);
        return `<div class="todo-row ${done ? "done" : ""}" data-asg="${a.id}">
          <span class="ck ${done ? "on" : ""}" data-ack="${a.id}" style="width:19px;height:19px"><svg viewBox="0 0 24 24"><path d="M4 12.5 10 18.5 20 6"/></svg></span>
          <span class="tt">${esc(a.title)}</span>
          <span class="tags">${a.courseId ? `<span class="chip c-faint">${esc(courseLabel(a.courseId))}</span>` : ""}<span class="chip ${typeChipClass(a.type)}">${typeGlyph(a.type, 9)}${esc(a.type)}</span></span>
          <span class="due-d">${niceDate(a.due)}${a.time ? " " + fmtTime12(a.time) : ""}</span>
          <span class="left-d ${dl ? dl.cls : ""}">${dl ? dl.txt : "done"}</span>
        </div>`;
      }).join("") : `<div class="empty" style="margin:12px 4px">Nothing due in ${MONTHS[m]}. Either heaven, or you forgot to add things.</div>`}
    </div></div>`;
  $("#cm-prev").onclick = () => { UI.calMonth = m === 0 ? [y - 1, 11] : [y, m - 1]; renderCalendar(); };
  $("#cm-next").onclick = () => { UI.calMonth = m === 11 ? [y + 1, 0] : [y, m + 1]; renderCalendar(); };
  $("#cm-now").onclick = () => { const d = new Date(); UI.calMonth = [d.getFullYear(), d.getMonth()]; renderCalendar(); };
  $$("#cal-body [data-asg]").forEach(r => r.onclick = () => {
    const a = S.assignments.find(x => x.id === r.dataset.asg);
    if (a) assignmentDetail(a);
  });
  $$("#cal-body [data-ack]").forEach(ck => ck.onclick = e => {
    e.stopPropagation();
    const a = S.assignments.find(x => x.id === ck.dataset.ack);
    if (!a) return;
    if (a.status === "Done") { a.status = "In progress"; a.updatedAt = Date.now(); save(); gcalQueuePush(); renderCalendar(); }
    else confirmBox("Finish this one?", `Mark "${a.title}" as done — are you sure?`, "Yes, done", () => {
      a.status = "Done"; a.updatedAt = Date.now(); save(); gcalQueuePush(); renderCalendar(); toast("Nice work.");
    });
  });
}
function renderCalMonth() {
  const [y, m] = UI.calMonth;
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-start offset
  const cells = [];
  const gridStart = new Date(y, m, 1 - lead);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push(d);
  }
  const byDay = {};
  for (const a of dueAssignments()) (byDay[a.due] = byDay[a.due] || []).push(a);
  const today = todayStr();
  $("#cal-body").innerHTML = `
    <div class="calhead">
      <h2>${MONTHS[m]} ${y}</h2>
      <div style="display:flex;gap:6px">
        <button class="btn small" id="cm-prev">‹</button>
        <button class="btn small ghost" id="cm-now">Today</button>
        <button class="btn small" id="cm-next">›</button>
      </div>
    </div>
    <div class="calgrid">
      ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<div class="dow">${d}</div>`).join("")}
      ${cells.map(d => {
        const ds = fmtDate(d);
        const inMonth = d.getMonth() === m;
        const evs = byDay[ds] || [];
        return `<div class="calcell ${inMonth ? "" : "dim"} ${ds === today ? "today" : ""}" data-day="${ds}">
          <span class="dnum">${d.getDate()}</span>
          ${evs.slice(0, 3).map(a => `<span class="calev ${a.status === "Done" ? "struck" : ""}" style="background:${courseColor(a.courseId)}">${typeGlyph(a.type, 9)}${esc(a.title)}</span>`).join("")}
          ${evs.length > 3 ? `<span class="calmore">+${evs.length - 3} more</span>` : ""}
          <span class="dotbar">${evs.slice(0, 6).map(a => `<span class="evdot" style="background:${courseColor(a.courseId)};${a.status === "Done" ? "opacity:.35" : ""}"></span>`).join("")}</span>
        </div>`;
      }).join("")}
    </div>`;
  $("#cm-prev").onclick = () => { UI.calMonth = m === 0 ? [y - 1, 11] : [y, m - 1]; renderCalendar(); };
  $("#cm-next").onclick = () => { UI.calMonth = m === 11 ? [y + 1, 0] : [y, m + 1]; renderCalendar(); };
  $("#cm-now").onclick = () => { const d = new Date(); UI.calMonth = [d.getFullYear(), d.getMonth()]; renderCalendar(); };
  $$("#cal-body .calcell").forEach(c => c.onclick = () => dayModal(c.dataset.day));
}
function dayModal(day) {
  const evs = dueAssignments().filter(a => a.due === day);
  openModal(`
    <h2>${niceDate(day)}</h2>
    <div class="duelist" style="margin-bottom:4px">
      ${evs.length ? evs.map(dueRowHtml).join("") : `<div class="empty">Nothing due. A gift.</div>`}
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="dm-close">Close</button>
      <button class="btn primary" id="dm-add">+ Add here</button>
    </div>`);
  $("#dm-close").onclick = closeModal;
  $("#dm-add").onclick = () => assignmentEditor(null, day);
  $$("#modal [data-asg]").forEach(r => r.onclick = () => {
    const a = S.assignments.find(x => x.id === r.dataset.asg);
    if (a) assignmentDetail(a);
  });
}
function renderCalList() {
  let list = dueAssignments();
  if (UI.asgCourse !== "all") list = list.filter(a => (a.courseId || "none") === UI.asgCourse);
  if (UI.asgType !== "all") list = list.filter(a => a.type === UI.asgType);
  if (UI.asgHideDone) list = list.filter(a => a.status !== "Done");
  const today = todayStr();
  $("#cal-body").innerHTML = `
    <div class="filterbar">
      <select id="fl-course">
        <option value="all">All courses</option>
        ${alive(S.courses).map(c => `<option value="${c.id}" ${UI.asgCourse === c.id ? "selected" : ""}>${esc(c.code || c.name)}</option>`).join("")}
        <option value="none" ${UI.asgCourse === "none" ? "selected" : ""}>No course</option>
      </select>
      <select id="fl-type">
        <option value="all">All types</option>
        ${TYPES.map(t => `<option ${UI.asgType === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <button class="btn small ${UI.asgHideDone ? "primary" : ""}" id="fl-done">${UI.asgHideDone ? "Showing open only" : "Hide done"}</button>
    </div>
    <div class="asg-table">
      ${list.length ? list.map(a => {
        const over = a.status !== "Done" && dayDiff(today, a.due) < 0;
        return `<div class="asgrow ${a.status === "Done" ? "done" : ""}" data-asg="${a.id}">
          <span class="bar" style="background:${courseColor(a.courseId)}"></span>
          <span class="t">${esc(a.title)}</span>
          <span class="chip ${typeChipClass(a.type)}">${typeGlyph(a.type, 9)}${esc(a.type)}</span>
          ${a.courseId ? `<span class="chip c-faint">${esc(courseLabel(a.courseId))}</span>` : ""}
          <span class="due ${over ? "over" : ""}">${relDay(a.due)}</span>
        </div>`;
      }).join("") : `<div class="empty">${emptyLine(3)}</div>`}
    </div>`;
  $("#fl-course").onchange = e => { UI.asgCourse = e.target.value; renderCalList(); };
  $("#fl-type").onchange = e => { UI.asgType = e.target.value; renderCalList(); };
  $("#fl-done").onclick = () => { UI.asgHideDone = !UI.asgHideDone; renderCalList(); };
  $$("#cal-body [data-asg]").forEach(r => r.onclick = () => {
    const a = S.assignments.find(x => x.id === r.dataset.asg);
    if (a) assignmentDetail(a);
  });
}

/* ============================================================
   SMART-ISH RECOGNITION (no AI, just patterns)
   ============================================================ */
function guessCourse(title) {
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = norm(title);
  if (!t) return "";
  for (const c of alive(S.courses)) {
    if (c.code && norm(c.code).length >= 3 && t.includes(norm(c.code))) return c.id;
  }
  for (const c of alive(S.courses)) {
    if (c.name && norm(c.name).length >= 4 && t.includes(norm(c.name))) return c.id;
  }
  return "";
}
function guessType(title) {
  const t = String(title || "").toLowerCase();
  if (/\bfinal\b|midterm|\bexam\b|\btest\b/.test(t)) return "Test";
  if (/\bquiz\b/.test(t)) return "Quiz";
  if (/\bproject\b/.test(t)) return "Project";
  if (/\bessay\b|\bpaper\b/.test(t)) return "Paper";
  if (/\breading\b|\bread ch/.test(t)) return "Reading";
  if (/\blab\b/.test(t)) return "Lab";
  if (/\bhw\b|homework|p-?set|problem set|assignment|worksheet|\bdue\b/.test(t)) return "Homework";
  return "Other";
}

/* ============================================================
   SYNC PILL
   ============================================================ */
function setPill(text, ok, err) {
  const p = $("#syncpill");
  if (!p) return;
  $("#synctext").textContent = text;
  p.classList.toggle("on", !!ok);
  p.classList.toggle("err", !!err);
}

/* ============================================================
   GOOGLE CALENDAR (two-way)
   ============================================================ */
let gToken = null, gTokenExp = 0, tokenClient = null, gcalBusy = false, gcalTimer = null;
const gcalLinked = () => localStorage.getItem("hr_gcal") === "1";
const gcalReady = () => !!(S.settings.gcalClientId && window.google?.accounts?.oauth2);

function requestToken(interactive) {
  return new Promise(res => {
    if (gToken && Date.now() < gTokenExp - 60000) return res(gToken);
    if (!gcalReady()) return res(null);
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: S.settings.gcalClientId,
        scope: "https://www.googleapis.com/auth/calendar",
        callback: () => { },
      });
    }
    let settled = false;
    const done = v => { if (!settled) { settled = true; res(v); } };
    tokenClient.callback = resp => {
      if (resp && resp.access_token) {
        gToken = resp.access_token;
        gTokenExp = Date.now() + (resp.expires_in || 3600) * 1000;
        localStorage.setItem("hr_gcal", "1");
        done(gToken);
      } else done(null);
    };
    tokenClient.error_callback = () => done(null);
    setTimeout(() => done(gToken && Date.now() < gTokenExp ? gToken : null), 90000);
    try { tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" }); }
    catch (e) { done(null); }
  });
}
async function gfetch(path, opts = {}) {
  const t = await requestToken(false);
  if (!t) throw new Error("no-token");
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: "Bearer " + t, "Content-Type": "application/json" },
  });
  if (r.status === 401) { gToken = null; throw new Error("auth"); }
  if (!r.ok) {
    if (r.status === 404 || r.status === 410) return null;
    throw new Error("gcal " + r.status);
  }
  if (r.status === 204) return {};
  return r.json().catch(() => ({}));
}
async function ensureCalendar() {
  if (S.settings.gcalCalendarId) return S.settings.gcalCalendarId;
  const list = await gfetch("/users/me/calendarList?maxResults=250");
  const found = (list?.items || []).find(c => c.summary === "ODO" || c.summary === "Homeroom");
  let id = found?.id;
  if (!id) {
    const created = await gfetch("/calendars", {
      method: "POST",
      body: JSON.stringify({ summary: "ODO", description: "Assignments managed by ODO. Anything you add here gets pulled into the app too." }),
    });
    id = created?.id;
  }
  if (!id) throw new Error("no calendar");
  S.settings.gcalCalendarId = id;
  persist();
  return id;
}
function parseEvWhen(ev) {
  const st = ev.start || {};
  if (st.date) return { due: st.date, time: "" };
  if (st.dateTime) {
    const d = new Date(st.dateTime);
    return { due: fmtDate(d), time: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") };
  }
  return { due: "", time: "" };
}
function eventBody(a) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ev = {
    summary: a.title,
    description: [a.type, courseById(a.courseId) ? courseLabel(a.courseId) : "", a.status, a.notes].filter(Boolean).join(" · "),
    extendedProperties: { private: { hrid: a.id, courseId: a.courseId || "", type: a.type, status: a.status, app: "homeroom" } },
  };
  if (a.time) {
    const [h, m] = a.time.split(":").map(Number);
    const end = parseDate(a.due);
    end.setHours(h, m + 60);
    ev.start = { dateTime: a.due + "T" + a.time + ":00", timeZone: tz };
    ev.end = { dateTime: fmtDate(end) + "T" + String(end.getHours()).padStart(2, "0") + ":" + String(end.getMinutes()).padStart(2, "0") + ":00", timeZone: tz };
  } else {
    ev.start = { date: a.due };
    ev.end = { date: addDays(a.due, 1) };
  }
  return ev;
}
async function gcalPull(calId) {
  const tmin = new Date(Date.now() - 90 * 864e5).toISOString();
  const tmax = new Date(Date.now() + 400 * 864e5).toISOString();
  let pageToken = "", items = [];
  do {
    const data = await gfetch(`/calendars/${encodeURIComponent(calId)}/events?maxResults=2500&singleEvents=true&showDeleted=true&timeMin=${encodeURIComponent(tmin)}&timeMax=${encodeURIComponent(tmax)}` + (pageToken ? "&pageToken=" + pageToken : ""));
    if (!data) break;
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  for (const ev of items) {
    const hid = ev.extendedProperties?.private?.hrid;
    let a = (hid && S.assignments.find(x => x.id === hid)) || S.assignments.find(x => x.gcalId === ev.id);
    const evUpd = Date.parse(ev.updated || 0) || 0;
    if (ev.status === "cancelled") {
      if (a && !a.deleted && evUpd > (a.updatedAt || 0)) {
        a.deleted = true; a.updatedAt = evUpd; a.gsyncedAt = evUpd; a.gdeleted = true;
      }
      continue;
    }
    const when = parseEvWhen(ev);
    if (!when.due) continue;
    if (!a) {
      const title = ev.summary || "(untitled)";
      const p = ev.extendedProperties?.private || {};
      S.assignments.push({
        id: hid || uid(), gcalId: ev.id, title, due: when.due, time: when.time,
        courseId: (p.courseId && courseById(p.courseId)) ? p.courseId : guessCourse(title),
        type: TYPES.includes(p.type) ? p.type : guessType(title),
        status: STATUSES.includes(p.status) ? p.status : "Not started",
        notes: "", deleted: false, updatedAt: evUpd || Date.now(), gsyncedAt: evUpd || Date.now(),
      });
    } else {
      if (!a.gcalId) a.gcalId = ev.id;
      if (evUpd > (a.updatedAt || 0) && evUpd > (a.gsyncedAt || 0)) {
        a.title = ev.summary || a.title;
        a.due = when.due;
        a.time = when.time;
        const p = ev.extendedProperties?.private || {};
        if (STATUSES.includes(p.status)) a.status = p.status;
        a.updatedAt = evUpd;
        a.gsyncedAt = evUpd;
      }
    }
  }
}
async function gcalPush(calId) {
  for (const a of S.assignments) {
    if (a.deleted) {
      if (a.gcalId && !a.gdeleted) {
        try { await gfetch(`/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(a.gcalId)}`, { method: "DELETE" }); } catch (e) { }
        a.gdeleted = true;
      }
      continue;
    }
    if (a.gcalId && (a.updatedAt || 0) <= (a.gsyncedAt || 0)) continue;
    const body = JSON.stringify(eventBody(a));
    let saved = null;
    if (a.gcalId) {
      saved = await gfetch(`/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(a.gcalId)}`, { method: "PATCH", body });
    }
    if (!saved) {
      saved = await gfetch(`/calendars/${encodeURIComponent(calId)}/events`, { method: "POST", body });
    }
    if (saved?.id) a.gcalId = saved.id;
    a.gsyncedAt = Date.now() + 5000; /* small buffer so our own write isn't echoed back over local */
  }
}
async function gcalSync(interactive = false) {
  if (!S.settings.gcalClientId) { if (interactive) toast("Add your Google Client ID in Settings first"); return; }
  if (!window.google?.accounts?.oauth2) { if (interactive) toast("Google library still loading — try again in a moment"); return; }
  if (gcalBusy) return;
  gcalBusy = true;
  try {
    setPill("syncing Google…");
    const tok = await requestToken(interactive);
    if (!tok) {
      setPill(gcalLinked() ? "Google: tap Sync to reconnect" : "Google not connected", false, false);
      gcalBusy = false;
      if (interactive) toast("Couldn't connect to Google");
      if (UI.view === "settings") renderSettings();
      return;
    }
    const calId = await ensureCalendar();
    await gcalPull(calId);
    await gcalPush(calId);
    persist();
    scheduleCloudPush();
    setPill("synced " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), true);
    if (UI.view !== "settings") render();
    if (interactive) { render(); toast("Google Calendar connected"); }
  } catch (e) {
    console.warn("gcal sync", e);
    setPill("Google sync hiccup", false, true);
    if (interactive) toast("Google sync failed — check Settings");
  }
  gcalBusy = false;
}
function gcalQueuePush() {
  if (!gcalLinked() || !S.settings.gcalClientId) return;
  clearTimeout(gcalTimer);
  gcalTimer = setTimeout(() => gcalSync(false), 2500);
}
function gcalDisconnect() {
  try { if (gToken) google.accounts.oauth2.revoke(gToken, () => { }); } catch (e) { }
  gToken = null; gTokenExp = 0;
  localStorage.removeItem("hr_gcal");
  setPill("Google disconnected");
}

/* ============================================================
   SUPABASE (cross-device sync)
   ============================================================ */
let cloudTimer = null, cloudBusy = false;
const supaConfigured = () => !!(S.settings.supaUrl && S.settings.supaKey && S.settings.syncId);
function scheduleCloudPush() {
  if (!supaConfigured()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudSync(), 2500);
}
async function supaFetch(method, query, body) {
  const s = S.settings;
  const r = await fetch(s.supaUrl.replace(/\/+$/, "") + "/rest/v1/homeroom_state" + query, {
    method,
    headers: {
      apikey: s.supaKey, Authorization: "Bearer " + s.supaKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error("supabase " + r.status);
  return method === "GET" ? r.json() : null;
}
function sharedState() {
  return {
    courses: S.courses, assignments: S.assignments, tasks: S.tasks,
    routines: S.routines, links: S.links, tags: S.tags, tagsMeta: S.tagsMeta,
    routineChecks: S.routineChecks, routineCheckMeta: S.routineCheckMeta,
  };
}
function mergeRemote(remote) {
  let changed = false;
  for (const key of ["courses", "assignments", "tasks", "routines", "links"]) {
    const localArr = S[key];
    const byId = new Map(localArr.map(x => [x.id, x]));
    for (const r of (remote[key] || [])) {
      if (!r || !r.id) continue;
      const l = byId.get(r.id);
      if (!l) { localArr.push(r); changed = true; }
      else if ((r.updatedAt || 0) > (l.updatedAt || 0)) { Object.assign(l, r); changed = true; }
    }
  }
  const rMeta = remote.routineCheckMeta || {};
  for (const date in (remote.routineChecks || {})) {
    if ((rMeta[date] || 0) > (S.routineCheckMeta[date] || 0)) {
      S.routineChecks[date] = remote.routineChecks[date];
      S.routineCheckMeta[date] = rMeta[date];
      changed = true;
    }
  }
  const tMeta = remote.tagsMeta || {};
  for (const name in (remote.tags || {})) {
    if (!S.tags[name] || (tMeta[name] || 0) > (S.tagsMeta[name] || 0)) {
      S.tags[name] = remote.tags[name];
      if (tMeta[name]) S.tagsMeta[name] = tMeta[name];
      changed = true;
    }
  }
  return changed;
}
async function cloudSync() {
  if (!supaConfigured() || cloudBusy) return;
  cloudBusy = true;
  try {
    setPill("syncing…");
    const rows = await supaFetch("GET", "?id=eq." + encodeURIComponent(S.settings.syncId) + "&select=state");
    let changed = false;
    if (rows && rows[0] && rows[0].state) changed = mergeRemote(rows[0].state);
    persist();
    await supaFetch("POST", "", [{ id: S.settings.syncId, state: sharedState(), updated_at: new Date().toISOString() }]);
    setPill("synced " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), true);
    /* never re-render Settings from a background sync — it would wipe half-typed fields */
    if (changed && UI.view !== "settings" && !$("#modal-veil").classList.contains("open")) render();
  } catch (e) {
    console.warn("cloud sync", e);
    setPill("device sync hiccup", false, true);
  }
  cloudBusy = false;
}

/* ============================================================
   SETTINGS
   ============================================================ */
const GH_ORIGIN = "https://kipstheone.github.io";
const SUPA_SQL = `create table homeroom_state (
  id text primary key,
  state jsonb,
  updated_at timestamptz default now()
);
alter table homeroom_state enable row level security;
create policy "open access" on homeroom_state
  for all using (true) with check (true);`;
function copyText(txt, label) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast(label + " copied"), () => toast("Couldn't copy — select it manually"));
  else toast("Couldn't copy — select it manually");
}
const helpStep = (n, html) => `<div style="display:flex;gap:10px;margin-bottom:11px">
  <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink);font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${n}</span>
  <span style="font-size:14px;line-height:1.5">${html}</span>
</div>`;
const helpCode = (txt) => `<code style="display:block;background:var(--bg-soft);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12px;word-break:break-all;margin-top:5px;white-space:pre-wrap">${esc(txt)}</code>`;
function gcalHelp() {
  openModal(`
    <h2>Google Calendar setup</h2>
    <p class="hint" style="margin:-8px 0 14px">One-time, ~15 minutes, free. You need a Google account.</p>
    ${helpStep(1, `Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener">console.cloud.google.com</a> and sign in with the Google account whose calendar you want.`)}
    ${helpStep(2, `Top bar → project dropdown → <b>New Project</b>. Name it <b>odo</b>, create it, make sure it's selected.`)}
    ${helpStep(3, `Search for <b>Google Calendar API</b> → open it → <b>Enable</b>.`)}
    ${helpStep(4, `Menu → <b>APIs &amp; Services → OAuth consent screen</b>. App name <b>ODO</b>, your email, audience <b>External</b>. Then under Audience / Test users, click <b>Add users</b> and add <b>your own Gmail address</b>. (Sign-in will say the app is unverified — normal for personal apps, hit Continue.)`)}
    ${helpStep(5, `Menu → <b>Credentials → Create credentials → OAuth client ID</b>. Type: <b>Web application</b>. Under <b>Authorized JavaScript origins</b>, add exactly:
      ${helpCode(GH_ORIGIN)}
      <button class="btn small" id="gh-copyorigin" style="margin-top:6px">Copy origin</button>
      <span class="hint" style="display:block;margin-top:5px">No trailing slash, no /homeroom path. Testing on a computer too? Also add http://localhost:8000.</span>`)}
    ${helpStep(6, `Click <b>Create</b>, copy the <b>Client ID</b> (ends in .apps.googleusercontent.com), paste it in the field below this guide, then hit <b>Connect Google</b>.`)}
    <p class="hint">Friends using your hosted app: add their Gmail as a test user in step 4, or they can skip calendar sync entirely.</p>
    <div class="modal-actions"><button class="btn primary" id="gh-done">Got it</button></div>`);
  $("#gh-copyorigin").onclick = () => copyText(GH_ORIGIN, "Origin");
  $("#gh-done").onclick = closeModal;
}
function supaHelp() {
  openModal(`
    <h2>Device sync setup</h2>
    <p class="hint" style="margin:-8px 0 14px">One-time, ~10 minutes, free. Keeps phone + laptop identical.</p>
    ${helpStep(1, `Go to <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> → Start your project → sign up (GitHub login is easiest).`)}
    ${helpStep(2, `<b>New project</b>. Name <b>odo</b>, any database password (you won't need it again), nearest region. Wait ~1 min.`)}
    ${helpStep(3, `Left sidebar → <b>SQL Editor</b> → New query → paste this and <b>Run</b>:
      ${helpCode(SUPA_SQL)}
      <button class="btn small" id="sh-copysql" style="margin-top:6px">Copy SQL</button>`)}
    ${helpStep(4, `Gear icon → <b>Project Settings → API Keys</b>. Copy the <b>anon public</b> key (or the newer <b>sb_publishable_…</b> key — either works). The <b>Project URL</b> (https://xxxx.supabase.co) is under Settings → Data API.`)}
    ${helpStep(5, `Paste both into the fields below this guide, then invent a <b>sync code</b> — a long passphrase only you know. It's the password to your data, so make it weird.`)}
    ${helpStep(6, `Hit <b>Save &amp; sync now</b>. Repeat the same three values on your other device, and you're done — they stay in step automatically.`)}
    <p class="hint">Sharing with friends: same project is fine, but each person should use their <b>own</b> sync code.</p>
    <div class="modal-actions"><button class="btn primary" id="sh-done">Got it</button></div>`);
  $("#sh-copysql").onclick = () => copyText(SUPA_SQL, "SQL");
  $("#sh-done").onclick = closeModal;
}
function renderSettings() {
  const s = S.settings;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  $("#view-settings").innerHTML = `
    <div class="viewhead"><div><h1>Settings</h1><div class="sub">The boring tab that makes everything else work.</div></div></div>

    <div class="card set-section">
      <h2>Appearance</h2>
      <div class="desc">Pick a side, or let your device decide.</div>
      <div class="seg" id="st-theme">
        ${["light", "auto", "dark"].map(t => `<button data-t="${t}" class="${s.theme === t ? "active" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      </div>
    </div>

    <div class="card set-section">
      <h2>Look</h2>
      <div class="desc">Entirely different personalities, same brain. Cozy is the library; Modern is the startup; Retro is the print shop; Bubbly is the group chat.</div>
      <div class="palettepick" id="st-look">
        ${LOOKS.map(l => `<button data-l="${l.id}" class="${(s.look || "cozy") === l.id ? "sel" : ""}">${l.name}<span class="hint" style="font-weight:400">· ${l.desc}</span></button>`).join("")}
      </div>
    </div>

    <div class="card set-section">
      <h2>Vibe</h2>
      <div class="desc">Five color moods. Each works with any look, in light and dark — try them all, keep your favorite.</div>
      <div class="palettepick" id="st-pal">
        ${PALETTES.map(p => `<button data-p="${p.id}" class="${(s.palette || "hearth") === p.id ? "sel" : ""}"><span class="pp-sw" style="background:${p.swatch}"></span>${p.name}</button>`).join("")}
      </div>
    </div>

    <div class="card set-section">
      <h2>Personal touch</h2>
      <div class="field" style="max-width:340px"><label>Your name</label><input id="st-name" value="${esc(s.userName || "")}" placeholder="How should ODO greet you? (optional)" autocomplete="off"></div>
      <div class="desc">A banner image for your dashboard — a photo, art, anything that feels like yours. Stays on this device.</div>
      ${s.banner ? `<img src="${s.banner}" alt="" style="width:100%;max-width:380px;height:90px;object-fit:cover;border-radius:10px;margin-bottom:11px;display:block">` : ""}
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn" id="st-banner">${s.banner ? "Change banner" : "Add banner image"}</button>
        ${s.banner ? `<button class="btn ghost danger" id="st-banner-rm">Remove</button>` : ""}
        <input type="file" id="st-banner-file" accept="image/*" style="display:none">
      </div>
    </div>

    <div class="card set-section">
      <h2>Planner</h2>
      <div class="set-inline"><span>Show upcoming tests within</span>
        <select id="st-ahead" style="border:1.5px solid var(--line-strong);background:var(--card);color:var(--ink);border-radius:9px;padding:6px 10px;font-weight:700">
          ${[7, 14, 21, 28].map(n => `<option value="${n}" ${n === (s.testLookahead || 14) ? "selected" : ""}>${n} days</option>`).join("")}
        </select>
      </div>
      <div class="hint">Timezone: ${esc(tz)} (follows your device automatically)</div>
    </div>

    <div class="card set-section">
      <h2>Google Calendar <button class="seemore" id="st-ghelp">setup instructions</button></h2>
      <div class="desc">Two-way sync into a dedicated "ODO" calendar in your Google account — so Google can handle reminders, and anything added there flows back here. Fields save as you type.</div>
      <div class="field"><label>OAuth Client ID</label><input id="st-gcid" value="${esc(s.gcalClientId)}" placeholder="xxxxx.apps.googleusercontent.com" autocomplete="off"></div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="st-gconnect">${gcalLinked() ? "Sync now" : "Connect Google"}</button>
        ${gcalLinked() ? `<button class="btn ghost danger" id="st-gdisc">Disconnect</button>` : ""}
        <span class="hint">${gcalLinked() ? "Connected — sign-in refreshes about every hour." : "Not connected yet."}</span>
      </div>
    </div>

    <div class="card set-section">
      <h2>Device sync <button class="seemore" id="st-shelp">setup instructions</button></h2>
      <div class="desc">Keeps courses, routines, and tasks identical on your phone and laptop via your free Supabase project. Use the same three values on every device. Fields save as you type — paste them one at a time, no rush.</div>
      <div class="field"><label>Supabase project URL</label><input id="st-surl" value="${esc(s.supaUrl)}" placeholder="https://xxxx.supabase.co" autocomplete="off"></div>
      <div class="field"><label>Supabase anon key</label><input id="st-skey" value="${esc(s.supaKey)}" placeholder="eyJhbGciOi…" autocomplete="off"></div>
      <div class="field"><label>Sync code</label><input id="st-sid" value="${esc(s.syncId)}" placeholder="something long and personal, like a passphrase" autocomplete="off"><span class="hint">Acts like a password for your data — make it long and unguessable.</span></div>
      <button class="btn primary" id="st-ssave">Save & sync now</button>
    </div>

    <div class="card set-section">
      <h2>Your data</h2>
      <div class="desc">It's yours. Take it with you, or start over.</div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn" id="st-export">Export backup</button>
        <button class="btn" id="st-import">Import backup</button>
        <button class="btn ghost danger" id="st-reset">Erase everything</button>
        <input type="file" id="st-file" accept=".json" style="display:none">
      </div>
    </div>
    <div class="hint" style="text-align:center;padding:4px 0 20px">ODO ${APP_VERSION} · One Day, or Day One</div>`;

  $$("#st-theme button").forEach(b => b.onclick = () => {
    s.theme = b.dataset.t; persist(); applyTheme(); renderSettings();
  });
  $$("#st-pal button").forEach(b => b.onclick = () => {
    s.palette = b.dataset.p; persist(); applyTheme(); renderSettings();
  });
  $$("#st-look button").forEach(b => b.onclick = () => {
    s.look = b.dataset.l; persist(); applyTheme(); renderSettings();
  });
  $("#st-name").onchange = e => { s.userName = e.target.value.trim().slice(0, 30); persist(); toast(s.userName ? "Hi, " + s.userName : "Name cleared"); };
  $("#st-banner").onclick = () => $("#st-banner-file").click();
  if (s.banner) $("#st-banner-rm").onclick = () => { s.banner = ""; persist(); renderSettings(); toast("Banner removed"); };
  $("#st-banner-file").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const w = Math.min(1400, img.width);
        const h = Math.round(img.height * (w / img.width));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          s.banner = cv.toDataURL("image/jpeg", 0.82);
          persist(); renderSettings(); toast("Banner set");
        } catch (err) { toast("Couldn't read that image"); }
      };
      img.onerror = () => toast("Couldn't read that image");
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
  $("#st-ahead").onchange = e => { s.testLookahead = +e.target.value; save(); };
  /* auto-save sync fields as they're typed/pasted, so nothing is lost if the view re-renders */
  $("#st-gcid").oninput = e => { s.gcalClientId = e.target.value.trim(); tokenClient = null; persist(); };
  $("#st-surl").oninput = e => { s.supaUrl = e.target.value.trim(); persist(); };
  $("#st-skey").oninput = e => { s.supaKey = e.target.value.trim(); persist(); };
  $("#st-sid").oninput = e => { s.syncId = e.target.value.trim(); persist(); };
  $("#st-ghelp").onclick = gcalHelp;
  $("#st-shelp").onclick = supaHelp;
  $("#st-gconnect").onclick = () => {
    if (!s.gcalClientId) { toast("Paste your Client ID first"); return; }
    gcalSync(!gcalLinked());
  };
  if (gcalLinked()) $("#st-gdisc").onclick = () => { gcalDisconnect(); renderSettings(); toast("Google disconnected"); };
  $("#st-ssave").onclick = () => {
    if (supaConfigured()) { cloudSync(); toast("Syncing…"); }
    else toast("Fill in all three fields to enable sync");
  };
  $("#st-export").onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "odo-backup-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("#st-import").onclick = () => $("#st-file").click();
  $("#st-file").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const o = JSON.parse(reader.result);
        if (!o || !Array.isArray(o.assignments)) throw new Error("bad file");
        S = { ...structuredClone(DEFAULTS), ...o, settings: { ...DEFAULTS.settings, ...(o.settings || {}) } };
        save(); render(); toast("Backup restored");
      } catch (err) { toast("That file doesn't look like an ODO backup"); }
    };
    reader.readAsText(f);
  };
  $("#st-reset").onclick = () => confirmBox("Erase everything?", "All courses, assignments, tasks and routines on this device will be deleted. This cannot be undone.", "Erase it all", () => {
    localStorage.removeItem("homeroom_v1");
    localStorage.removeItem("hr_gcal");
    S = structuredClone(DEFAULTS);
    persist(); render(); toast("Fresh start");
  }, true);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  applyTheme();
  $("#themebtn").onclick = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    S.settings.theme = dark ? "light" : "dark";
    persist(); applyTheme();
  };
  nav("home");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
  if (supaConfigured()) cloudSync();
  else setPill("local only");
  if (gcalLinked() && S.settings.gcalClientId) setTimeout(() => gcalSync(false), 1500);
  setInterval(() => { if (supaConfigured() && !document.hidden) cloudSync(); }, 90000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (supaConfigured()) cloudSync();
      if (gcalLinked() && S.settings.gcalClientId) gcalSync(false);
    }
  });
  /* gentle midnight rollover */
  let lastDay = todayStr();
  setInterval(() => {
    if (todayStr() !== lastDay) {
      lastDay = todayStr();
      if (UI.routineDate < lastDay) UI.routineDate = lastDay;
      render();
    }
  }, 60000);
}
init();
