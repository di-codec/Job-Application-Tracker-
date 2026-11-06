# Job Application Tracker - Desktop Version

A personal desktop app for tracking job applications: vacancies, statuses, resumes,
interview notes and skill gaps. Everything runs locally on your computer - the data is
stored in a SQLite file and never leaves the machine.

The app is a [Tauri 2](https://tauri.app) desktop shell around a React frontend and a
Node.js/Express backend. The same backend is also used by the
[MCP server](#mcp-server-claude-integration), so Claude Desktop can read and update the tracker.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Development](#development)
- [Building the desktop app](#building-the-desktop-app)
- [Where the data lives](#where-the-data-lives)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Frontend](#frontend)
- [Skill gap analysis](#skill-gap-analysis)
- [Desktop shell (Tauri)](#desktop-shell-tauri)
- [MCP server (Claude integration)](#mcp-server-claude-integration)
- [Conventions for new features](#conventions-for-new-features)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Features

| Page | What it does |
|---|---|
| **Home** | Application funnel (Sankey diagram), timeline of applications that reached an interview, average interviews per week. |
| **Add Application** | New vacancy: title, company, posting URL, job description, salary (GBP), work format (remote / on-site / hybrid with office days), resume (PDF or DOCX), status. |
| **Application Manager** | Table of all applications with search, status filter chips, inline status change, resume download, edit and delete. |
| **JD Details** | Search by company and open a side panel with the full job description and a resume preview. |
| **Interview Notes** | Per-application preparation plan and live notes in a Markdown editor. |
| **Skill Gap** | Ranked list of the skills you were missing most often across applications. |

Other features: light/dark theme, responsive layout, missing skills and the "include in gap
stats" flag in the Edit dialog.

## Architecture

```
+------------------------- Desktop app (Tauri, app.exe) -------------------------+
|                                                                                 |
|   WebView (React UI)  --HTTP-->  http://127.0.0.1:3001  (backend sidecar)       |
|                                         |                                       |
|   Rust shell (lib.rs): starts, watches   +--> SQLite: applications.db           |
|   and stops the backend sidecar          +--> uploads/ (resume files)           |
+---------------------------------------------------------------------------------+

Claude Desktop --stdio--> MCP server (separate folder) --HTTP--> the same API on :3001
```

- **Frontend** (`frontend/`) - React 19 + Vite, React Router, plain CSS. In the desktop app it
  calls the API at `http://127.0.0.1:3001`; in the browser during development it uses
  relative `/api/...` URLs that Vite proxies to port 3001.
- **Backend** (`backend/`) - Express 4 + better-sqlite3. Owns all data and validation.
  For the desktop build it is packed with [caxa](https://github.com/leafac/caxa) into a single
  executable (the "sidecar").
- **Desktop shell** (`src-tauri/`) - Tauri 2 (Rust). Opens the window, starts the backend
  sidecar in the background, restarts it if it crashes and kills it on exit.

## Project structure

```
Job Application Tracker - Desktop Version/
|-- package.json               Root scripts (dev, build, Tauri CLI)
|-- backend/
|   |-- server.js              Express app: middleware, routes, error handler, listen
|   |-- db.js                  SQLite connection + schema creation and migrations
|   |-- paths.js               Where the DB and uploads live (env JOB_TRACKER_DATA_DIR)
|   |-- constants.js           Allowed statuses, work modes, resume types
|   |-- skills.js              Skill name normalisation, aliases, missing skills storage
|   |-- middleware/upload.js   Multer config for resume uploads (PDF/DOCX, max 10 MB)
|   |-- routes/
|   |   |-- applications.js    /api/applications CRUD, status, resume download
|   |   |-- interviewNotes.js  /api/applications/.../interview-notes
|   |   |-- missingSkills.js   /api/applications/:id/missing-skills
|   |   `-- skills.js          /api/skills (autocomplete, gap stats)
|   |-- scripts/build-sidecar.mjs  Packs the backend into src-tauri/binaries/
|   |-- data/                  Dev database (git-ignored)
|   `-- uploads/               Dev resume files (git-ignored)
|-- frontend/
|   |-- vite.config.js         Dev server on 5173, /api proxy to 3001
|   `-- src/
|       |-- App.jsx            Routes
|       |-- constants.js       Statuses, labels, work modes
|       |-- api/               client.js (apiFetch), applications.js, interviewNotes.js, skills.js
|       |-- pages/             Home, AddApplication, AllApplications, Search, InterviewNotes, SkillGap
|       |-- components/        Layout, EditApplicationModal, MissingSkillsField, FunnelSankey, ...
|       |-- context/           ThemeContext (light/dark)
|       |-- utils/             Formatting, funnel and timeline helpers
|       `-- index.css, theme.css, responsive.css
`-- src-tauri/
    |-- tauri.conf.json        Window, bundle targets (NSIS, MSI), sidecar, build hooks
    |-- Cargo.toml
    |-- capabilities/default.json
    |-- binaries/              Built backend sidecar (git-ignored)
    `-- src/lib.rs             Backend lifecycle: start, health wait, supervise, kill
```

## Requirements

- **Windows 10/11** (the desktop build and sidecar are set up for Windows x64)
- **Node.js 18+** (developed on Node 22) - `node -v`
- **Rust** toolchain via [rustup](https://rustup.rs) - `cargo --version`
- **Microsoft C++ Build Tools** and **WebView2** - see the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Getting started

Install the dependencies of all three packages (root, backend, frontend):

```powershell
npm run install:all
```

## Development

### In the browser (fastest)

```powershell
npm run dev
```

This starts the backend on `http://127.0.0.1:3001` (with `node --watch`, restarts on file
changes) and the frontend on `http://localhost:5173`. Open http://localhost:5173.

You can also start them separately:

```powershell
npm run dev:backend
npm run dev:frontend
```

Dev data is stored in `backend/data/applications.db` and `backend/uploads/`.

### In the desktop window

```powershell
npm run tauri dev
```

Tauri starts the Vite dev server and opens the app window. In debug builds the Rust shell
starts the backend with `node backend/server.js`. If something already listens on port 3001
(for example `npm run dev:backend`), the shell uses it instead of starting a second backend.

Note: in debug builds the backend uses the desktop data folder (see
[Where the data lives](#where-the-data-lives)), not `backend/data/`.

### Checking the API

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/applications | Select-Object -First 3
```

There is no automated test suite. Changes are checked manually through the UI and with
`Invoke-RestMethod` calls like the ones above.

## Building the desktop app

```powershell
npm run tauri:build
```

The build runs, in order:

1. `npm run build:sidecar --prefix backend` - packs the backend with caxa into
   `src-tauri/binaries/job-tracker-api-x86_64-pc-windows-msvc.exe`
2. `npm run build --prefix frontend` - builds the React app into `frontend/dist/`
3. Rust release build and installers

Output:

| File | Use |
|---|---|
| `src-tauri\target\release\bundle\nsis\Job Application Tracker_0.1.0_x64-setup.exe` | **Recommended installer.** Per-user install, no admin rights, upgrades the existing install. |
| `src-tauri\target\release\bundle\msi\Job Application Tracker_0.1.0_x64_en-US.msi` | Windows Installer package, usually per-machine with admin rights. Mainly for managed deployment. |
| `src-tauri\target\release\app.exe` | The app without installing. Needs `job-tracker-api.exe` next to it. |

Use one installer type only, otherwise you end up with two copies of the app.
The version number is set in `src-tauri/tauri.conf.json` (`version`).

**Any backend change requires a full `npm run tauri:build`**, because the backend is
shipped inside the sidecar executable.

## Where the data lives

| Mode | Database | Resumes |
|---|---|---|
| Desktop app | `%APPDATA%\com.jobtracker.desktop\applications.db` | `%APPDATA%\com.jobtracker.desktop\uploads\` |
| `npm run dev` | `backend\data\applications.db` | `backend\uploads\` |

The location is chosen in `backend/paths.js`: if the `JOB_TRACKER_DATA_DIR` environment
variable is set (the desktop shell sets it), the data goes there, otherwise into `backend/`.

Reinstalling or updating the app keeps the data folder. When uninstalling, leave the
"delete application data" option unticked if you want to keep your data.

**Backup:** close the app and copy the whole `%APPDATA%\com.jobtracker.desktop` folder.

```powershell
Copy-Item "$env:APPDATA\com.jobtracker.desktop" "$HOME\Desktop\job-tracker-backup" -Recurse
```

**First launch migration:** if the desktop data folder has no database yet, the shell copies
`backend/data/applications.db` and `backend/uploads/` from the project folder it was built
from. This only works on the machine where the app was built.

## Database schema

The schema is created and migrated in `backend/db.js` on every start. There is no separate
migration tool: new tables use `CREATE TABLE IF NOT EXISTS`, new columns are added with
`ALTER TABLE ... ADD COLUMN` after checking `PRAGMA table_info`. Foreign keys are switched on
(`PRAGMA foreign_keys = ON`), so deleting an application also deletes its notes and missing
skills.

```
applications
  id                    INTEGER PK
  job_title             TEXT NOT NULL
  company_name          TEXT NOT NULL
  job_description_link  TEXT
  job_description_text  TEXT
  salary_gbp            REAL
  work_mode             TEXT  remote | on_site | hybrid | NULL
  office_days_per_week  INTEGER  (hybrid only, 1-7)
  applied_date          TEXT  YYYY-MM-DD, set on create
  resume_file           TEXT  JSON {storedName, originalName}
  include_in_gap_stats  INTEGER 0/1, default 1
  status                TEXT  no_answer | rejected | interviewing | no_offer | offer | accepted | declined

interview_notes
  application_id        INTEGER PK -> applications.id (cascade)
  preparation_plan      TEXT
  live_notes            TEXT
  updated_at            TEXT

skills
  id                    INTEGER PK
  name                  TEXT   display name, e.g. "AWS"
  name_key              TEXT UNIQUE   normalised key, e.g. "aws"

application_missing_skills
  application_id        INTEGER -> applications.id (cascade)
  skill_id              INTEGER -> skills.id (cascade)
  PRIMARY KEY (application_id, skill_id)
```

## API reference

Base URL: `http://127.0.0.1:3001`. Request and response bodies are JSON unless noted.
Errors are returned as `{ "error": "message" }` with status 400 (validation) or 404 (not found).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ status: "ok" }` when the backend is up |

### Applications

| Method | Path | Description |
|---|---|---|
| GET | `/api/applications` | All applications, newest first |
| GET | `/api/applications/:id` | One application |
| POST | `/api/applications` | Create. **multipart/form-data**: `job_title`*, `company_name`*, `job_description_link`, `job_description_text`, `salary_gbp`, `work_mode`, `office_days_per_week`, `status`, `resume` (file) |
| PUT | `/api/applications/:id` | Update. Same multipart fields as POST plus optional `include_in_gap_stats` (`true`/`false`; omitted = unchanged). A new `resume` replaces the old file. Optional text fields that are not sent are cleared (`status`, `resume` and `include_in_gap_stats` are kept), so send all current values. |
| PATCH | `/api/applications/:id/status` | `{ "status": "interviewing" }` |
| DELETE | `/api/applications/:id` | Deletes the application, its resume file, notes and missing skills |
| GET | `/api/applications/:id/resume` | Downloads the resume; `?inline=1` to display it |

Each application in a response includes:

```json
{
  "id": 70,
  "job_title": "Data Engineer",
  "company_name": "Example Ltd",
  "status": "no_answer",
  "resume_file": { "storedName": "....docx", "originalName": "CV.docx" },
  "include_in_gap_stats": true,
  "missing_skills": [{ "id": 1, "name": "AWS" }]
}
```

### Interview notes

| Method | Path | Description |
|---|---|---|
| GET | `/api/applications/interview-notes` | Notes for all applications (with title, company, status) |
| GET | `/api/applications/:id/interview-notes` | Notes for one application (empty strings if none yet) |
| PUT | `/api/applications/:id/interview-notes` | `{ "preparation_plan": "...", "live_notes": "..." }` - replaces both fields |

### Missing skills and skill gap

| Method | Path | Description |
|---|---|---|
| GET | `/api/applications/:id/missing-skills` | `[{ id, name }]` |
| PUT | `/api/applications/:id/missing-skills` | `{ "skills": ["AWS", "k8s"] }` - replaces the whole list, returns the saved list |
| GET | `/api/skills?q=ku&limit=50` | Known skills for autocomplete, with `application_count` |
| GET | `/api/skills/gap-stats` | Ranking, see below |

`GET /api/skills/gap-stats` response:

```json
{
  "total_applications": 12,
  "excluded_applications": 2,
  "skills": [
    { "rank": 1, "id": 1, "name": "AWS", "count": 7, "percentage": 58.3 }
  ]
}
```

## Frontend

- **Routing:** `frontend/src/App.jsx`. Navigation items are in `components/Layout.jsx`.
- **API calls:** always go through `apiFetch(path, options)` from `api/client.js`:
  - in the desktop app it targets `http://127.0.0.1:3001`, in the browser relative `/api`;
  - before the first request it waits until `/api/health` answers (up to 2 minutes), because
    the sidecar may still be starting;
  - GET requests are retried once if the connection drops.
- **API modules:** one file per area in `api/` (`applications.js`, `interviewNotes.js`,
  `skills.js`). Each function throws an `Error` with the backend's message.
- **Styling:** plain CSS with BEM-like class names (`form__input`, `table__button`,
  `skill-gap__bar`). Colours come from CSS variables in `theme.css`, so new styles work in
  both themes automatically. No UI library is used.
- **Main libraries:** `plotly.js-dist-min` (funnel), `@tiptap/*` (Markdown notes editor),
  `mammoth` (DOCX resume preview), `react-router-dom`.

## Skill gap analysis

Goal: for each application, record the requirements you don't meet, then see which skills
are missing most often across all applications.

**Recording skills** - Application Manager -> Edit -> "Missing skills":

- type a skill and press Enter or comma; several at once: `AWS, Docker, Go`
- suggestions come from skills already used in other applications
- x on a chip removes it; Backspace in an empty field removes the last one
- "Include in skill gap stats" - untick for low-interest applications so they don't skew
  the ranking
- saved together with the rest of the form by "Save changes"

**Counting rules** (implemented in `backend/skills.js` and `backend/routes/skills.js`):

- A skill counts **once per application** - enforced by the primary key
  `(application_id, skill_id)`.
- **Normalisation:** whitespace is collapsed, case is ignored, punctuation is trimmed from the
  ends (`Node.js.` -> `Node.js`), while `+`, `#` and `.` inside names are kept (`C++`, `C#`,
  `.NET`).
- **Aliases** merge common variants into one skill: `Amazon Web Services` / `aws` -> `AWS`,
  `k8s` -> `Kubernetes`, `postgres` -> `PostgreSQL`, `js` -> `JavaScript` and others. The list
  is `SKILL_ALIASES` in `backend/skills.js`; add entries there to merge new variants.
- **Percentage** = applications missing the skill / `total_applications`, where
  `total_applications` = **included applications that have at least one missing skill
  recorded**. Applications with no gaps recorded are not counted, so the percentages show
  "how often a skill was missing among applications I analysed", not among all applications.
- Skills that are no longer linked to any application are deleted automatically, so the
  autocomplete list stays clean.

**Skill Gap page** (`/skill-gap`) - ranked table: #, skill, "N of M" applications, share bar
and percentage.

## Desktop shell (Tauri)

`src-tauri/src/lib.rs` manages the backend:

1. On startup it creates the data folder and runs the first-launch migration.
2. A background thread starts the backend, so the window opens immediately:
   - release builds: the sidecar `job-tracker-api.exe` next to `app.exe`;
   - debug builds: `node backend/server.js`.
   The process gets `JOB_TRACKER_DATA_DIR`, `PORT=3001` and `HOST=127.0.0.1`.
3. The supervisor checks the process every 2 seconds and restarts it if it exits
   (up to 5 attempts in a row). If another process already answers on port 3001, it does
   not start a second backend.
4. A slow start is never treated as a failure. The caxa sidecar unpacks itself into the
   temp folder on the first run after each build, which can take up to a minute.
5. On exit the whole process tree is killed (`taskkill /T /F`), so no `node.exe` stays behind
   holding the port.

## MCP server (Claude integration)

A separate project in
`C:\Users\covuk\Desktop\Projects\Job Application Tracker - MCP Server` connects
**Claude Desktop** to this app. It is a small Node.js MCP server (`server.js`) that calls the
same REST API on port 3001, so **the tracker must be open** while Claude uses it.

Tools it provides: `tracker_status`, `list_applications`, `get_application`,
`create_application` (can attach a resume written as Markdown, converted to DOCX),
`update_status`, `get_interview_notes`, `save_interview_notes`, `get_missing_skills`,
`set_missing_skills`, `set_gap_stats_inclusion`, `get_skill_gap_stats`.

It is registered in `%APPDATA%\Claude\claude_desktop_config.json` as `job-app-tracker`.
Setup and usage are described in that project's own README.

**When you change the API here**, update the MCP server too, then restart Claude Desktop.

## Conventions for new features

- **Schema:** add tables/columns in `backend/db.js` the same way as existing ones
  (`IF NOT EXISTS`, `PRAGMA table_info` + `ALTER TABLE`). Never drop or rewrite existing data.
- **Routes:** one router per area in `backend/routes/`. Sub-resources of an application
  (`/:id/...`) go in their own router mounted inside `routes/applications.js`, like
  `interviewNotes.js` and `missingSkills.js`. Top-level areas are mounted in `server.js`.
- **Validation:** small `parseX()` helpers that return `{ value }` or `{ error }`; respond
  with `400 { error }`. Prepared statements are created once at module level.
- **Backwards compatibility:** only add fields to responses; make new request fields
  optional and keep the current value when they are missing.
- **Frontend:** API functions in `frontend/src/api/`, always via `apiFetch`; reusable form
  fields as components (see `WorkModeFields.jsx`, `MissingSkillsField.jsx`); styles in
  `index.css` using theme variables.
- **JSON bodies** are parsed by a small custom middleware in `server.js` instead of
  `express.json()`, because body-parser breaks inside the caxa sidecar. Keep it that way.
- After backend changes, rebuild the desktop app and check the MCP server.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Failed to fetch" in the desktop app | An old build is installed. Install the latest NSIS installer. |
| "Local API did not start" | The backend didn't answer within 2 minutes. Restart the app. If it repeats, check that nothing else blocks port 3001 and that antivirus doesn't block `job-tracker-api.exe`. |
| Data takes long to appear after an update | Normal on the first launch after a new build: the sidecar is unpacking. |
| The desktop app shows dev data | `npm run dev` was running: the app uses whatever backend already listens on port 3001. Stop the dev backend and restart the app. |
| Port 3001 is busy | `Get-NetTCPConnection -LocalPort 3001 -State Listen` shows the owning process id. |
| Build fails at the sidecar step | Run `npm install --prefix backend` and try again; `rustc` must be on PATH (it is used to get the target triple). |
| Claude can't reach the tracker | Open the desktop app (or start the dev backend) and restart Claude Desktop after MCP changes. |

## Known limitations

- Windows only: the sidecar build and process handling are written for Windows.
- The sidecar is large (about 130 MB) because caxa bundles Node.js and `node_modules`; it
  unpacks on the first run after each build. A single-executable build (Node SEA or `pkg`)
  would start faster.
- The backend listens on a fixed port (3001). Only one backend can use it at a time.
- No automated tests.
- No merge tool for duplicate skills yet: aliases cover common cases; rare duplicates have to
  be fixed by editing the applications.
- The skill gap percentage does not count applications where you met every requirement
  (there is no "reviewed" flag yet).
