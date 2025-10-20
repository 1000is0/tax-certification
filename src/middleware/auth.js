const jwtService = require('../utils/jwt');
const { logSecurity, logAudit } = require('../utils/logger');

// JWT 토큰 인증 미들웨어
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logSecurity('Authentication failed: No token provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      return res.status(401).json({ 
        error: '액세스 토큰이 필요합니다.',
        code: 'TOKEN_REQUIRED'
      });
    }

    // 토큰 검증
    const decoded = jwtService.verifyAccessToken(token);
    
    // 요청 객체에 사용자 정보 추가
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    logSecurity('Authentication successful', {
      userId: decoded.userId,
      email: decoded.email,
      ip: req.ip,
      path: req.path
    });

    next();
  } catch (error) {
    logSecurity('Authentication failed: Invalid token', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(401).json({ 
      error: error.message,
      code: 'INVALID_TOKEN'
    });
  }
};

// 역할 기반 인증 미들웨어
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: '인증이 필요합니다.',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logSecurity('Authorization failed: Insufficient role', {
        userId: req.user.userId,
        userRole,
        requiredRoles: allowedRoles,
        ip: req.ip,
        path: req.path
      });

      return res.status(403).json({ 
        error: '접근 권한이 없습니다.',
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
};

// 관리자 권한 확인
const requireAdmin = requireRole('admin');

// 사용자 본인 또는 관리자 확인
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: '인증이 필요합니다.',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const userId = req.params.userId || req.body.userId;
  const isOwner = req.user.userId === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    logSecurity('Authorization failed: Not owner or admin', {
      userId: req.user.userId,
      targetUserId: userId,
      ip: req.ip,
      path: req.path
    });

    return res.status(403).json({ 
      error: '접근 권한이 없습니다.',
      code: 'INSUFFICIENT_PERMISSION'
    });
  }

  next();
};

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwtService.verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    // 토큰이 유효하지 않아도 계속 진행
    logSecurity('Optional auth failed: Invalid token', {
      error: error.message,
      ip: req.ip,
      path: req.path
    });
  }

  next();
};

// API 키 인증 미들웨어 (Make 웹훅용)
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const expectedKey = process.env.MAKE_WEBHOOK_SECRET;

  if (!apiKey || !expectedKey) {
    logSecurity('API key authentication failed: Missing key', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({ 
      error: 'API 키가 필요합니다.',
      code: 'API_KEY_REQUIRED'
    });
  }

  if (apiKey !== expectedKey) {
    logSecurity('API key authentication failed: Invalid key', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({ 
      error: '유효하지 않은 API 키입니다.',
      code: 'INVALID_API_KEY'
    });
  }

  logSecurity('API key authentication successful', {
    ip: req.ip,
    path: req.path
  });

  next();
};

// 감사 로그 미들웨어
const auditLog = (action, resourceType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // 응답 후 감사 로그 기록
      logAudit(action, resourceType, req.params.id || req.body.id, req.user?.userId, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        requestData: req.method !== 'GET' ? req.body : undefined
      });
      
      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authenticateAPIKey,
  auditLog
};

