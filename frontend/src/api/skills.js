import { apiFetch } from './client.js';

async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export async function getSkills() {
  const response = await apiFetch('/api/skills?limit=500');
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load skills');
  }

  return data;
}

export async function getGapStats() {
  const response = await apiFetch('/api/skills/gap-stats');
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load skill gap stats');
  }

  return data;
}

export async function updateMissingSkills(applicationId, skills) {
  const response = await apiFetch(`/api/applications/${applicationId}/missing-skills`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills }),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to save missing skills');
  }

  return data;
}
