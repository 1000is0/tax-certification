const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { logError } = require('./utils/logger');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', apiRoutes);

// Serve React build locally and on platforms that don't handle static routing
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 404 handler for API only (static handled by platform)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.', code: 'NOT_FOUND' });
});

app.use((error, req, res, next) => {
  logError(error, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({ error: error.message, stack: error.stack, code: 'INTERNAL_SERVER_ERROR' });
  }
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.', code: 'INTERNAL_SERVER_ERROR' });
});

module.exports = app;


