const CreditTransaction = require('../models/CreditTransaction');
const Subscription = require('../models/Subscription');
const { logError, logSecurity } = require('../utils/logger');

/**
 * 크레딧 관리 컨트롤러
 */
class CreditController {
  /**
   * 현재 크레딧 잔액 조회
   */
  static async getBalance(req, res) {
    try {
      const userId = req.user.userId;

      const balanceData = await CreditTransaction.getBalance(userId);
      const subscription = await Subscription.findByUserId(userId);

      res.json({
        balance: balanceData.balance,
        tier: balanceData.tier,
        subscription: subscription ? subscription.toJSON() : null
      });
    } catch (error) {
      logError(error, { operation: 'CreditController.getBalance' });
      res.status(500).json({
        error: '크레딧 잔액 조회 중 오류가 발생했습니다.',
        code: 'CREDIT_BALANCE_ERROR'
      });
    }
  }

  /**
   * 크레딧 거래 이력 조회
   */
  static async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 50, offset = 0, type } = req.query;

      const transactions = await CreditTransaction.findByUserId(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        type
      });

      // 전체 개수 조회
      const totalCount = await CreditTransaction.countByUserId(userId, { type });

      res.json({
        transactions: transactions.map(t => t.toJSON()),
        totalCount,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      });
    } catch (error) {
      logError(error, { operation: 'CreditController.getHistory' });
      res.status(500).json({
        error: '크레딧 이력 조회 중 오류가 발생했습니다.',
        code: 'CREDIT_HISTORY_ERROR'
      });
    }
  }

  /**
   * 관리자: 크레딧 지급/차감
   */
  static async adminGrant(req, res) {
    try {
      const { userId, amount, description } = req.body;
      const adminId = req.user.userId;

      if (!userId || !amount || !description) {
        return res.status(400).json({
          error: '모든 필드를 입력해주세요.',
          code: 'MISSING_PARAMETERS'
        });
      }

      if (amount === 0) {
        return res.status(400).json({
          error: '크레딧 수량은 0이 될 수 없습니다.',
          code: 'INVALID_AMOUNT'
        });
      }

      const transaction = await CreditTransaction.adminGrant(
        userId,
        parseInt(amount),
        description,
        adminId
      );

      logSecurity('Admin adjusted credits', {
        adminId,
        targetUserId: userId,
        amount,
        action: amount > 0 ? 'grant' : 'deduct',
        ip: req.ip
      });

      res.json({
        message: amount > 0 ? '크레딧이 지급되었습니다.' : '크레딧이 차감되었습니다.',
        transaction: transaction.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'CreditController.adminGrant' });
      
      if (error.message.includes('부족')) {
        return res.status(400).json({
          error: error.message,
          code: 'INSUFFICIENT_CREDITS'
        });
      }

      res.status(500).json({
        error: '크레딧 처리 중 오류가 발생했습니다.',
        code: 'CREDIT_GRANT_ERROR'
      });
    }
  }

  /**
   * 구독 플랜 목록 조회
   */
  static async getPlans(req, res) {
    try {
      // 구독 플랜
      const subscriptionPlans = Object.entries(Subscription.TIERS).map(([key, value]) => ({
        id: key,
        tier: key,
        ...value
      }));

      // 일회성 크레딧 패키지
      const oneTimeCredits = [
        { 
          id: 'credit-50', 
          credits: 50, 
          price: 15000, 
          bonus: 0,
          description: '소량 크레딧 구매'
        },
        { 
          id: 'credit-100', 
          credits: 100, 
          price: 25000, 
          bonus: 10,
          description: '10% 보너스 크레딧'
        },
        { 
          id: 'credit-300', 
          credits: 300, 
          price: 70000, 
          bonus: 30,
          description: '10% 보너스 크레딧',
          popular: true
        },
        { 
          id: 'credit-500', 
          credits: 500, 
          price: 110000, 
          bonus: 50,
          description: '10% 보너스 크레딧'
        }
      ];

      res.json({ 
        subscriptionPlans, 
        oneTimeCredits 
      });
    } catch (error) {
      logError(error, { operation: 'CreditController.getPlans' });
      res.status(500).json({
        error: '플랜 조회 중 오류가 발생했습니다.',
        code: 'PLANS_ERROR'
      });
    }
  }

  /**
   * 내 구독 정보 조회
   */
  static async getMySubscription(req, res) {
    try {
      const userId = req.user.userId;

      const subscription = await Subscription.findByUserId(userId);

      if (!subscription) {
        return res.json({
          subscription: null,
          message: '구독 정보가 없습니다.'
        });
      }

      res.json({
        subscription: subscription.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'CreditController.getMySubscription' });
      res.status(500).json({
        error: '구독 정보 조회 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_ERROR'
      });
    }
  }
}

module.exports = CreditController;

