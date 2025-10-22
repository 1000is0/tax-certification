const Subscription = require('../models/Subscription');
const CreditTransaction = require('../models/CreditTransaction');
const Payment = require('../models/Payment');
const NicepayService = require('../services/NicepayService');
const { logError, logger } = require('../utils/logger');

/**
 * 구독 컨트롤러
 */
class SubscriptionController {
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
          tier: 'free'
        });
      }
      
      res.json({
        subscription: subscription.toJSON(),
        tier: subscription.tier
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.getMySubscription' });
      res.status(500).json({
        error: '구독 정보 조회 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_GET_ERROR'
      });
    }
  }

  /**
   * 구독 취소
   */
  static async cancelSubscription(req, res) {
    try {
      const userId = req.user.userId;
      const { reason } = req.body;
      
      const subscription = await Subscription.findByUserId(userId);
      
      if (!subscription) {
        return res.status(404).json({
          error: '활성화된 구독을 찾을 수 없습니다.',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }
      
      if (subscription.status !== 'active') {
        return res.status(400).json({
          error: '취소할 수 있는 구독이 아닙니다.',
          code: 'SUBSCRIPTION_NOT_ACTIVE'
        });
      }
      
      // 빌링키 삭제 (나이스페이)
      if (subscription.billingKey) {
        const nicepayResult = await NicepayService.deleteBillingKey(subscription.billingKey);
        if (!nicepayResult.success) {
          logger.warn('빌링키 삭제 실패 (구독은 취소 진행)', { 
            subscriptionId: subscription.id, 
            error: nicepayResult.error 
          });
        }
      }
      
      // 구독 취소
      await subscription.cancel(reason);
      
      logger.info('구독 취소 완료', { userId, subscriptionId: subscription.id, reason });
      
      res.json({
        success: true,
        message: '구독이 취소되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.cancelSubscription' });
      res.status(500).json({
        error: '구독 취소 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_CANCEL_ERROR'
      });
    }
  }

  /**
   * 구독 갱신 (Cron Job용 - 관리자 전용)
   * 만료된 구독을 자동 갱신하고 결제 처리
   */
  static async renewSubscriptions(req, res) {
    try {
      // API 키 검증 (간단한 방법)
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({
          error: '권한이 없습니다.',
          code: 'FORBIDDEN'
        });
      }
      
      logger.info('구독 갱신 작업 시작');
      
      // 갱신이 필요한 구독 조회
      const subscriptions = await Subscription.findDueForRenewal();
      
      const results = {
        total: subscriptions.length,
        success: 0,
        failed: 0,
        errors: []
      };
      
      for (const subscription of subscriptions) {
        try {
          logger.info('구독 갱신 처리', { 
            subscriptionId: subscription.id, 
            userId: subscription.userId,
            tier: subscription.tier 
          });
          
          // 빌링키로 결제
          if (!subscription.billingKey) {
            throw new Error('빌링키가 없습니다.');
          }
          
          const orderId = `SUB_${subscription.id}_${Date.now()}`;
          const tierConfig = Subscription.TIERS[subscription.tier];
          
          const paymentResult = await NicepayService.payWithBillingKey({
            billingKey: subscription.billingKey,
            orderId,
            amount: tierConfig.price,
            goodsName: `${tierConfig.name} 플랜 월간 구독`,
            mallUserId: subscription.userId
          });
          
          if (!paymentResult.success) {
            throw new Error(paymentResult.error);
          }
          
          // 결제 기록 생성
          await Payment.create({
            userId: subscription.userId,
            orderId,
            orderName: `${tierConfig.name} 플랜 월간 구독`,
            amount: tierConfig.price,
            paymentType: 'subscription_renewal',
            relatedId: subscription.id,
            tid: paymentResult.tid,
            payMethod: 'card',
            status: 'paid'
          });
          
          // 구독 갱신
          await subscription.renew();
          
          // 크레딧 지급
          await CreditTransaction.create({
            userId: subscription.userId,
            amount: tierConfig.monthlyCredits,
            type: 'subscription_grant',
            description: `${tierConfig.name} 플랜 월간 크레딧`,
            relatedId: subscription.id,
            expiresAt: subscription.billingCycleEnd
          });
          
          results.success++;
          logger.info('구독 갱신 성공', { subscriptionId: subscription.id });
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            subscriptionId: subscription.id,
            userId: subscription.userId,
            error: error.message
          });
          
          logError(error, { 
            operation: 'SubscriptionController.renewSubscriptions.item',
            subscriptionId: subscription.id 
          });
          
          // 결제 실패 시 구독 일시정지
          await subscription.suspend('결제 실패');
        }
      }
      
      logger.info('구독 갱신 작업 완료', results);
      
      res.json({
        success: true,
        message: '구독 갱신 작업이 완료되었습니다.',
        results
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.renewSubscriptions' });
      res.status(500).json({
        error: '구독 갱신 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_RENEW_ERROR'
      });
    }
  }
  
  /**
   * 만료된 구독 처리 (Cron Job용 - 관리자 전용)
   * 결제 실패 등으로 만료된 구독을 정리
   */
  static async expireSubscriptions(req, res) {
    try {
      // API 키 검증
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({
          error: '권한이 없습니다.',
          code: 'FORBIDDEN'
        });
      }
      
      logger.info('만료 구독 처리 시작');
      
      const subscriptions = await Subscription.findExpired();
      
      for (const subscription of subscriptions) {
        await subscription.expire();
        logger.info('구독 만료 처리', { subscriptionId: subscription.id, userId: subscription.userId });
      }
      
      logger.info('만료 구독 처리 완료', { count: subscriptions.length });
      
      res.json({
        success: true,
        message: '만료된 구독이 처리되었습니다.',
        count: subscriptions.length
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.expireSubscriptions' });
      res.status(500).json({
        error: '구독 만료 처리 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_EXPIRE_ERROR'
      });
    }
  }
}

module.exports = SubscriptionController;

