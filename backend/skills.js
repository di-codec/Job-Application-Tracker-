import db from './db.js';

export const MAX_SKILL_NAME_LENGTH = 80;
export const MAX_SKILLS_PER_APPLICATION = 100;

/**
 * Known aliases → canonical display name. Keys are normalised skill keys
 * (see normalizeSkillKey). The canonical name's own key should map to itself
 * so the display casing is consistent no matter how it was typed.
 */
const SKILL_ALIASES = {
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  'google cloud platform': 'GCP',
  azure: 'Azure',
  'microsoft azure': 'Azure',
  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  node: 'Node.js',
  'react.js': 'React',
  reactjs: 'React',
  react: 'React',
  'vue.js': 'Vue',
  vuejs: 'Vue',
  vue: 'Vue',
  angular: 'Angular',
  angularjs: 'Angular',
  python: 'Python',
  py: 'Python',
  golang: 'Go',
  go: 'Go',
  'c#': 'C#',
  csharp: 'C#',
  'c sharp': 'C#',
  'c++': 'C++',
  cpp: 'C++',
  '.net': '.NET',
  dotnet: '.NET',
  'asp.net': 'ASP.NET',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  docker: 'Docker',
  terraform: 'Terraform',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  psql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  sql: 'SQL',
  nosql: 'NoSQL',
  graphql: 'GraphQL',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  rest: 'REST APIs',
  restful: 'REST APIs',
  'restful api': 'REST APIs',
  'restful apis': 'REST APIs',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  'ci cd': 'CI/CD',
  git: 'Git',
  linux: 'Linux',
  'machine learning': 'Machine Learning',
  ml: 'Machine Learning',
  'artificial intelligence': 'AI',
  ai: 'AI',
  llm: 'LLMs',
  llms: 'LLMs',
  excel: 'Excel',
  'microsoft excel': 'Excel',
  'ms excel': 'Excel',
  'power bi': 'Power BI',
  powerbi: 'Power BI',
  tableau: 'Tableau',
  agile: 'Agile',
  scrum: 'Scrum',
  jira: 'Jira',
  figma: 'Figma',
  'ux design': 'UX Design',
  ux: 'UX Design',
  'ui design': 'UI Design',
  ui: 'UI Design',
};

const LEADING_JUNK = /^[\s"'`()[\]{}\-–—•*,;:]+/;
// Trailing "." is stripped ("Node.js." → "Node.js"), but "+" and "#" are kept (C++, C#).
const TRAILING_JUNK = /[\s"'`()[\]{}\-–—•*,;:!?.]+$/;

/** Cleans user input into a display name; returns '' if nothing is left. */
export function cleanSkillName(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(LEADING_JUNK, '')
    .replace(TRAILING_JUNK, '')
    .trim();
}

/** Key used for de-duplication: cleaned, lower-cased. */
export function normalizeSkillKey(raw) {
  return cleanSkillName(raw).toLowerCase();
}

/** Resolves aliases; returns { key, name } for the canonical skill, or null if empty. */
export function canonicalizeSkill(raw) {
  const name = cleanSkillName(raw);
  if (!name) return null;

  const key = name.toLowerCase();
  const canonicalName = SKILL_ALIASES[key];
  if (canonicalName) {
    return { key: canonicalName.toLowerCase(), name: canonicalName };
  }
  return { key, name };
}

const selectSkillByKey = db.prepare('SELECT id, name FROM skills WHERE name_key = ?');
const insertSkill = db.prepare('INSERT INTO skills (name, name_key) VALUES (?, ?)');

const selectMissingSkillsForApplication = db.prepare(`
  SELECT s.id, s.name
  FROM application_missing_skills ams
  JOIN skills s ON s.id = ams.skill_id
  WHERE ams.application_id = ?
  ORDER BY s.name COLLATE NOCASE
`);

const selectAllMissingSkills = db.prepare(`
  SELECT ams.application_id, s.id, s.name
  FROM application_missing_skills ams
  JOIN skills s ON s.id = ams.skill_id
  ORDER BY s.name COLLATE NOCASE
`);

const deleteMissingSkillsForApplication = db.prepare(
  'DELETE FROM application_missing_skills WHERE application_id = ?',
);
const insertMissingSkill = db.prepare(
  'INSERT OR IGNORE INTO application_missing_skills (application_id, skill_id) VALUES (?, ?)',
);
const deleteUnusedSkills = db.prepare(`
  DELETE FROM skills
  WHERE id NOT IN (SELECT skill_id FROM application_missing_skills)
`);

function findOrCreateSkill({ key, name }) {
  const existing = selectSkillByKey.get(key);
  if (existing) return existing;
  const result = insertSkill.run(name, key);
  return { id: Number(result.lastInsertRowid), name };
}

export function getMissingSkills(applicationId) {
  return selectMissingSkillsForApplication.all(applicationId);
}

/** Map of application_id → [{ id, name }] for all applications. */
export function getMissingSkillsByApplication() {
  const map = new Map();
  for (const row of selectAllMissingSkills.all()) {
    if (!map.has(row.application_id)) map.set(row.application_id, []);
    map.get(row.application_id).push({ id: row.id, name: row.name });
  }
  return map;
}

/**
 * Validates a list of raw skill names. Returns { skills: [{key, name}] }
 * de-duplicated by canonical key, or { error }.
 */
export function parseSkillList(value) {
  if (!Array.isArray(value)) {
    return { error: 'skills must be an array of strings' };
  }
  if (value.length > MAX_SKILLS_PER_APPLICATION) {
    return { error: `At most ${MAX_SKILLS_PER_APPLICATION} skills per application` };
  }

  const byKey = new Map();
  for (const raw of value) {
    if (typeof raw !== 'string') {
      return { error: 'skills must be an array of strings' };
    }
    const skill = canonicalizeSkill(raw);
    if (!skill) continue;
    if (skill.name.length > MAX_SKILL_NAME_LENGTH) {
      return { error: `Skill names must be at most ${MAX_SKILL_NAME_LENGTH} characters` };
    }
    if (!byKey.has(skill.key)) byKey.set(skill.key, skill);
  }

  return { skills: [...byKey.values()] };
}

/** Replaces the application's missing skills; drops skills no longer used anywhere. */
export const replaceMissingSkills = db.transaction((applicationId, skills) => {
  deleteMissingSkillsForApplication.run(applicationId);
  for (const skill of skills) {
    const { id } = findOrCreateSkill(skill);
    insertMissingSkill.run(applicationId, id);
  }
  deleteUnusedSkills.run();
  return getMissingSkills(applicationId);
});

/** Removes skills that are no longer linked to any application (e.g. after a delete). */
export function pruneUnusedSkills() {
  deleteUnusedSkills.run();
}
