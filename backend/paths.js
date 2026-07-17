import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getDataRoot() {
  if (process.env.JOB_TRACKER_DATA_DIR) {
    return process.env.JOB_TRACKER_DATA_DIR;
  }
  return path.join(__dirname, '..');
}

export function getDbPath() {
  if (process.env.JOB_TRACKER_DATA_DIR) {
    return path.join(process.env.JOB_TRACKER_DATA_DIR, 'applications.db');
  }
  return path.join(__dirname, 'data', 'applications.db');
}

export function getUploadsDir() {
  if (process.env.JOB_TRACKER_DATA_DIR) {
    return path.join(process.env.JOB_TRACKER_DATA_DIR, 'uploads');
  }
  return path.join(__dirname, 'uploads');
}

export function ensureDataDirs() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(getUploadsDir(), { recursive: true });
}

export function getDataRootDir() {
  return getDataRoot();
}
