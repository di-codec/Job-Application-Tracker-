import { isTauri } from '@tauri-apps/api/core';

const API_PORT = 3001;

// The bundled sidecar can take a long time to unpack on first launch
// (and after each rebuild), so be patient before giving up.
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getApiBase() {
  // In the desktop app always talk to the local API, even while the sidecar is still starting.
  if (isTauri()) {
    return `http://127.0.0.1:${API_PORT}`;
  }
  return '';
}

export function apiUrl(path) {
  return `${getApiBase()}${path}`;
}

let readyPromise = null;

async function pollHealth() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // API not listening yet.
    }
    await sleep(READY_POLL_MS);
  }
  throw new Error('Local API did not start. Try restarting the app.');
}

/** Resolves once the local backend answers /api/health. Shared across callers. */
export function waitForApi() {
  if (!isTauri()) return Promise.resolve();
  if (!readyPromise) {
    readyPromise = pollHealth().catch((error) => {
      readyPromise = null; // allow a fresh attempt next time
      throw error;
    });
  }
  return readyPromise;
}

/**
 * fetch() against the local API that waits for the backend to be ready.
 * Safe (GET/HEAD) requests are retried if the connection drops, e.g. when
 * the backend is restarted by the desktop shell.
 */
export async function apiFetch(path, options = {}) {
  await waitForApi();

  const method = (options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';

  try {
    return await fetch(apiUrl(path), options);
  } catch (error) {
    if (!isTauri()) throw error;
    readyPromise = null;
    await waitForApi();
    if (!retryable) throw error;
    return fetch(apiUrl(path), options);
  }
}
