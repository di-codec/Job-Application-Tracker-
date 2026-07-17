import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { APPLICATION_STATUSES, WORK_MODES } from '../constants.js';
import { uploadResume } from '../middleware/upload.js';
import { getUploadsDir } from '../paths.js';
import interviewNotesRouter from './interviewNotes.js';

const router = Router();

const selectAll = db.prepare(`
  SELECT
    id,
    job_title,
    company_name,
    job_description_link,
    job_description_text,
    salary_gbp,
    work_mode,
    office_days_per_week,
    applied_date,
    resume_file,
    status
  FROM applications
  ORDER BY applied_date DESC, id DESC
`);

const selectById = db.prepare(`
  SELECT
    id,
    job_title,
    company_name,
    job_description_link,
    job_description_text,
    salary_gbp,
    work_mode,
    office_days_per_week,
    applied_date,
    resume_file,
    status
  FROM applications
  WHERE id = ?
`);

const insertApplication = db.prepare(`
  INSERT INTO applications (
    job_title,
    company_name,
    job_description_link,
    job_description_text,
    salary_gbp,
    work_mode,
    office_days_per_week,
    applied_date,
    resume_file,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?)
`);

const updateStatus = db.prepare(`
  UPDATE applications
  SET status = ?
  WHERE id = ?
`);

const updateApplication = db.prepare(`
  UPDATE applications
  SET
    job_title = ?,
    company_name = ?,
    job_description_link = ?,
    job_description_text = ?,
    salary_gbp = ?,
    work_mode = ?,
    office_days_per_week = ?,
    resume_file = ?,
    status = ?
  WHERE id = ?
`);

const deleteApplication = db.prepare(`
  DELETE FROM applications
  WHERE id = ?
`);

function parseResumeFile(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatApplication(row) {
  if (!row) return null;
  return {
    ...row,
    resume_file: parseResumeFile(row.resume_file),
  };
}

function removeUploadedFile(storedName) {
  if (!storedName) return;
  const filePath = path.join(getUploadsDir(), storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function parseSalaryGbp(value) {
  if (value === undefined || value === null || value === '') {
    return { salary: null };
  }

  const salary = Number(value);
  if (Number.isNaN(salary) || salary < 0) {
    return { error: 'salary_gbp must be a non-negative number' };
  }

  return { salary };
}

function parseWorkMode(workMode, officeDaysPerWeek) {
  if (workMode === undefined || workMode === null || workMode === '') {
    return { workMode: null, officeDaysPerWeek: null };
  }

  if (!WORK_MODES.includes(workMode)) {
    return { error: `work_mode must be one of: ${WORK_MODES.join(', ')}` };
  }

  if (workMode === 'hybrid') {
    if (officeDaysPerWeek === undefined || officeDaysPerWeek === '') {
      return { error: 'office_days_per_week is required for hybrid work mode' };
    }

    const days = Number(officeDaysPerWeek);
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return { error: 'office_days_per_week must be an integer from 1 to 7' };
    }

    return { workMode, officeDaysPerWeek: days };
  }

  return { workMode, officeDaysPerWeek: null };
}

router.post('/', uploadResume.single('resume'), (req, res) => {
  const {
    job_title,
    company_name,
    job_description_link,
    job_description_text,
    salary_gbp,
    work_mode,
    office_days_per_week,
    status,
  } = req.body;

  if (!job_title?.trim() || !company_name?.trim()) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: 'job_title and company_name are required' });
  }

  if (status && !APPLICATION_STATUSES.includes(status)) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({
      error: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
    });
  }

  const parsedSalary = parseSalaryGbp(salary_gbp);
  if (parsedSalary.error) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: parsedSalary.error });
  }

  const parsedWorkMode = parseWorkMode(work_mode, office_days_per_week);
  if (parsedWorkMode.error) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: parsedWorkMode.error });
  }

  let resumeFile = null;
  if (req.file) {
    resumeFile = JSON.stringify({
      storedName: req.file.filename,
      originalName: req.file.originalname,
    });
  }

  const result = insertApplication.run(
    job_title.trim(),
    company_name.trim(),
    job_description_link?.trim() || null,
    job_description_text?.trim() || null,
    parsedSalary.salary,
    parsedWorkMode.workMode,
    parsedWorkMode.officeDaysPerWeek,
    resumeFile,
    status || 'no_answer',
  );

  const application = formatApplication(selectById.get(result.lastInsertRowid));
  res.status(201).json(application);
});

router.get('/', (_req, res) => {
  const applications = selectAll.all().map(formatApplication);
  res.json(applications);
});

router.use(interviewNotesRouter);

router.get('/:id', (req, res) => {
  const application = formatApplication(selectById.get(req.params.id));
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  res.json(application);
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;

  if (!status || !APPLICATION_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
    });
  }

  const existing = selectById.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found' });
  }

  updateStatus.run(status, req.params.id);
  const application = formatApplication(selectById.get(req.params.id));
  res.json(application);
});

router.put('/:id', uploadResume.single('resume'), (req, res) => {
  const {
    job_title,
    company_name,
    job_description_link,
    job_description_text,
    salary_gbp,
    work_mode,
    office_days_per_week,
    status,
  } = req.body;

  const existing = selectById.get(req.params.id);
  if (!existing) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(404).json({ error: 'Application not found' });
  }

  if (!job_title?.trim() || !company_name?.trim()) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: 'job_title and company_name are required' });
  }

  if (status && !APPLICATION_STATUSES.includes(status)) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({
      error: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
    });
  }

  const parsedSalary = parseSalaryGbp(salary_gbp);
  if (parsedSalary.error) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: parsedSalary.error });
  }

  const parsedWorkMode = parseWorkMode(work_mode, office_days_per_week);
  if (parsedWorkMode.error) {
    if (req.file) removeUploadedFile(req.file.filename);
    return res.status(400).json({ error: parsedWorkMode.error });
  }

  let resumeFile = existing.resume_file;
  if (req.file) {
    const previousResume = parseResumeFile(existing.resume_file);
    if (previousResume?.storedName) {
      removeUploadedFile(previousResume.storedName);
    }
    resumeFile = JSON.stringify({
      storedName: req.file.filename,
      originalName: req.file.originalname,
    });
  }

  updateApplication.run(
    job_title.trim(),
    company_name.trim(),
    job_description_link?.trim() || null,
    job_description_text?.trim() || null,
    parsedSalary.salary,
    parsedWorkMode.workMode,
    parsedWorkMode.officeDaysPerWeek,
    resumeFile,
    status || existing.status,
    req.params.id,
  );

  const application = formatApplication(selectById.get(req.params.id));
  res.json(application);
});

router.delete('/:id', (req, res) => {
  const existing = selectById.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const resume = parseResumeFile(existing.resume_file);
  if (resume?.storedName) {
    removeUploadedFile(resume.storedName);
  }

  deleteApplication.run(req.params.id);
  res.status(204).send();
});

router.get('/:id/resume', (req, res) => {
  const application = selectById.get(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const resume = parseResumeFile(application.resume_file);
  if (!resume?.storedName) {
    return res.status(404).json({ error: 'Resume not found for this application' });
  }

  const filePath = path.join(getUploadsDir(), resume.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Resume file not found on disk' });
  }

  const ext = path.extname(resume.originalName).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  if (req.query.inline === '1') {
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(resume.originalName)}"`,
    );
    return res.sendFile(filePath);
  }

  res.download(filePath, resume.originalName);
});

export default router;
