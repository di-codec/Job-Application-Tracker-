async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export async function getInterviewNotesList() {
  const response = await fetch('/api/applications/interview-notes');
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load interview notes');
  }

  return data;
}

export async function getInterviewNotes(applicationId) {
  const response = await fetch(`/api/applications/${applicationId}/interview-notes`);
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load interview notes');
  }

  return data;
}

export async function saveInterviewNotes(applicationId, { preparationPlan, liveNotes }) {
  const response = await fetch(`/api/applications/${applicationId}/interview-notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preparation_plan: preparationPlan,
      live_notes: liveNotes,
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to save interview notes');
  }

  return data;
}
