#!/usr/bin/env node
/**
 * Job Application Tracker — MCP server (local / stdio)
 *
 * Bridges Claude Desktop to the tracker's local REST API (http://127.0.0.1:3001).
 * The tracker desktop app must be RUNNING for these tools to work — it starts the
 * backend and shuts it down when the window closes.
 *
 * Tools:
 *   tracker_status        — check the backend is reachable
 *   list_applications     — list all saved applications
 *   get_application       — full details for one application
 *   create_application    — add a vacancy (+ optional generated resume as .docx)
 *   update_status         — change an application's status
 *   get_interview_notes   — read prep plan / live notes (one or all)
 *   save_interview_notes  — write prep plan / live notes (merges, never wipes)
 *   get_missing_skills    — read the skills missing for one application
 *   set_missing_skills    — add / remove / replace an application's missing skills
 *   set_gap_stats_inclusion — include/exclude an application from skill gap stats
 *   get_skill_gap_stats   — ranked list of the most frequently missing skills
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';

const BASE = process.env.JOB_TRACKER_API || 'http://127.0.0.1:3001';

const APPLICATION_STATUSES = [
  'no_answer',
  'rejected',
  'interviewing',
  'no_offer',
  'offer',
  'accepted',
  'declined',
];
const WORK_MODES = ['remote', 'on_site', 'hybrid'];
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ------------------------------------------------------------------ helpers */

function ok(data) {
  const text =
    typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}

function fail(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Turn low-level fetch errors into a clear, actionable message. */
function friendlyNetworkError(err) {
  const cause = err?.cause?.code || err?.code || '';
  if (cause === 'ECONNREFUSED' || /fetch failed/i.test(err?.message || '')) {
    return (
      `Can't reach the Job Application Tracker at ${BASE}. ` +
      `Open the Job Application Tracker desktop app (it runs the backend) and try again.`
    );
  }
  return `Request failed: ${err?.message || String(err)}`;
}

/** JSON request against the tracker API. Throws Error with a clean message. */
async function api(path, { method = 'GET', body, headers } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, body, headers });
  } catch (err) {
    throw new Error(friendlyNetworkError(err));
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

/* ------------------------------------------------- markdown -> .docx buffer */

/** Split a line into docx TextRuns, honouring **bold**. */
function inlineRuns(line) {
  const runs = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else {
      runs.push(new TextRun(part));
    }
  }
  return runs.length ? runs : [new TextRun('')];
}

/** Convert lightweight markdown/plain text into a .docx Buffer. */
async function markdownToDocxBuffer(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const children = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun('')] }));
      continue;
    }
    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(line.slice(4)) }),
      );
      continue;
    }
    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(line.slice(3)) }),
      );
      continue;
    }
    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(line.slice(2)) }),
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '');
      children.push(new Paragraph({ children: inlineRuns(content), bullet: { level: 0 } }));
      continue;
    }
    children.push(new Paragraph({ children: inlineRuns(line) }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resume'
  );
}

/* ---------------------------------------------------------------- MCP server */

const server = new McpServer({
  name: 'job-application-tracker',
  version: '1.0.0',
});

server.registerTool(
  'tracker_status',
  {
    title: 'Check tracker status',
    description:
      'Check whether the Job Application Tracker backend is running and reachable. ' +
      'Use this first if other tools fail with a connection error.',
    inputSchema: {},
  },
  async () => {
    try {
      const health = await api('/api/health');
      return ok({ reachable: true, base: BASE, ...health });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'list_applications',
  {
    title: 'List applications',
    description:
      'List all job applications saved in the tracker, most recent first. ' +
      'Returns id, job title, company, status, applied date, salary, work mode, whether a resume is attached, ' +
      'the missing skills recorded for it, and whether it counts in skill gap stats.',
    inputSchema: {},
  },
  async () => {
    try {
      const rows = await api('/api/applications');
      const compact = rows.map((r) => ({
        id: r.id,
        job_title: r.job_title,
        company_name: r.company_name,
        status: r.status,
        applied_date: r.applied_date,
        salary_gbp: r.salary_gbp,
        work_mode: r.work_mode,
        office_days_per_week: r.office_days_per_week,
        has_resume: Boolean(r.resume_file),
        missing_skills: (r.missing_skills || []).map((s) => s.name),
        include_in_gap_stats: r.include_in_gap_stats !== false,
      }));
      return ok({ count: compact.length, applications: compact });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'get_application',
  {
    title: 'Get application',
    description: 'Get the full details of a single application by its numeric id.',
    inputSchema: { id: z.number().int().positive().describe('Application id') },
  },
  async ({ id }) => {
    try {
      return ok(await api(`/api/applications/${id}`));
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'create_application',
  {
    title: 'Create application',
    description:
      'Add a new job application to the tracker. Provide the vacancy details you gathered from the ' +
      'job description. If you have just written a tailored resume, pass it as `resume_markdown` and ' +
      'it will be converted to a .docx and attached automatically. Returns the created record (with its new id).',
    inputSchema: {
      job_title: z.string().min(1).describe('Job title / role'),
      company_name: z.string().min(1).describe('Company name'),
      job_description_link: z.string().url().optional().describe('URL of the job posting'),
      job_description_text: z.string().optional().describe('Full text of the job description'),
      salary_gbp: z.number().nonnegative().optional().describe('Salary in GBP (number only)'),
      work_mode: z.enum(WORK_MODES).optional().describe("remote | on_site | hybrid"),
      office_days_per_week: z
        .number()
        .int()
        .min(1)
        .max(7)
        .optional()
        .describe('Required only when work_mode is hybrid (1-7)'),
      status: z
        .enum(APPLICATION_STATUSES)
        .optional()
        .describe('Defaults to no_answer if omitted'),
      resume_markdown: z
        .string()
        .optional()
        .describe('Tailored resume as markdown/plain text; converted to .docx and attached'),
    },
  },
  async (args) => {
    try {
      const fd = new FormData();
      fd.append('job_title', args.job_title);
      fd.append('company_name', args.company_name);
      if (args.job_description_link) fd.append('job_description_link', args.job_description_link);
      if (args.job_description_text) fd.append('job_description_text', args.job_description_text);
      if (args.salary_gbp != null) fd.append('salary_gbp', String(args.salary_gbp));
      if (args.work_mode) {
        fd.append('work_mode', args.work_mode);
        if (args.work_mode === 'hybrid' && args.office_days_per_week != null) {
          fd.append('office_days_per_week', String(args.office_days_per_week));
        }
      }
      if (args.status) fd.append('status', args.status);

      if (args.resume_markdown && args.resume_markdown.trim()) {
        const buffer = await markdownToDocxBuffer(args.resume_markdown);
        const filename = `resume-${slugify(args.company_name)}-${slugify(args.job_title)}.docx`;
        fd.append('resume', new Blob([buffer], { type: DOCX_MIME }), filename);
      }

      const created = await api('/api/applications', { method: 'POST', body: fd });
      return ok({ message: 'Application created', application: created });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'update_status',
  {
    title: 'Update status',
    description: 'Change the status of an existing application.',
    inputSchema: {
      id: z.number().int().positive().describe('Application id'),
      status: z.enum(APPLICATION_STATUSES).describe('New status'),
    },
  },
  async ({ id, status }) => {
    try {
      const updated = await api(`/api/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return ok({ message: 'Status updated', application: updated });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'get_interview_notes',
  {
    title: 'Get interview notes',
    description:
      'Read interview notes. With an id, returns the preparation plan and live notes for that ' +
      'application. Without an id, returns the notes summary across all applications. ' +
      'Use this to help prepare for an interview.',
    inputSchema: {
      id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Application id; omit to list notes for all applications'),
    },
  },
  async ({ id }) => {
    try {
      if (id == null) return ok(await api('/api/applications/interview-notes'));
      return ok(await api(`/api/applications/${id}/interview-notes`));
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'save_interview_notes',
  {
    title: 'Save interview notes',
    description:
      'Write interview notes for an application. Only the fields you pass are changed; the other ' +
      'field is preserved. Use preparation_plan for a prep plan you built, live_notes for bullets.',
    inputSchema: {
      id: z.number().int().positive().describe('Application id'),
      preparation_plan: z.string().optional().describe('Markdown prep plan (leave out to keep existing)'),
      live_notes: z.string().optional().describe('Markdown live notes (leave out to keep existing)'),
    },
  },
  async ({ id, preparation_plan, live_notes }) => {
    try {
      // Merge: fetch current so we never wipe the field we aren't editing.
      const current = await api(`/api/applications/${id}/interview-notes`);
      const payload = {
        preparation_plan:
          preparation_plan != null ? preparation_plan : current.preparation_plan || '',
        live_notes: live_notes != null ? live_notes : current.live_notes || '',
      };
      const saved = await api(`/api/applications/${id}/interview-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return ok({ message: 'Notes saved', notes: saved });
    } catch (err) {
      return fail(err.message);
    }
  },
);

/* ---------------------------------------------------------------- skill gap */

server.registerTool(
  'get_missing_skills',
  {
    title: 'Get missing skills',
    description:
      'Get the skills/requirements recorded as missing (skill gaps) for one application.',
    inputSchema: { id: z.number().int().positive().describe('Application id') },
  },
  async ({ id }) => {
    try {
      const skills = await api(`/api/applications/${id}/missing-skills`);
      return ok({ application_id: id, missing_skills: skills.map((s) => s.name) });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'set_missing_skills',
  {
    title: 'Set missing skills',
    description:
      'Record the skills/requirements from a job description that the user does NOT have, for one ' +
      'application. Mode "add" (default) merges with what is already saved and never removes anything; ' +
      '"remove" deletes the listed skills (use the names exactly as get_missing_skills returns them); ' +
      '"replace" overwrites the whole list (only when the user asks). Each skill counts once per ' +
      'application in the stats, and aliases such as "Amazon Web Services" merge into "AWS" automatically. ' +
      'Confirm the list with the user before saving: only they know which requirements they actually lack.',
    inputSchema: {
      id: z.number().int().positive().describe('Application id'),
      skills: z
        .array(z.string().min(1).max(80))
        .max(100)
        .describe('Skill names, e.g. ["AWS", "Kubernetes"]'),
      mode: z
        .enum(['add', 'remove', 'replace'])
        .optional()
        .describe('add (default) | remove | replace'),
    },
  },
  async ({ id, skills, mode = 'add' }) => {
    try {
      let next = skills;
      if (mode !== 'replace') {
        const current = (await api(`/api/applications/${id}/missing-skills`)).map((s) => s.name);
        if (mode === 'add') {
          next = [...current, ...skills]; // backend de-duplicates and resolves aliases
        } else {
          const toRemove = new Set(skills.map((s) => s.trim().toLowerCase()));
          next = current.filter((name) => !toRemove.has(name.toLowerCase()));
        }
      }
      const saved = await api(`/api/applications/${id}/missing-skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: next }),
      });
      return ok({
        message: 'Missing skills saved',
        application_id: id,
        missing_skills: saved.map((s) => s.name),
      });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'set_gap_stats_inclusion',
  {
    title: 'Include or exclude from skill gap stats',
    description:
      'Include or exclude an application from the skill gap ranking, e.g. exclude a random ' +
      'low-interest application so it does not skew the stats. Other fields are left unchanged.',
    inputSchema: {
      id: z.number().int().positive().describe('Application id'),
      include: z.boolean().describe('true to include, false to exclude'),
    },
  },
  async ({ id, include }) => {
    try {
      // The tracker changes this flag through its full edit endpoint, so resend
      // every field's current value to leave the rest of the application as it is.
      const app = await api(`/api/applications/${id}`);
      const fd = new FormData();
      fd.append('job_title', app.job_title);
      fd.append('company_name', app.company_name);
      if (app.job_description_link) fd.append('job_description_link', app.job_description_link);
      fd.append('job_description_text', app.job_description_text || '');
      fd.append('salary_gbp', app.salary_gbp == null ? '' : String(app.salary_gbp));
      if (app.work_mode) {
        fd.append('work_mode', app.work_mode);
        if (app.work_mode === 'hybrid' && app.office_days_per_week != null) {
          fd.append('office_days_per_week', String(app.office_days_per_week));
        }
      }
      fd.append('status', app.status);
      fd.append('include_in_gap_stats', include ? 'true' : 'false');

      const updated = await api(`/api/applications/${id}`, { method: 'PUT', body: fd });
      return ok({
        message: include ? 'Included in skill gap stats' : 'Excluded from skill gap stats',
        application_id: id,
        include_in_gap_stats: updated.include_in_gap_stats,
      });
    } catch (err) {
      return fail(err.message);
    }
  },
);

server.registerTool(
  'get_skill_gap_stats',
  {
    title: 'Get skill gap stats',
    description:
      'Ranked list of the skills the user is most often missing across applications (#1 = missing in ' +
      'the most applications). Each skill counts once per application. percentage = count / ' +
      'total_applications, where total_applications counts only included applications that have at ' +
      'least one missing skill recorded (not all applications). Use it to suggest what to learn next.',
    inputSchema: {
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Return only the top N skills (default: all)'),
    },
  },
  async ({ limit }) => {
    try {
      const stats = await api('/api/skills/gap-stats');
      return ok({
        ...stats,
        skills: limit ? stats.skills.slice(0, limit) : stats.skills,
      });
    } catch (err) {
      return fail(err.message);
    }
  },
);

/* ----------------------------------------------------------------- bootstrap */

const transport = new StdioServerTransport();
await server.connect(transport);
// Never write to stdout — stdio transport uses it. Logs go to stderr.
console.error(`[job-tracker-mcp] connected. API base: ${BASE}`);