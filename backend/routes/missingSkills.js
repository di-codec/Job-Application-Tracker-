import { Router } from 'express';
import db from '../db.js';
import { getMissingSkills, parseSkillList, replaceMissingSkills } from '../skills.js';

// Mounted inside the applications router: /api/applications/:id/missing-skills
const router = Router();

const selectApplicationById = db.prepare('SELECT id FROM applications WHERE id = ?');

router.get('/:id/missing-skills', (req, res) => {
  if (!selectApplicationById.get(req.params.id)) {
    return res.status(404).json({ error: 'Application not found' });
  }
  res.json(getMissingSkills(req.params.id));
});

// Replaces the full list: { skills: ["AWS", "Kubernetes"] }
router.put('/:id/missing-skills', (req, res) => {
  if (!selectApplicationById.get(req.params.id)) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const parsed = parseSkillList(req.body?.skills);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  res.json(replaceMissingSkills(Number(req.params.id), parsed.skills));
});

export default router;
