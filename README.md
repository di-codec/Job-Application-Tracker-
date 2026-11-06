# Job Application Tracker — MCP server

A small **local** MCP server that lets **Claude Desktop** read and write your
Job Application Tracker: list and add applications, update statuses, work with interview
notes, and record and analyse **skill gaps**.

It is a thin bridge to the tracker's own REST API on `http://127.0.0.1:3001`. Nothing is
exposed to the internet and no hosting is needed.

```
Claude Desktop ──stdio──▶ server.js (this folder) ──HTTP──▶ tracker backend :3001 ──▶ SQLite
```

## Tools

### Applications

| Tool | What it does |
|---|---|
| `tracker_status` | Checks the tracker backend is reachable. Use it first if other tools fail. |
| `list_applications` | All applications, newest first: id, title, company, status, date, salary, work mode, resume attached, missing skills, included in gap stats. |
| `get_application` | Full details of one application, including the job description text. |
| `create_application` | Adds a vacancy. Pass a tailored resume as `resume_markdown` and it is converted to `.docx` and attached (the tracker accepts only `.pdf`/`.docx`). |
| `update_status` | Changes status: `no_answer`, `rejected`, `interviewing`, `no_offer`, `offer`, `accepted`, `declined`. |

### Interview notes

| Tool | What it does |
|---|---|
| `get_interview_notes` | Prep plan and live notes for one application, or a summary for all. |
| `save_interview_notes` | Saves `preparation_plan` and/or `live_notes`. Merges: a field you don't pass is kept. |

### Skill gap

| Tool | What it does |
|---|---|
| `get_missing_skills` | Skills recorded as missing for one application. |
| `set_missing_skills` | Saves missing skills. `mode`: `add` (default — merges, never removes), `remove` (deletes the listed names), `replace` (overwrites the whole list). |
| `set_gap_stats_inclusion` | Includes or excludes an application from the ranking, so low-interest applications don't skew it. Other fields are not changed. |
| `get_skill_gap_stats` | Ranked list of the most frequently missing skills, #1 first. Optional `limit` for the top N. |

How the skill gap numbers work (this logic lives in the tracker backend):

- A skill counts **once per application**, however often the job description repeats it.
- Names are normalised: case and spacing are ignored, and common aliases merge
  (`Amazon Web Services` / `aws` → `AWS`, `k8s` → `Kubernetes`, `postgres` → `PostgreSQL`, …).
- **Percentage** = applications missing the skill ÷ `total_applications`, where
  `total_applications` counts only **included applications with at least one missing skill
  recorded** — not every application. Applications where you met all requirements are not
  in the denominator, so percentages lean high.

## The tracker must be running

The tools work only while the tracker backend is up:

- **Desktop app:** keep the Job Application Tracker window open. The app starts the backend
  on launch and stops it on exit. Right after installing a new build, the first start can
  take up to a minute while the backend unpacks.
- **Development:** `npm run dev:backend` in the tracker project serves the same API on port 3001.

If nothing is listening, the tools return *"Can't reach the Job Application Tracker…"*.

The skill gap tools need a tracker build that includes the Skill Gap feature. With an older
build they fail with a "not found" error.

## Setup (Windows)

Requirements: Node.js 18+ (`node -v`) and **Claude Desktop** — local MCP servers don't work
in the browser version of claude.ai.

1. Install dependencies (PowerShell):

   ```powershell
   cd "C:\Users\covuk\Desktop\Projects\Job Application Tracker - MCP Server"
   npm install
   ```

2. Register the server in `%APPDATA%\Claude\claude_desktop_config.json` (create the file if
   it doesn't exist). Use absolute paths with doubled backslashes:

   ```json
   {
     "mcpServers": {
       "job-app-tracker": {
         "command": "node",
         "args": [
           "C:\\Users\\covuk\\Desktop\\Projects\\Job Application Tracker - MCP Server\\server.js"
         ]
       }
     }
   }
   ```

   If Claude Desktop can't find `node`, replace `"node"` with the full path from
   `(Get-Command node).Source`, e.g. `"C:\\Program Files\\nodejs\\node.exe"`.

   To point at a different API address, add
   `"env": { "JOB_TRACKER_API": "http://127.0.0.1:3001" }` next to `args`.

3. **Fully quit Claude Desktop** (including the tray icon) and open it again. The tools appear
   under the connectors/tools button in the chat input. Ask *"check the job tracker status"*
   to confirm.

**After editing `server.js`, restart Claude Desktop** — it starts the server once and doesn't
pick up changes on its own.

## Suggested project instructions

Add these to your Claude project so the tools are used naturally:

> When I share a job posting and we produce a tailored resume, add it to my tracker with
> `create_application`, passing the resume as `resume_markdown`. Before an interview, read my
> notes with `get_interview_notes` and offer to save the prep plan with
> `save_interview_notes`. When we compare a job description with my experience, list the
> requirements I don't meet, confirm them with me, then save them with `set_missing_skills`.
> When I ask what to learn next, use `get_skill_gap_stats`.

Example requests:

- "Which skills am I missing most often? Show the top 5."
- "Compare application 70 with my CV and suggest the missing skills — don't save yet."
- "Add Terraform and Azure as missing skills to the KDR Talent application."
- "Exclude application 52 from the skill gap stats."

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tools don't appear in Claude | Wrong config file or invalid JSON, or Claude Desktop wasn't fully quit. Check the JSON and restart. |
| "Can't reach the Job Application Tracker" | Open the tracker app (or start the dev backend) and wait for it to load. |
| Skill gap tools fail with "not found" | The installed tracker build is older than the Skill Gap feature. Install the latest build. |
| New or changed tools don't show up | Restart Claude Desktop after changing `server.js`. |
| `node` not found | Use the full path to `node.exe` in `command`. |

## Files

- `server.js` — the whole MCP server: tool definitions and the markdown → `.docx` converter.
- `package.json` — dependencies: `@modelcontextprotocol/sdk`, `zod` (input schemas), `docx` (resume files).
- `tsconfig.json` — not used: the server is plain JavaScript and nothing is compiled.
