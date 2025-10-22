const CreditTransaction = require('../models/CreditTransaction');
const { logError, logSecurity } = require('../utils/logger');

/**
 * 크레딧 차감 미들웨어
 * 
 * 사용법:
 * router.post('/some-action', authenticateToken, requireCredit(10, '작업 설명'), handler)
 */
function requireCredit(creditAmount, description) {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;

      // 현재 잔액 확인
      const { balance } = await CreditTransaction.getBalance(userId);

      // 크레딧 부족 체크
      if (balance < creditAmount) {
        logSecurity('Insufficient credits', {
          userId,
          required: creditAmount,
          current: balance,
          action: description,
          ip: req.ip
        });

        return res.status(402).json({ // 402 Payment Required
          error: '크레딧이 부족합니다.',
          code: 'INSUFFICIENT_CREDITS',
          required: creditAmount,
          current: balance,
          needed: creditAmount - balance
        });
      }

      // 크레딧 차감
      try {
        await CreditTransaction.deduct(
          userId,
          creditAmount,
          description,
          req.body.relatedId || null
        );

        logSecurity('Credit deducted', {
          userId,
          amount: creditAmount,
          action: description,
          ip: req.ip
        });

        // 차감 성공 후 다음 미들웨어로
        next();
      } catch (deductError) {
        logError(deductError, { 
          operation: 'creditCheck.deduct', 
          userId, 
          amount: creditAmount 
        });

        return res.status(500).json({
          error: '크레딧 차감 중 오류가 발생했습니다.',
          code: 'CREDIT_DEDUCTION_ERROR'
        });
      }
    } catch (error) {
      logError(error, { operation: 'creditCheck.middleware' });
      
      return res.status(500).json({
        error: '크레딧 확인 중 오류가 발생했습니다.',
        code: 'CREDIT_CHECK_ERROR'
      });
    }
  };
}

/**
 * 조건부 크레딧 차감 미들웨어
 * 특정 조건을 만족할 때만 크레딧 차감
 * 
 * 사용법:
 * router.post('/action', authenticateToken, requireCreditIf(
 *   (req) => req.body.premium === true, 
 *   10, 
 *   '프리미엄 기능'
 * ), handler)
 */
function requireCreditIf(condition, creditAmount, description) {
  return async (req, res, next) => {
    // 조건 체크
    if (!condition(req)) {
      return next();
    }

    // 조건을 만족하면 크레딧 차감
    return requireCredit(creditAmount, description)(req, res, next);
  };
}

/**
 * 크레딧 잔액 확인만 하는 미들웨어 (차감 안함)
 * 
 * 사용법:
 * router.get('/check', authenticateToken, checkCreditBalance(10), handler)
 */
function checkCreditBalance(minimumCredit) {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { balance } = await CreditTransaction.getBalance(userId);

      if (balance < minimumCredit) {
        return res.status(402).json({
          error: '크레딧이 부족합니다.',
          code: 'INSUFFICIENT_CREDITS',
          required: minimumCredit,
          current: balance,
          needed: minimumCredit - balance
        });
      }

      // 잔액만 확인하고 req에 추가
      req.userCreditBalance = balance;
      next();
    } catch (error) {
      logError(error, { operation: 'checkCreditBalance.middleware' });
      
      return res.status(500).json({
        error: '크레딧 확인 중 오류가 발생했습니다.',
        code: 'CREDIT_CHECK_ERROR'
      });
    }
  };
}

module.exports = {
  requireCredit,
  requireCreditIf,
  checkCreditBalance
};

