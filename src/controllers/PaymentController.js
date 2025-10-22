const Payment = require('../models/Payment');
const CreditTransaction = require('../models/CreditTransaction');
const Subscription = require('../models/Subscription');
const NicepayService = require('../services/NicepayService');
const { logError, logSecurity, logger } = require('../utils/logger');

/**
 * 결제 컨트롤러
 */
class PaymentController {
  /**
   * 결제 준비 (일회성 크레딧 구매)
   */
  static async prepareCreditPayment(req, res) {
    console.log('[DEBUG] prepareCreditPayment 시작');
    try {
      const userId = req.user.userId;
      const { creditPackId, credits, price } = req.body;

      console.log('[DEBUG] 크레딧 결제 준비 시작', { userId, creditPackId, credits, price });

      if (!creditPackId || !credits || !price) {
        console.log('[DEBUG] 필수 정보 누락');
        return res.status(400).json({
          error: '필수 정보가 누락되었습니다.',
          code: 'MISSING_PARAMETERS'
        });
      }

      // 주문 ID 생성 (타임스탬프 + 랜덤)
      const orderId = `CREDIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const orderName = `크레딧 구매 (${credits}개)`;

      console.log('[DEBUG] 주문 ID 생성 완료', { orderId });

      // 결제 정보 저장
      console.log('[DEBUG] Payment.create 호출 전');
      const payment = await Payment.create({
        userId,
        orderId,
        orderName,
        amount: price,
        paymentType: 'one_time_credit',
        relatedId: creditPackId,
        metadata: { credits }
      });
      console.log('[DEBUG] Payment.create 완료', { paymentId: payment.id });

      // 나이스페이 결제 준비 (카드만 허용)
      const returnUrl = `${process.env.BACKEND_URL || 'https://tax-certification.vercel.app'}/api/payments/callback`;
      console.log('[DEBUG] NicepayService.preparePayment 호출 전', { orderId, amount: price, returnUrl });
      const nicepayResult = await NicepayService.preparePayment({
        orderId,
        amount: price,
        goodsName: orderName,
        returnUrl,
        mallUserId: userId,
        directPayMethod: 'CARD' // 카드 결제만 허용
      });
      console.log('[DEBUG] NicepayService.preparePayment 완료', { success: nicepayResult.success });
      console.log('[DEBUG] nicepayResult 전체:', JSON.stringify(nicepayResult));

      if (!nicepayResult.success) {
        await payment.markAsFailed({
          failCode: 'PREPARE_FAILED',
          failMessage: nicepayResult.error
        });

        return res.status(500).json({
          error: nicepayResult.error,
          code: 'PAYMENT_PREPARE_FAILED'
        });
      }

      logger.info('결제 준비 완료', { orderId, userId, credits });

      res.json({
        success: true,
        orderId,
        clientToken: nicepayResult.clientToken,
        clientId: process.env.NICEPAY_CLIENT_ID, // 프론트엔드에서 SDK 호출 시 필요
        returnUrl, // 프론트엔드에서 SDK 호출 시 필요
        amount: price,
        orderName
      });
    } catch (error) {
      logError(error, { operation: 'PaymentController.prepareCreditPayment' });
      res.status(500).json({
        error: '결제 준비 중 오류가 발생했습니다.',
        code: 'PAYMENT_PREPARE_ERROR'
      });
    }
  }

  /**
   * 결제 준비 (구독 플랜)
   */
  static async prepareSubscriptionPayment(req, res) {
    try {
      const userId = req.user.userId;
      const { tier } = req.body;

      if (!tier) {
        return res.status(400).json({
          error: '구독 티어를 선택해주세요.',
          code: 'MISSING_TIER'
        });
      }

      const tierConfig = Subscription.TIERS[tier];
      if (!tierConfig) {
        return res.status(400).json({
          error: '유효하지 않은 구독 티어입니다.',
          code: 'INVALID_TIER'
        });
      }

      if (tierConfig.isCustom) {
        return res.status(400).json({
          error: '엔터프라이즈 플랜은 영업팀에 문의해주세요.',
          code: 'CUSTOM_PLAN'
        });
      }

      if (tier === 'free') {
        return res.status(400).json({
          error: '무료 플랜은 결제가 필요하지 않습니다.',
          code: 'FREE_PLAN'
        });
      }

      // 주문 ID 생성
      const orderId = `SUB_${tier.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const orderName = `${tierConfig.name} 구독`;

      // 결제 정보 저장
      const payment = await Payment.create({
        userId,
        orderId,
        orderName,
        amount: tierConfig.price,
        paymentType: 'subscription',
        relatedId: tier,
        metadata: { 
          tier,
          monthlyCredits: tierConfig.monthlyCredits 
        }
      });

      // 나이스페이 결제 준비
      const returnUrl = `${process.env.BACKEND_URL || 'https://tax-certification.vercel.app'}/api/payments/callback`;
      const nicepayResult = await NicepayService.preparePayment({
        orderId,
        amount: tierConfig.price,
        goodsName: orderName,
        returnUrl,
        mallUserId: userId,
        // 구독은 카드만 허용 (가상계좌 제외)
        useEscrow: false,
        directPayMethod: 'CARD' // 카드 결제만 허용
      });

      if (!nicepayResult.success) {
        await payment.markAsFailed({
          failCode: 'PREPARE_FAILED',
          failMessage: nicepayResult.error
        });

        return res.status(500).json({
          error: nicepayResult.error,
          code: 'PAYMENT_PREPARE_FAILED'
        });
      }

      logger.info('구독 결제 준비 완료', { orderId, userId, tier });

      res.json({
        success: true,
        orderId,
        clientToken: nicepayResult.clientToken,
        clientId: process.env.NICEPAY_CLIENT_ID, // 프론트엔드에서 SDK 호출 시 필요
        returnUrl, // 프론트엔드에서 SDK 호출 시 필요
        amount: tierConfig.price,
        orderName
      });
    } catch (error) {
      logError(error, { operation: 'PaymentController.prepareSubscriptionPayment' });
      res.status(500).json({
        error: '결제 준비 중 오류가 발생했습니다.',
        code: 'PAYMENT_PREPARE_ERROR'
      });
    }
  }

  /**
   * 나이스페이 결제 완료 콜백 (GET/POST)
   * 결제창에서 결제 완료 후 자동으로 호출됨
   */
  static async paymentCallback(req, res) {
    try {
      console.log('[DEBUG] Payment callback received - Method:', req.method);
      console.log('[DEBUG] Query params:', req.query);
      console.log('[DEBUG] Body params:', req.body);
      
      // GET 또는 POST 방식 모두 처리
      const params = req.method === 'GET' ? req.query : req.body;
      const { authResultCode, authResultMsg, tid, orderId, amount } = params;

      // 결제 실패
      if (authResultCode !== '0000') {
        console.log('[DEBUG] Payment failed:', authResultMsg);
        // 프론트엔드로 리다이렉트 (실패)
        return res.redirect(`${process.env.FRONTEND_URL}/payment/callback?status=failed&message=${encodeURIComponent(authResultMsg || '결제에 실패했습니다.')}`);
      }

      // 결제 성공 - 프론트엔드로 리다이렉트
      const redirectUrl = `${process.env.FRONTEND_URL}/payment/callback?status=success&orderId=${orderId}&tid=${tid}&amount=${amount}`;
      console.log('[DEBUG] Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (error) {
      logError(error, { operation: 'PaymentController.paymentCallback' });
      res.redirect(`${process.env.FRONTEND_URL}/payment/callback?status=error&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`);
    }
  }

  /**
   * 결제 승인 (프론트엔드에서 결제 완료 후 호출)
   */
  static async approvePayment(req, res) {
    try {
      const userId = req.user.userId;
      const { orderId, tid, amount } = req.body;

      if (!orderId || !tid || !amount) {
        return res.status(400).json({
          error: '필수 정보가 누락되었습니다.',
          code: 'MISSING_PARAMETERS'
        });
      }

      // 결제 정보 조회
      const payment = await Payment.findByOrderId(orderId);
      if (!payment) {
        return res.status(404).json({
          error: '결제 정보를 찾을 수 없습니다.',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      // 사용자 확인
      if (payment.userId !== userId) {
        logSecurity('Unauthorized payment approval attempt', { userId, orderId });
        return res.status(403).json({
          error: '권한이 없습니다.',
          code: 'FORBIDDEN'
        });
      }

      // 이미 처리된 결제인지 확인
      if (payment.status === 'paid') {
        return res.status(400).json({
          error: '이미 처리된 결제입니다.',
          code: 'ALREADY_PAID'
        });
      }

      // 금액 확인
      if (payment.amount !== amount) {
        await payment.markAsFailed({
          failCode: 'AMOUNT_MISMATCH',
          failMessage: `금액 불일치: 예상 ${payment.amount}, 실제 ${amount}`
        });
        
        return res.status(400).json({
          error: '결제 금액이 일치하지 않습니다.',
          code: 'AMOUNT_MISMATCH'
        });
      }

      // 나이스페이 결제 승인
      const nicepayResult = await NicepayService.approvePayment({ tid, amount });

      if (!nicepayResult.success) {
        await payment.markAsFailed({
          failCode: nicepayResult.code || 'APPROVE_FAILED',
          failMessage: nicepayResult.error
        });

        return res.status(500).json({
          error: nicepayResult.error,
          code: 'PAYMENT_APPROVE_FAILED'
        });
      }

      // 결제 완료 처리
      await payment.markAsPaid({
        tid: nicepayResult.tid,
        payMethod: nicepayResult.payMethod,
        cardName: nicepayResult.cardName,
        cardNum: nicepayResult.cardNum,
        billingKey: nicepayResult.billingKey
      });

      // 결제 타입별 처리
      if (payment.paymentType === 'one_time_credit') {
        // 일회성 크레딧 지급
        const credits = payment.metadata.credits;
        await CreditTransaction.create(
          userId,
          credits,
          'purchase',
          `크레딧 구매 (${payment.orderName})`,
          payment.id,
          null // 만료일 없음
        );

        logger.info('크레딧 구매 완료', { orderId, userId, credits });

        res.json({
          success: true,
          message: `${credits} 크레딧이 지급되었습니다.`,
          payment: payment.toJSON()
        });

      } else if (payment.paymentType === 'subscription') {
        // 구독 생성
        const tier = payment.relatedId;
        const subscription = await Subscription.create({
          userId,
          tier,
          billingKey: nicepayResult.billingKey
        });

        logger.info('구독 생성 완료', { orderId, userId, tier });

        res.json({
          success: true,
          message: '구독이 시작되었습니다.',
          payment: payment.toJSON(),
          subscription: subscription.toJSON()
        });
      }
    } catch (error) {
      logError(error, { operation: 'PaymentController.approvePayment' });
      res.status(500).json({
        error: '결제 승인 중 오류가 발생했습니다.',
        code: 'PAYMENT_APPROVE_ERROR'
      });
    }
  }

  /**
   * 결제 취소
   */
  static async cancelPayment(req, res) {
    try {
      const userId = req.user.userId;
      const { orderId, reason } = req.body;

      if (!orderId || !reason) {
        return res.status(400).json({
          error: '필수 정보가 누락되었습니다.',
          code: 'MISSING_PARAMETERS'
        });
      }

      const payment = await Payment.findByOrderId(orderId);
      if (!payment) {
        return res.status(404).json({
          error: '결제 정보를 찾을 수 없습니다.',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      // 사용자 확인 (관리자는 모든 결제 취소 가능)
      if (payment.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          error: '권한이 없습니다.',
          code: 'FORBIDDEN'
        });
      }

      if (payment.status !== 'paid') {
        return res.status(400).json({
          error: '완료된 결제만 취소할 수 있습니다.',
          code: 'INVALID_STATUS'
        });
      }

      // 나이스페이 결제 취소
      const nicepayResult = await NicepayService.cancelPayment({
        tid: payment.tid,
        amount: payment.amount,
        reason
      });

      if (!nicepayResult.success) {
        return res.status(500).json({
          error: nicepayResult.error,
          code: 'PAYMENT_CANCEL_FAILED'
        });
      }

      // 결제 취소 처리
      await payment.markAsCancelled();

      // TODO: 크레딧 차감, 구독 취소 등 추가 처리

      logger.info('결제 취소 완료', { orderId, userId, reason });

      res.json({
        success: true,
        message: '결제가 취소되었습니다.',
        payment: payment.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'PaymentController.cancelPayment' });
      res.status(500).json({
        error: '결제 취소 중 오류가 발생했습니다.',
        code: 'PAYMENT_CANCEL_ERROR'
      });
    }
  }

  /**
   * 결제 내역 조회
   */
  static async getPaymentHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 10, status } = req.query;

      const result = await Payment.findByUserId(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status
      });

      res.json({
        payments: result.payments.map(p => p.toJSON()),
        totalCount: result.totalCount,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      logError(error, { operation: 'PaymentController.getPaymentHistory' });
      res.status(500).json({
        error: '결제 내역 조회 중 오류가 발생했습니다.',
        code: 'PAYMENT_HISTORY_ERROR'
      });
    }
  }
}

module.exports = PaymentController;

