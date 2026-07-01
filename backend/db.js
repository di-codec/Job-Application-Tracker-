import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'applications.db');

const db = new Database(dbPath);

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

export default db;
