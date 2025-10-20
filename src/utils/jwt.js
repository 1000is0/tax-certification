const jwt = require('jsonwebtoken');
const { logError, logSecurity } = require('./logger');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshExpiresIn = '7d';
    
    if (!this.secret) {
      throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
    }
  }

  // 액세스 토큰 생성
  generateAccessToken(payload) {
    try {
      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        type: 'access'
      };

      const token = jwt.sign(tokenPayload, this.secret, {
        expiresIn: this.expiresIn,
        issuer: 'tax-automation',
        audience: 'tax-automation-users'
      });

      logSecurity('Access token generated', { userId: payload.userId });
      return token;
    } catch (error) {
      logError(error, { operation: 'generateAccessToken' });
      throw new Error('액세스 토큰 생성 중 오류가 발생했습니다.');
    }
  }

  // 리프레시 토큰 생성
  generateRefreshToken(payload) {
    try {
      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        type: 'refresh'
      };

      const token = jwt.sign(tokenPayload, this.secret, {
        expiresIn: this.refreshExpiresIn,
        issuer: 'tax-automation',
        audience: 'tax-automation-users'
      });

      logSecurity('Refresh token generated', { userId: payload.userId });
      return token;
    } catch (error) {
      logError(error, { operation: 'generateRefreshToken' });
      throw new Error('리프레시 토큰 생성 중 오류가 발생했습니다.');
    }
  }

  // 토큰 쌍 생성 (액세스 + 리프레시)
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.expiresIn
    };
  }

  // 토큰 검증
  verifyToken(token, type = 'access') {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'tax-automation',
        audience: 'tax-automation-users'
      });

      if (decoded.type !== type) {
        throw new Error(`잘못된 토큰 타입: ${decoded.type}`);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logSecurity('Token expired', { token: token.substring(0, 20) + '...' });
        throw new Error('토큰이 만료되었습니다.');
      } else if (error.name === 'JsonWebTokenError') {
        logSecurity('Invalid token', { token: token.substring(0, 20) + '...' });
        throw new Error('유효하지 않은 토큰입니다.');
      } else {
        logError(error, { operation: 'verifyToken' });
        throw new Error('토큰 검증 중 오류가 발생했습니다.');
      }
    }
  }

  // 액세스 토큰 검증
  verifyAccessToken(token) {
    return this.verifyToken(token, 'access');
  }

  // 리프레시 토큰 검증
  verifyRefreshToken(token) {
    return this.verifyToken(token, 'refresh');
  }

  // 토큰에서 사용자 정보 추출
  extractUserFromToken(token) {
    try {
      const decoded = this.verifyAccessToken(token);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } catch (error) {
      logError(error, { operation: 'extractUserFromToken' });
      throw error;
    }
  }

  // 토큰 갱신
  refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // 새로운 액세스 토큰 생성
      const newAccessToken = this.generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });

      logSecurity('Token refreshed', { userId: decoded.userId });
      return newAccessToken;
    } catch (error) {
      logError(error, { operation: 'refreshAccessToken' });
      throw new Error('토큰 갱신 중 오류가 발생했습니다.');
    }
  }

  // 토큰 블랙리스트 관리 (선택적)
  blacklistToken(token) {
    // 실제 구현에서는 Redis나 데이터베이스에 블랙리스트 저장
    logSecurity('Token blacklisted', { token: token.substring(0, 20) + '...' });
  }

  // 토큰이 블랙리스트에 있는지 확인
  isTokenBlacklisted(token) {
    // 실제 구현에서는 Redis나 데이터베이스에서 확인
    return false;
  }

  // 토큰 디코딩 (검증 없이)
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      logError(error, { operation: 'decodeToken' });
      return null;
    }
  }

  // 토큰 만료 시간 확인
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      logError(error, { operation: 'getTokenExpiration' });
      return null;
    }
  }

  // 토큰이 곧 만료되는지 확인 (1시간 이내)
  isTokenExpiringSoon(token) {
    try {
      const expiration = this.getTokenExpiration(token);
      if (!expiration) return false;
      
      const oneHour = 60 * 60 * 1000; // 1시간
      return (expiration.getTime() - Date.now()) < oneHour;
    } catch (error) {
      logError(error, { operation: 'isTokenExpiringSoon' });
      return false;
    }
  }
}

// 싱글톤 인스턴스 생성
const jwtService = new JWTService();

module.exports = jwtService;

