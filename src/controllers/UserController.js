const User = require('../models/User');
const { logError } = require('../utils/logger');

/**
 * 사용자 관리 컨트롤러
 */
class UserController {
  /**
   * 모든 사용자 조회 (관리자용)
   */
  static async getAllUsers(req, res) {
    try {
      const users = await User.findAll();

      res.json({
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          creditBalance: user.creditBalance || 0,
          subscriptionTier: user.subscriptionTier || 'free',
          createdAt: user.createdAt
        }))
      });
    } catch (error) {
      logError(error, { operation: 'UserController.getAllUsers' });
      res.status(500).json({
        error: '사용자 목록 조회 중 오류가 발생했습니다.',
        code: 'USER_LIST_ERROR'
      });
    }
  }

  /**
   * 내 프로필 조회
   */
  static async getMyProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          businessNumber: user.businessNumber,
          companyName: user.companyName,
          role: user.role,
          creditBalance: user.creditBalance || 0,
          subscriptionTier: user.subscriptionTier || 'free',
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      logError(error, { operation: 'UserController.getMyProfile' });
      res.status(500).json({
        error: '프로필 조회 중 오류가 발생했습니다.',
        code: 'PROFILE_ERROR'
      });
    }
  }

  /**
   * 내 프로필 업데이트
   */
  static async updateMyProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { name, phone } = req.body;

      if (!name && !phone) {
        return res.status(400).json({
          error: '변경할 정보를 입력해주세요.',
          code: 'MISSING_DATA'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      const updatedUser = await user.update({ name, phone });

      res.json({
        message: '프로필이 업데이트되었습니다.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          phone: updatedUser.phone,
          role: updatedUser.role
        }
      });
    } catch (error) {
      logError(error, { operation: 'UserController.updateMyProfile' });
      res.status(500).json({
        error: '프로필 업데이트 중 오류가 발생했습니다.',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }

  /**
   * 비밀번호 변경
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: '현재 비밀번호와 새 비밀번호를 입력해주세요.',
          code: 'MISSING_PASSWORD'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 현재 비밀번호 검증
      const isValid = await user.verifyPassword(currentPassword);
      if (!isValid) {
        return res.status(401).json({
          error: '현재 비밀번호가 일치하지 않습니다.',
          code: 'INVALID_PASSWORD'
        });
      }

      // 비밀번호 변경
      await user.changePassword(newPassword);

      res.json({
        message: '비밀번호가 변경되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'UserController.changePassword' });
      res.status(500).json({
        error: '비밀번호 변경 중 오류가 발생했습니다.',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
}

module.exports = UserController;

