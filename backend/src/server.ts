import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectToDatabase } from './utils/db.js';
import { ensureDefaultAdmin } from './utils/auth.js';
import { getScreenshotsDir } from './utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const sessionOptions: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' },
};
if (process.env.MONGO_URI) {
  try {
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      dbName: process.env.MONGO_DB,
    });
  } catch {
    console.warn('Mongo session store init failed, using memory store');
  }
}
app.use(session(sessionOptions));

// Static screenshots folder (with cache headers)
app.use(
  '/screenshots',
  express.static(getScreenshotsDir(), {
    maxAge: '1h',
    etag: true,
    index: false,
  }),
);

// API routes
app.use('/', router);

// Health
app.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'pong' });
});

// Error handler
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);

async function start() {
  try {
    await connectToDatabase();
    await ensureDefaultAdmin();
    console.log('Successfully connected to MongoDB and created default admin');
  } catch (err) {
    // Continue even if DB not available for initial scaffolding
    console.warn('MongoDB connection failed, continuing in stub mode');
  }
  app.listen(PORT, () => {
    /* eslint-disable no-console */
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

start();
