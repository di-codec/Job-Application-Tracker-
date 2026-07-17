import { isTauri } from '@tauri-apps/api/core';

const API_PORT = 3001;

export function getApiBase() {
  if (isTauri() && import.meta.env.PROD) {
    return `http://127.0.0.1:${API_PORT}`;
  }
  return '';
}

export function apiUrl(path) {
  const base = getApiBase();
  return `${base}${path}`;
}
