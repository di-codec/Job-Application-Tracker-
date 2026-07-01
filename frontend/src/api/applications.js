async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export async function getApplications() {
  const response = await fetch('/api/applications');
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load applications');
  }

  return data;
}

export async function createApplication(formData) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    body: formData,
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to save application');
  }

  return data;
}

export async function updateApplicationStatus(id, status) {
  const response = await fetch(`/api/applications/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update status');
  }

  return data;
}

export async function updateApplication(id, formData) {
  const response = await fetch(`/api/applications/${id}`, {
    method: 'PUT',
    body: formData,
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update application');
  }

  return data;
}

export async function deleteApplication(id) {
  const response = await fetch(`/api/applications/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    throw new Error(data.error || 'Failed to delete application');
  }
}

export function getResumeUrl(id, inline = false) {
  const url = `/api/applications/${id}/resume`;
  return inline ? `${url}?inline=1` : url;
}
