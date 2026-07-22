import express from 'express';
import cors from 'cors';
import proxyHandler from './api/proxy.js';
import closingHandler from './api/closing.js';

const app = express();
const port = 3001;

app.use(cors());

// Shim for Vercel Request/Response in Express
const createVercelShim = (handler) => async (req, res) => {
  try {
    // Basic shim for res.status().json()
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

app.listen(port, () => {
  console.log(`[Local Server] Running on http://localhost:${port}`);
});
