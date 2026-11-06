import Database from 'better-sqlite3';
import { ensureDataDirs, getDbPath } from './paths.js';

ensureDataDirs();

const db = new Database(getDbPath());
// Required for ON DELETE CASCADE to work (SQLite has it off by default).
db.pragma('foreign_keys = ON');

const createTableSql = `
  CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_description_link TEXT,
    job_description_text TEXT,
    salary_gbp REAL,
    work_mode TEXT CHECK (work_mode IN ('remote', 'on_site', 'hybrid') OR work_mode IS NULL),
    office_days_per_week INTEGER,
    applied_date TEXT NOT NULL DEFAULT (date('now')),
    resume_file TEXT,
    include_in_gap_stats INTEGER NOT NULL DEFAULT 1 CHECK (include_in_gap_stats IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'no_answer' CHECK (
      status IN (
        'no_answer',
        'rejected',
        'interviewing',
        'no_offer',
        'offer',
        'accepted',
        'declined'
      )
    )
  )
`;

const tableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'applications'")
  .get();

if (!tableExists) {
  db.exec(createTableSql);
} else {
  const columns = db.prepare('PRAGMA table_info(applications)').all().map((c) => c.name);
  if (!columns.includes('job_title')) {
    db.exec('DROP TABLE applications');
    db.exec(createTableSql);
  } else {
    if (!columns.includes('salary_gbp')) {
      db.exec('ALTER TABLE applications ADD COLUMN salary_gbp REAL');
    }
    if (!columns.includes('work_mode')) {
      db.exec('ALTER TABLE applications ADD COLUMN work_mode TEXT');
    }
    if (!columns.includes('office_days_per_week')) {
      db.exec('ALTER TABLE applications ADD COLUMN office_days_per_week INTEGER');
    }
    if (!columns.includes('include_in_gap_stats')) {
      db.exec(
        'ALTER TABLE applications ADD COLUMN include_in_gap_stats INTEGER NOT NULL DEFAULT 1 CHECK (include_in_gap_stats IN (0, 1))',
      );
    }
  }
}

const interviewNotesTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'interview_notes'")
  .get();

if (!interviewNotesTableExists) {
  db.exec(`
    CREATE TABLE interview_notes (
      application_id INTEGER PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
      preparation_plan TEXT NOT NULL DEFAULT '',
      live_notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// Skill gap analysis: one row per (application, missing skill), so a skill
// counts at most once per application.
db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS application_missing_skills (
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (application_id, skill_id)
  );

  CREATE INDEX IF NOT EXISTS idx_application_missing_skills_skill
    ON application_missing_skills (skill_id);
`);

export default db;
