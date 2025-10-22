const User = require('../models/User');
const TaxCredential = require('../models/TaxCredential');
const CreditTransaction = require('../models/CreditTransaction');
const { logError, logAudit } = require('../utils/logger');

class MakeController {
  /**
   * Make 워크플로우 실행 API
   * 사업자번호와 상호로 사용자를 찾아 크레딧을 차감하고 필요한 정보를 반환
   */
  static async executeWorkflow(req, res) {
    try {
      const { businessNumber, companyName, requiredCredits, requestType } = req.body;

      // 입력 검증
      if (!businessNumber || !companyName || !requiredCredits) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_PARAMETERS',
          message: '사업자등록번호, 상호명, 필요 크레딧을 모두 입력해주세요.'
        });
      }

      if (requestType && !['basic', 'with_certificate'].includes(requestType)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST_TYPE',
          message: 'requestType은 basic 또는 with_certificate이어야 합니다.'
        });
      }

      // 사용자 조회
      const user = await User.findByBusinessInfo(businessNumber, companyName);
      if (!user) {
        logAudit('Make workflow execution failed: User not found', {
          businessNumber,
          companyName,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: '일치하는 회원 정보가 없습니다.'
        });
      }

      // 계정 활성화 확인
      if (!user.isActive) {
        logAudit('Make workflow execution failed: Account deactivated', {
          userId: user.id,
          businessNumber,
          companyName,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_DEACTIVATED',
          message: '비활성화된 계정입니다.'
        });
      }

      // 크레딧 잔액 확인
      if (user.creditBalance < requiredCredits) {
        logAudit('Make workflow execution failed: Insufficient credits', {
          userId: user.id,
          businessNumber,
          companyName,
          requiredCredits,
          currentBalance: user.creditBalance,
          ip: req.ip
        });

        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: '크레딧이 부족합니다.',
          requiredCredits,
          currentBalance: user.creditBalance
        });
      }

      // 크레딧 차감
      await CreditTransaction.create({
        userId: user.id,
        amount: -requiredCredits,
        type: 'usage',
        description: `Make 워크플로우 실행 (${companyName})`,
        relatedId: null,
        expiresAt: null
      });

      // 사용자 크레딧 잔액 업데이트
      await User.updateCreditBalance(user.id, user.creditBalance - requiredCredits);

      const response = {
        success: true,
        creditsUsed: requiredCredits,
        remainingCredits: user.creditBalance - requiredCredits,
        userId: user.id,
        companyName: user.companyName
      };

      // 인증서 정보가 필요한 경우
      if (requestType === 'with_certificate') {
        const credential = await TaxCredential.findByClientId(businessNumber);
        if (!credential) {
          return res.status(404).json({
            success: false,
            error: 'CERTIFICATE_NOT_FOUND',
            message: '등록된 인증서가 없습니다.'
          });
        }

        // 인증서 정보 복호화
        const decryptedCredential = await TaxCredential.decryptByClientId(businessNumber);
        if (!decryptedCredential) {
          return res.status(500).json({
            success: false,
            error: 'CERTIFICATE_DECRYPTION_FAILED',
            message: '인증서 정보 복호화에 실패했습니다.'
          });
        }

        response.certificateData = {
          certData: decryptedCredential.certData,
          privateKey: decryptedCredential.privateKey,
          certPassword: decryptedCredential.certPassword
        };
      }

      logAudit('Make workflow execution successful', {
        userId: user.id,
        businessNumber,
        companyName,
        creditsUsed: requiredCredits,
        requestType,
        ip: req.ip
      });

      res.json(response);

    } catch (error) {
      logError(error, { operation: 'MakeController.executeWorkflow' });
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '서버 내부 오류가 발생했습니다.'
      });
    }
  }
}

module.exports = MakeController;
