# Homeroom — Setup Guide

Homeroom is a small web app you host for free. One-time setup is three parts:
**A.** put it online (5 min) · **B.** connect Google Calendar (15 min) · **C.** enable device sync (10 min).
Parts B and C are optional — the app works fully on one device without them.

---

## Part A — Put it online (GitHub Pages, free)

1. Create a free account at https://github.com (or sign in).
2. Click **+** (top right) → **New repository**. Name it `homeroom`, keep it **Public**, click **Create repository**.
3. On the new repo page, click **uploading an existing file**, drag in ALL the files from this folder (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`), then click **Commit changes**.
4. Go to **Settings → Pages** (left sidebar). Under "Branch", pick `main` and `/ (root)`, click **Save**.
5. Wait ~2 minutes. Your app is now live at:
   `https://YOURUSERNAME.github.io/homeroom/`
   (the Pages screen shows the exact URL)

Nothing on your computer needs to stay running — GitHub serves the site forever, for free. To update the app later, just upload replacement files the same way.

### Install on your iPhone
1. Open the URL above in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Done. It opens full-screen like a real app and works offline (except syncing, which needs internet).

On desktop, just bookmark the URL — or in Chrome/Edge, click the install icon in the address bar to get a windowed app.

---

## Part B — Google Calendar two-way sync (optional)

This lets assignments flow both ways between Homeroom and Google Calendar. Homeroom creates a dedicated calendar called **"Homeroom"** in your Google account — your normal calendar stays untouched, and Google's reminders/notifications work on everything in it.

You only do this once, and it's free.

1. Go to https://console.cloud.google.com and sign in with the Google account you want to use (you can decide now — it just has to be the account whose calendar you'll use).
2. Top bar → project dropdown → **New Project**. Name it `homeroom`, click **Create**, then make sure it's selected.
3. In the search bar, type **Google Calendar API** → open it → click **Enable**.
4. Left menu → **APIs & Services → OAuth consent screen** (it may be called "Google Auth Platform"):
   - Click **Get started** / configure. App name: `Homeroom`. Support email: your email.
   - Audience: **External**. Contact email: your email. Finish/Create.
   - Under **Audience** (or "Test users"), click **Add users** and add **your own Gmail address**. (While the app is in "Testing" mode only listed users can sign in — that's you, which is all you need. Sign-in will mention the app is unverified; that's expected for personal apps, click "Continue".)
5. Left menu → **APIs & Services → Credentials** → **Create credentials → OAuth client ID**:
   - Application type: **Web application**. Name: `homeroom-web`.
   - Under **Authorized JavaScript origins**, click **Add URI** and enter your site origin **exactly**, with no trailing slash:
     `https://YOURUSERNAME.github.io`
   - Click **Create**. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).
6. Open Homeroom → **Settings → Google Calendar** → paste the Client ID → **Connect Google** → choose your account and allow access.

That's it. Notes:

- Google sign-in tokens last about an hour. The app quietly reconnects when it can; if the sidebar says "tap Sync to reconnect", open Settings and hit **Sync now** (one click, no password).
- On iPhone, Google's sign-in popup occasionally misbehaves inside the home-screen app. If connecting fails there, open the same URL in regular Safari once, connect, then go back to the home-screen app — it shares the connection.
- Anything you add **to the "Homeroom" calendar** in Google Calendar (or that your school's LMS exports into it) appears in the app, with course and type guessed from the title.
- To get Google reminders, open Google Calendar → Homeroom calendar settings → set default notifications.

---

## Part C — Device sync via Supabase (optional)

This keeps phone + laptop identical (courses, routines, tasks — everything). Free tier is far more than enough.

1. Go to https://supabase.com → **Start your project** → sign up (GitHub login is easiest).
2. Create a **New project**. Name: `homeroom`. Set any database password (you won't need it day-to-day). Region: closest to you. Wait ~1 minute for it to provision.
3. Left sidebar → **SQL Editor** → **New query** → paste this and click **Run**:

```sql
create table homeroom_state (
  id text primary key,
  state jsonb,
  updated_at timestamptz default now()
);
alter table homeroom_state enable row level security;
create policy "open access" on homeroom_state
  for all using (true) with check (true);
```

4. Left sidebar → **Project Settings → API** (or "Data API"). Copy two things:
   - **Project URL** (like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long string starting `eyJ…`)
5. Open Homeroom → **Settings → Device sync** → paste both, and invent a **sync code** — a long passphrase only you know (e.g. `plum-toast-quasar-1947-rugby`). Click **Save & sync now**.
6. Repeat step 5 on your other device with the **same three values**. Done — they now stay in step.

Security note: anyone who had your URL, key, *and* sync code could read that row, so make the sync code long and never share it. Your data is course schedules, not state secrets, but still.

---

## Everyday use, in 30 seconds

- **Home** — today at a glance: quick links (edit them to point at Gmail, Canvas, anything), a full month calendar with named assignments, what's due, tests on the horizon, your routine (checkable right there), your courses. Hit **Arrange** to move any panel between the wide top area and the two columns, or reorder them — the layout is yours.
- **Week** — the Tweek-style board. Drag tasks between days, check them off, park ideas in Someday. Assignments show up automatically in terracotta; finishing one asks "are you sure?" on purpose.
- **Routine** — your daily rhythm per weekday. Drag to reorder as the day mutates.
- **Master Calendar** — month view of every deadline, plus the full sortable list with course/type filters.
- **Courses** — the binder. Click any course for office hours, grading scheme, syllabus link, all of it.

Personalization: tasks, routines, and quick links each take a color tag from a 16-color set (open one to pick); colored routines glow in their color. Every assignment type has its own symbol — triangle for tests, diamond for quizzes, circle for homework, book for readings, flask for labs — wherever assignments appear. Courses take unlimited custom info boxes (your own label + text). Settings has light/dark/auto, five color palettes (Hearth, Meadow, Tide, Dusk, Ember), and four whole-app Looks — Cozy, Modern, Retro, Bubbly — that change fonts, shapes, and shadows entirely. Mix and match freely.

Everything works offline; syncing catches up when you're back online. Timezones come from your device automatically.
