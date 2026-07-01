import { Router } from 'express';
import db from '../db.js';

const router = Router();

const selectAllWithApplications = db.prepare(`
  SELECT
    a.id AS application_id,
    a.job_title,
    a.company_name,
    a.status,
    a.applied_date,
    COALESCE(n.preparation_plan, '') AS preparation_plan,
    COALESCE(n.live_notes, '') AS live_notes,
    n.updated_at
  FROM applications a
  LEFT JOIN interview_notes n ON n.application_id = a.id
  ORDER BY a.applied_date DESC, a.id DESC
`);

const selectByApplicationId = db.prepare(`
  SELECT
    application_id,
    preparation_plan,
    live_notes,
    updated_at
  FROM interview_notes
  WHERE application_id = ?
`);

const selectApplicationById = db.prepare(`
  SELECT id, job_title, company_name, status, applied_date
  FROM applications
  WHERE id = ?
`);

const upsertInterviewNotes = db.prepare(`
  INSERT INTO interview_notes (application_id, preparation_plan, live_notes, updated_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(application_id) DO UPDATE SET
    preparation_plan = excluded.preparation_plan,
    live_notes = excluded.live_notes,
    updated_at = datetime('now')
`);

function emptyNotes(applicationId) {
  return {
    application_id: Number(applicationId),
    preparation_plan: '',
    live_notes: '',
    updated_at: null,
  };
}

router.get('/interview-notes', (_req, res) => {
  res.json(selectAllWithApplications.all());
});

router.get('/:id/interview-notes', (req, res) => {
  const application = selectApplicationById.get(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const notes = selectByApplicationId.get(req.params.id);
  res.json(notes ?? emptyNotes(req.params.id));
});

router.put('/:id/interview-notes', (req, res) => {
  const application = selectApplicationById.get(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const preparationPlan =
    typeof req.body.preparation_plan === 'string' ? req.body.preparation_plan : '';
  const liveNotes = typeof req.body.live_notes === 'string' ? req.body.live_notes : '';

  upsertInterviewNotes.run(req.params.id, preparationPlan, liveNotes);
  const notes = selectByApplicationId.get(req.params.id);
  res.json(notes);
});

export default router;
