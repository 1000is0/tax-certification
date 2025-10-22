const User = require('../models/User');
const jwtService = require('../utils/jwt');
const { logError, logSecurity, logAudit } = require('../utils/logger');
const { validationResult } = require('express-validator');

class AuthController {
  // 사용자 등록
  static async register(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { email, password, name, phone, role } = req.body;

      // 이메일 중복 확인
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        logSecurity('Registration failed: Email already exists', {
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(409).json({
          error: '이미 사용 중인 이메일입니다.',
          code: 'EMAIL_EXISTS'
        });
      }

      // 사용자 생성
      const user = await User.create({
        email,
        password,
        name,
        phone,
        businessNumber: req.body.businessNumber,
        companyName: req.body.companyName,
        role: role || 'user'
      });

      // 토큰 생성
      const tokens = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      logSecurity('User registered successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(201).json({
        message: '회원가입이 완료되었습니다.',
        user: user.toJSON(),
        tokens
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.register' });
      res.status(500).json({
        error: '회원가입 중 오류가 발생했습니다.',
        code: 'REGISTRATION_ERROR'
      });
    }
  }

  // 사용자 로그인
  static async login(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      // 사용자 조회
      const user = await User.findByEmail(email);
      if (!user) {
        logSecurity('Login failed: User not found', {
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(401).json({
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // 계정 활성화 확인
      if (!user.isActive) {
        logSecurity('Login failed: Account deactivated', {
          userId: user.id,
          email,
          ip: req.ip
        });
        return res.status(401).json({
          error: '비활성화된 계정입니다.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // 비밀번호 검증
      const isValidPassword = await user.verifyPassword(password);
      if (!isValidPassword) {
        logSecurity('Login failed: Invalid password', {
          userId: user.id,
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(401).json({
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // 로그인 시간 업데이트
      await user.updateLastLogin();

      // 토큰 생성
      const tokens = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      logSecurity('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        message: '로그인에 성공했습니다.',
        user: user.toJSON(),
        tokens
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.login' });
      res.status(500).json({
        error: '로그인 중 오류가 발생했습니다.',
        code: 'LOGIN_ERROR'
      });
    }
  }

  // 토큰 갱신
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: '리프레시 토큰이 필요합니다.',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      // 리프레시 토큰 검증 및 새로운 액세스 토큰 생성
      const newAccessToken = jwtService.refreshAccessToken(refreshToken);

      logSecurity('Token refreshed successfully', {
        ip: req.ip
      });

      res.json({
        message: '토큰이 갱신되었습니다.',
        accessToken: newAccessToken
      });
    } catch (error) {
      logSecurity('Token refresh failed', {
        error: error.message,
        ip: req.ip
      });
      
      res.status(401).json({
        error: error.message,
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }

  // 로그아웃
  static async logout(req, res) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        // 토큰 블랙리스트에 추가 (선택적)
        jwtService.blacklistToken(token);
      }

      logSecurity('User logged out', {
        userId: req.user?.userId,
        ip: req.ip
      });

      res.json({
        message: '로그아웃되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.logout' });
      res.status(500).json({
        error: '로그아웃 중 오류가 발생했습니다.',
        code: 'LOGOUT_ERROR'
      });
    }
  }

  // 현재 사용자 정보 조회
  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        user: user.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.getCurrentUser' });
      res.status(500).json({
        error: '사용자 정보 조회 중 오류가 발생했습니다.',
        code: 'USER_INFO_ERROR'
      });
    }
  }

  // 비밀번호 변경
  static async changePassword(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      // 사용자 조회
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 현재 비밀번호 검증
      const isValidPassword = await user.verifyPassword(currentPassword);
      if (!isValidPassword) {
        logSecurity('Password change failed: Invalid current password', {
          userId,
          ip: req.ip
        });
        return res.status(401).json({
          error: '현재 비밀번호가 올바르지 않습니다.',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // 새 비밀번호로 변경
      await user.changePassword(newPassword);

      logSecurity('Password changed successfully', {
        userId,
        ip: req.ip
      });

      res.json({
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.changePassword' });
      res.status(500).json({
        error: '비밀번호 변경 중 오류가 발생했습니다.',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }

  // 계정 삭제
  static async deleteAccount(req, res) {
    try {
      const userId = req.user.userId;

      // 사용자 조회
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 계정 삭제 (소프트 삭제)
      await user.delete();

      logSecurity('Account deleted', {
        userId,
        email: user.email,
        ip: req.ip
      });

      res.json({
        message: '계정이 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.deleteAccount' });
      res.status(500).json({
        error: '계정 삭제 중 오류가 발생했습니다.',
        code: 'ACCOUNT_DELETE_ERROR'
      });
    }
  }

  // 비밀번호 검증 (삭제 확인용)
  static async verifyPassword(req, res) {
    try {
      const { password } = req.body;
      const userId = req.user.userId; // req.user.id가 아닌 req.user.userId

      if (!password) {
        return res.status(400).json({
          error: '비밀번호를 입력해주세요.',
          code: 'MISSING_PASSWORD'
        });
      }

      // 사용자 조회
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 비밀번호 확인
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logSecurity('Password verification failed', {
          userId,
          ip: req.ip
        });
        return res.status(401).json({
          error: '비밀번호가 올바르지 않습니다.',
          code: 'INVALID_PASSWORD'
        });
      }

      logSecurity('Password verified successfully', {
        userId,
        ip: req.ip
      });

      res.json({
        message: '비밀번호가 확인되었습니다.',
        verified: true
      });
    } catch (error) {
      logError(error, { operation: 'AuthController.verifyPassword' });
      res.status(500).json({
        error: '비밀번호 확인 중 오류가 발생했습니다.',
        code: 'PASSWORD_VERIFICATION_ERROR'
      });
    }
  }
}

module.exports = AuthController;

