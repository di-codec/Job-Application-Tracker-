import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createRequire } from 'module';
import './db.js';
import { ensureDataDirs } from './paths.js';
import applicationsRouter from './routes/applications.js';

// caxa bundles can break iconv-lite's lazy require("../encodings").
// Preload it so packaged Express JSON parsing still works when needed.
const require = createRequire(import.meta.url);
try {
  require('iconv-lite/encodings');
} catch {
  // Manual JSON parser below still covers status updates.
}

ensureDataDirs();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

function parseJsonBody(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return next();
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      req.body = raw ? JSON.parse(raw) : {};
      next();
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
    }
  });
  req.on('error', (error) => next(error));
}

app.use(cors());
// Avoid body-parser/iconv-lite in the packaged sidecar (breaks status updates).
app.use(parseJsonBody);
app.use('/api/applications', applicationsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Job Application Tracker API' });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend running at http://${HOST}:${PORT}`);
});
