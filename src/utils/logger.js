const winston = require('winston');
const path = require('path');

// 로그 레벨 설정
const logLevel = process.env.LOG_LEVEL || 'info';

// 로그 포맷 설정
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 콘솔 포맷 설정
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Vercel/Serverless 환경에서는 파일 시스템이 읽기 전용이므로 콘솔 출력만 사용
const isServerless = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true';

const baseTransports = [];

if (isServerless) {
  baseTransports.push(new winston.transports.Console({ format: consoleFormat }));
} else {
  baseTransports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

// 로거 생성
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'tax-automation' },
  transports: baseTransports,
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== 'production' && !isServerless) {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 프로덕션 환경에서는 로그 레벨을 warn으로 설정
if (process.env.NODE_ENV === 'production') {
  logger.level = 'warn';
}

// 보안 로그 전용 로거
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'security' },
  transports: isServerless
    ? [new winston.transports.Console({ format: consoleFormat })]
    : [
        new winston.transports.File({
          filename: path.join('logs', 'security.log'),
          maxsize: 5242880,
          maxFiles: 10,
        }),
      ],
});

// 감사 로그 전용 로거
const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'audit' },
  transports: isServerless
    ? [new winston.transports.Console({ format: consoleFormat })]
    : [
        new winston.transports.File({
          filename: path.join('logs', 'audit.log'),
          maxsize: 10485760,
          maxFiles: 20,
        }),
      ],
});

// 로그 헬퍼 함수들
const logSecurity = (message, meta = {}) => {
  securityLogger.info(message, {
    ...meta,
    timestamp: new Date().toISOString(),
    ip: meta.ip || 'unknown',
    userAgent: meta.userAgent || 'unknown'
  });
};

const logAudit = (action, resourceType, resourceId, userId, meta = {}) => {
  auditLogger.info('Audit Log', {
    action,
    resourceType,
    resourceId,
    userId,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

const logError = (error, meta = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...meta
  });
};

const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

module.exports = {
  logger,
  securityLogger,
  auditLogger,
  logSecurity,
  logAudit,
  logError,
  logInfo,
  logWarn,
  logDebug
};

