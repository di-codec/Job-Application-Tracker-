import { Router } from 'express';
import db from '../db.js';
import { normalizeSkillKey } from '../skills.js';

// Mounted at /api/skills
const router = Router();

// Autocomplete: known skills with the number of applications they are missing in.
const selectSkills = db.prepare(`
  SELECT s.id, s.name, COUNT(ams.application_id) AS application_count
  FROM skills s
  LEFT JOIN application_missing_skills ams ON ams.skill_id = s.id
  WHERE s.name_key LIKE ? ESCAPE '\\'
  GROUP BY s.id
  ORDER BY application_count DESC, s.name COLLATE NOCASE
  LIMIT ?
`);

// Denominator: included applications that have at least one missing skill
// recorded ("applications where gaps were marked"), not all applications.
const selectAnalysedApplicationCount = db.prepare(`
  SELECT COUNT(DISTINCT ams.application_id) AS total
  FROM application_missing_skills ams
  JOIN applications a ON a.id = ams.application_id
  WHERE a.include_in_gap_stats = 1
`);

const selectGapStats = db.prepare(`
  SELECT s.id, s.name, COUNT(DISTINCT ams.application_id) AS count
  FROM application_missing_skills ams
  JOIN applications a ON a.id = ams.application_id
  JOIN skills s ON s.id = ams.skill_id
  WHERE a.include_in_gap_stats = 1
  GROUP BY s.id
  ORDER BY count DESC, s.name COLLATE NOCASE
`);

const selectExcludedApplicationCount = db.prepare(`
  SELECT COUNT(*) AS total FROM applications WHERE include_in_gap_stats = 0
`);

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

router.get('/', (req, res) => {
  const query = typeof req.query.q === 'string' ? normalizeSkillKey(req.query.q) : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  res.json(selectSkills.all(`%${escapeLike(query)}%`, limit));
});

router.get('/gap-stats', (_req, res) => {
  const total = selectAnalysedApplicationCount.get().total;
  const skills = selectGapStats.all().map((row, index) => ({
    rank: index + 1,
    ...row,
    percentage: total ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));

  res.json({
    total_applications: total,
    excluded_applications: selectExcludedApplicationCount.get().total,
    skills,
  });
});

export default router;
