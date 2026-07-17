import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import {
  ALLOWED_RESUME_EXTENSIONS,
  ALLOWED_RESUME_MIME_TYPES,
} from '../constants.js';
import { getUploadsDir } from '../paths.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${crypto.randomUUID()}${ext}`;
    cb(null, storedName);
  },
});

function isAllowedResume(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return (
    ALLOWED_RESUME_EXTENSIONS.includes(ext) &&
    ALLOWED_RESUME_MIME_TYPES.includes(file.mimetype)
  );
}

export const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedResume(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});
