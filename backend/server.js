import express from 'express';
import cors from 'cors';
import multer from 'multer';
import './db.js';
import { ensureDataDirs } from './paths.js';
import applicationsRouter from './routes/applications.js';

ensureDataDirs();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json());
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
