import express from 'express';
import cors from 'cors';
import proxyHandler from './api/proxy.js';
import closingHandler from './api/closing.js';
import conglomeratesHandler from './api/conglomerates.js';
import dictionaryHandler from './api/dictionary.js';

const app = express();
const port = 3001;

app.use(cors());

// Shim for Vercel Request/Response in Express
const createVercelShim = (handler) => async (req, res) => {
  try {
    const originalStatus = res.status.bind(res);
    res.status = (code) => {
      originalStatus(code);
      return res;
    };
    await handler(req, res);
  } catch (err) {
    console.error('Shim error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

app.get('/api/proxy', createVercelShim(proxyHandler));
app.get('/api/closing', createVercelShim(closingHandler));
app.get('/api/conglomerates', createVercelShim(conglomeratesHandler));
app.get('/api/dictionary', createVercelShim(dictionaryHandler));

app.listen(port, () => {
  console.log(`[Local Server] Running on http://localhost:${port}`);
  console.log(`[API Endpoints] /api/conglomerates | /api/dictionary | /api/proxy | /api/closing`);
});
