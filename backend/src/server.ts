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
import { cleanupOldScreenshots } from './controllers/screenshotController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectToDatabase } from './utils/db.js';
import { ensureDefaultAdmin } from './utils/auth.js';
import { r2Storage } from './utils/r2Storage.js';
import { validateEnvironment } from './utils/envValidation.js';
import { securityLogger } from './middleware/securityLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables before starting
validateEnvironment();

const app = express();
app.disable('x-powered-by');

// Configure CORS before Helmet to ensure headers are set correctly
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins: string[] | true = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : (isProduction ? [] : true); // In production, require explicit CORS config

if (isProduction && Array.isArray(allowedOrigins) && allowedOrigins.length === 0) {
  console.error('❌ CORS_ORIGIN is not configured. CORS requests will be blocked!');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (isProduction) {
      // In production, only allow configured origins
      if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      }
      // This shouldn't happen if validation passed, but handle it anyway
      console.error('❌ CORS_ORIGIN not configured in production!');
      return callback(new Error('CORS not configured'));
    }
    
    // In development, allow all origins
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Configure Helmet with CORS-safe settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '10mb' }));
if (!isProduction) {
  app.use(morgan('dev'));
}

// Security logging middleware
app.use(securityLogger);

// Ensure secure cookies work behind a reverse proxy (e.g., Render)
// Required when using cookie.secure=true so Express trusts X-Forwarded-* headers
app.set('trust proxy', 1);

// Session secret is validated in validateEnvironment()
// Use the value or fallback to default (only for development)
const sessionSecret = process.env.SESSION_SECRET || 'dev_secret_change_me';

const sessionOptions: session.SessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // true for HTTPS in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' needed for cross-origin cookies with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};
if (process.env.MONGO_URI) {
  try {
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      dbName: process.env.MONGO_DB,
      // Reduce write load by only touching sessions once per day.
      touchAfter: 24 * 60 * 60,
    });
  } catch {
    console.warn('Mongo session store init failed, using memory store');
  }
}
app.use(session(sessionOptions));

// Basic CSRF/origin check for cookie-authenticated unsafe requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!unsafeMethods.has(req.method)) return next();
  if (!req.session?.user) return next();

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const origin = originHeader || refererHeader;
  if (!origin) {
    return res.status(403).json({ error: 'CSRF check failed' });
  }

  if (allowedOrigins === true) return next();
  if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
    try {
      const originUrl = new URL(origin);
      const originValue = originHeader ? originHeader : originUrl.origin;
      if (allowedOrigins.includes(originValue)) {
        return next();
      }
    } catch {
      // fall through to deny
    }
  }

  return res.status(403).json({ error: 'CSRF check failed' });
});

// Screenshots are now served exclusively from Cloudflare R2
// No local filesystem storage or static file serving

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

  const cleanup = async () => {
    try {
      await cleanupOldScreenshots();
    } catch (error) {
      console.error('Daily screenshot cleanup failed:', error);
    }
  };

  cleanup();
  setInterval(cleanup, 24 * 60 * 60 * 1000);
}

start();
