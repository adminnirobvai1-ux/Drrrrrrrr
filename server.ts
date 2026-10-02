import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8955426078:AAFyefL1ul-qt6HtYhFOhuQVIW4_k47R7Pw';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://gsgssnn-580ca-default-rtdb.firebaseio.com';
const WINGO_API_URL = process.env.WINGO_API_URL || 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper for timed fetch
  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // 1. API: Proxy live WinGo history (bypasses browser CORS)
  app.get('/api/wingo/history', async (_req: Request, res: Response) => {
    try {
      const resp = await fetchWithTimeout(WINGO_API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      }, 6000);

      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: `API status ${resp.status}` });
      }

      const raw: any = await resp.json();
      const list = raw?.data?.list || (Array.isArray(raw?.data) ? raw.data : []);
      return res.json({ success: true, list, serverTime: raw?.serviceTime || Date.now() });
    } catch (err: any) {
      console.warn('Proxy fetch failed:', err?.message);
      return res.status(502).json({ success: false, error: err?.message || 'Failed to fetch from WinGo API' });
    }
  });

  // 2. API: Telegram Bot Status Check
  app.get('/api/telegram/status', async (_req: Request, res: Response) => {
    try {
      const resp = await fetchWithTimeout(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`, {}, 5000);
      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message });
    }
  });

  // 3. API: Dispatch test Telegram message
  app.post('/api/telegram/broadcast', async (req: Request, res: Response) => {
    try {
      const { text, chatId } = req.body;
      if (!text) {
        return res.status(400).json({ ok: false, error: 'Text message required' });
      }
      if (!chatId) {
        return res.status(400).json({ ok: false, error: 'Chat ID is required to send Telegram message' });
      }

      const resp = await fetchWithTimeout(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      }, 6000);

      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message });
    }
  });

  // 4. API: Read Firebase RTDB Current Prediction
  app.get('/api/firebase/current', async (_req: Request, res: Response) => {
    try {
      const resp = await fetchWithTimeout(`${FIREBASE_DATABASE_URL}/current_prediction.json`, {}, 5000);
      if (resp.ok) {
        const data = await resp.json();
        return res.json({ success: true, data });
      }
      return res.status(resp.status).json({ success: false, error: 'Firebase fetch failed' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 5. API: Direct Sync to Firebase RTDB
  app.post('/api/firebase/sync', async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const resp = await fetchWithTimeout(`${FIREBASE_DATABASE_URL}/current_prediction.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 5000);
      if (resp.ok) {
        const data = await resp.json();
        return res.json({ success: true, data });
      }
      return res.status(resp.status).json({ success: false, error: 'Firebase sync failed' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Setup Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
