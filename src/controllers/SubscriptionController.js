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
   * 구독 재활성화
   */
  static async reactivateSubscription(req, res) {
    try {
      const userId = req.user.userId;
      
      const subscription = await Subscription.findByUserId(userId);
      
      if (!subscription) {
        return res.status(404).json({
          error: '구독을 찾을 수 없습니다.',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }
      
      if (subscription.status !== 'cancelled') {
        return res.status(400).json({
          error: '취소된 구독만 재활성화할 수 있습니다.',
          code: 'SUBSCRIPTION_NOT_CANCELLED'
        });
      }
      
      // 구독 재활성화
      await subscription.reactivate();
      
      logger.info('구독 재활성화 완료', { userId, subscriptionId: subscription.id });
      
      res.json({
        success: true,
        message: '구독이 재활성화되었습니다.',
        subscription: subscription.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.reactivateSubscription' });
      res.status(500).json({
        error: error.message || '구독 재활성화 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_REACTIVATE_ERROR'
      });
    }
  }

  /**
   * 플랜 변경 견적 조회 (업그레이드 시 추가 결제 금액 확인)
   */
  static async getChangeTierQuote(req, res) {
    try {
      const userId = req.user.userId;
      const { newTier } = req.query;
      
      const subscription = await Subscription.findByUserId(userId);
      
      if (!subscription) {
        return res.status(404).json({
          error: '활성화된 구독을 찾을 수 없습니다.',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      // 다운그레이드 예약 상태에서 업그레이드할 때는 현재 티어 기준으로 계산
      // 다운그레이드 취소인지 확인
      if (subscription.pendingTier && newTier === subscription.tier) {
        return res.json({
          success: true,
          type: 'downgrade_cancelled',
          message: `${Subscription.TIERS[newTier].name} 플랜으로의 다운그레이드를 취소하시겠습니까?`,
          requiresPayment: false,
          oldTier: subscription.tier,
          pendingTier: subscription.pendingTier,
          newTier
        });
      }

      // 업그레이드인 경우 현재 티어 기준, 다운그레이드인 경우 예약 티어 기준
      const isUpgrade = Subscription.TIERS[newTier].price > (Subscription.TIERS[subscription.tier].price || 0);
      const effectiveTier = isUpgrade ? subscription.tier : (subscription.pendingTier || subscription.tier);
      
      const oldTierConfig = Subscription.TIERS[effectiveTier];
      const newTierConfig = Subscription.TIERS[newTier];

      if (!newTierConfig) {
        return res.status(400).json({
          error: '유효하지 않은 티어입니다.',
          code: 'INVALID_TIER'
        });
      }

      // 업그레이드/다운그레이드 여부 (이미 위에서 계산됨)
      const isDowngrade = newTierConfig.price < (oldTierConfig.price || 0);

      if (isUpgrade) {
        // 일할계산
        const now = new Date();
        const cycleEnd = new Date(subscription.billingCycleEnd);
        const cycleStart = new Date(subscription.billingCycleStart);
        const totalDays = Math.ceil((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((cycleEnd - now) / (1000 * 60 * 60 * 24));
        const remainingRatio = remainingDays / totalDays;

        const oldPriceProrated = (oldTierConfig.price || 0) * remainingRatio;
        const newPriceProrated = newTierConfig.price * remainingRatio;
        const additionalCharge = Math.ceil(newPriceProrated - oldPriceProrated);
        const proratedCredits = newTierConfig.monthlyCredits 
          ? Math.floor(newTierConfig.monthlyCredits * remainingRatio)
          : 0;

        res.json({
          type: 'upgrade',
          additionalCharge,
          proratedCredits,
          remainingDays,
          totalDays,
          currentTier: oldTierConfig.name,
          newTier: newTierConfig.name
        });
      } else if (isDowngrade) {
        res.json({
          type: 'downgrade',
          message: `다음 결제일(${subscription.billingCycleEnd})부터 ${newTierConfig.name} 플랜이 적용됩니다.`,
          currentTier: oldTierConfig.name,
          newTier: newTierConfig.name,
          nextBillingDate: subscription.billingCycleEnd
        });
      } else {
        res.status(400).json({
          error: '동일한 플랜입니다.',
          code: 'SAME_TIER'
        });
      }
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.getChangeTierQuote' });
      res.status(500).json({
        error: '견적 조회 중 오류가 발생했습니다.',
        code: 'QUOTE_ERROR'
      });
    }
  }

  /**
   * 구독 플랜 변경 (업그레이드/다운그레이드)
   */
  static async changeTier(req, res) {
    try {
      const userId = req.user.userId;
      const { newTier, paymentTid } = req.body; // 업그레이드 시 결제 TID 필요
      
      const subscription = await Subscription.findByUserId(userId);
      
      if (!subscription) {
        return res.status(404).json({
          error: '활성화된 구독을 찾을 수 없습니다.',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }
      
      if (subscription.status !== 'active') {
        return res.status(400).json({
          error: '변경할 수 있는 구독이 아닙니다.',
          code: 'SUBSCRIPTION_NOT_ACTIVE'
        });
      }

      // pending_tier가 있고 현재 tier로 변경하려는 경우 = 다운그레이드 취소
      if (subscription.pendingTier && newTier === subscription.tier) {
        // 다운그레이드 취소는 결제 불필요
        const result = await subscription.changeTier(newTier, null);
        
        logger.info('구독 다운그레이드 취소 완료', { 
          userId, 
          subscriptionId: subscription.id, 
          cancelledPendingTier: subscription.pendingTier
        });
        
        return res.json({
          success: true,
          message: result.message,
          subscription: subscription.toJSON(),
          ...result
        });
      }

      if (subscription.tier === newTier && !subscription.pendingTier) {
        return res.status(400).json({
          error: '현재 플랜과 동일합니다.',
          code: 'SAME_TIER'
        });
      }

      // 다운그레이드 예약 상태에서 동일한 플랜 선택 시
      if (subscription.pendingTier && subscription.pendingTier === newTier) {
        return res.status(400).json({
          error: '이미 플랜 변경을 신청하셨습니다.',
          code: 'PENDING_TIER_SAME'
        });
      }

      // 업그레이드인 경우 현재 티어 기준, 다운그레이드인 경우 예약 티어 기준
      const isUpgrade = Subscription.TIERS[newTier].price > (Subscription.TIERS[subscription.tier].price || 0);
      const effectiveTier = isUpgrade ? subscription.tier : (subscription.pendingTier || subscription.tier);
      
      const oldTierConfig = Subscription.TIERS[effectiveTier];
      const newTierConfig = Subscription.TIERS[newTier];

      let paymentResult = null;

      // 업그레이드인 경우 결제 필요
      if (isUpgrade) {
        if (!paymentTid) {
          return res.status(400).json({
            error: '업그레이드 시 결제가 필요합니다.',
            code: 'PAYMENT_REQUIRED'
          });
        }

        // 결제 검증 (이미 승인된 결제인지 확인)
        const payment = await Payment.findByTid(paymentTid);
        if (!payment || payment.userId !== userId || payment.status !== 'paid') {
          return res.status(400).json({
            error: '유효하지 않은 결제 정보입니다.',
            code: 'INVALID_PAYMENT'
          });
        }

        paymentResult = payment;
      }
      
      // 티어 변경 (업그레이드는 결제 정보 포함, 다운그레이드는 null)
      const result = await subscription.changeTier(newTier, paymentResult);
      
      logger.info('구독 플랜 변경 완료', { 
        userId, 
        subscriptionId: subscription.id, 
        oldTier: subscription.tier,
        newTier,
        type: result.type
      });
      
      res.json({
        success: true,
        message: result.type === 'upgrade' 
          ? `${newTierConfig.name} 플랜으로 업그레이드되었습니다. ${result.proratedCredits} 크레딧이 지급되었습니다.`
          : result.message,
        subscription: subscription.toJSON(),
        ...result
      });
    } catch (error) {
      logError(error, { operation: 'SubscriptionController.changeTier' });
      res.status(500).json({
        error: error.message || '플랜 변경 중 오류가 발생했습니다.',
        code: 'SUBSCRIPTION_CHANGE_ERROR'
      });
    }
  }

  /**
   * 구독 갱신 (Cron Job용 - Vercel Cron 전용)
   * 만료된 구독을 자동 갱신하고 결제 처리
   */
  static async renewSubscriptions(req, res) {
    try {
      // Vercel Cron 인증 검증
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({
          error: '권한이 없습니다.',
          code: 'UNAUTHORIZED'
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
   * 만료된 구독 처리 (Cron Job용 - Vercel Cron 전용)
   * 결제 실패 등으로 만료된 구독을 정리
   */
  static async expireSubscriptions(req, res) {
    try {
      // Vercel Cron 인증 검증
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({
          error: '권한이 없습니다.',
          code: 'UNAUTHORIZED'
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

