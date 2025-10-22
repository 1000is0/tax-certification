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
}

module.exports = UserController;

