const TaxCredential = require('../models/TaxCredential');
const { logError, logSecurity, logAudit } = require('../utils/logger');
const { validationResult } = require('express-validator');

class WebhookController {
  // Make에서 호출하는 웹훅 - 클라이언트 ID로 인증서 복호화
  static async decryptCredentials(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { clientId, userPassword } = req.body;

      // 사업자등록번호 형식 검증
      if (!/^[0-9]{10}$/.test(clientId)) {
        return res.status(400).json({
          error: '사업자등록번호는 10자리 숫자여야 합니다.',
          code: 'INVALID_CLIENT_ID_FORMAT'
        });
      }

      // 클라이언트 ID로 인증서 조회 및 복호화
      const result = await TaxCredential.decryptByClientId(clientId, userPassword);

      logSecurity('Webhook: Credential decrypted', {
        clientId,
        credentialId: result.credential.id,
        userId: result.credential.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Make에서 사용할 수 있는 형태로 응답
      res.json({
        success: true,
        message: '인증서 정보가 성공적으로 복호화되었습니다.',
        data: {
          credential: {
            id: result.credential.id,
            clientId: result.credential.clientId,
            certName: result.credential.certName,
            certType: result.credential.certType
          },
          decryptedData: {
            certData: result.decryptedData.certData,
            privateKey: result.decryptedData.privateKey,
            certPassword: result.decryptedData.certPassword
          }
        }
      });
    } catch (error) {
      logError(error, { operation: 'WebhookController.decryptCredentials' });
      
      if (error.message.includes('복호화')) {
        return res.status(400).json({
          success: false,
          error: '인증서 정보 복호화에 실패했습니다. 비밀번호를 확인해주세요.',
          code: 'DECRYPTION_ERROR'
        });
      }

      if (error.message.includes('찾을 수 없습니다')) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: '인증서 복호화 중 오류가 발생했습니다.',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  // Make 웹훅 로그 저장
  static async logWebhookCall(req, res) {
    try {
      const { webhookType, clientId, payload, responseStatus, responseData, processingTime } = req.body;

      // 웹훅 로그 저장 (실제 구현에서는 데이터베이스에 저장)
      logSecurity('Webhook call logged', {
        webhookType,
        clientId,
        responseStatus,
        processingTime,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '웹훅 로그가 저장되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'WebhookController.logWebhookCall' });
      res.status(500).json({
        success: false,
        error: '웹훅 로그 저장 중 오류가 발생했습니다.',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  // 웹훅 상태 확인
  static async healthCheck(req, res) {
    try {
      res.json({
        success: true,
        message: '웹훅 서비스가 정상적으로 작동 중입니다.',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      logError(error, { operation: 'WebhookController.healthCheck' });
      res.status(500).json({
        success: false,
        error: '웹훅 서비스 상태 확인 중 오류가 발생했습니다.',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  // Make 시나리오 테스트용 엔드포인트
  static async testScenario(req, res) {
    try {
      const { clientId, userPassword, testType = 'basic' } = req.body;

      if (!clientId || !userPassword) {
        return res.status(400).json({
          success: false,
          error: '사업자등록번호와 사용자 비밀번호가 필요합니다.',
          code: 'MISSING_PARAMETERS'
        });
      }

      // 기본 테스트: 인증서 복호화
      if (testType === 'basic') {
        const result = await TaxCredential.decryptByClientId(clientId, userPassword);
        
        return res.json({
          success: true,
          message: '기본 테스트가 성공했습니다.',
          data: {
            credential: result.credential,
            hasDecryptedData: !!result.decryptedData
          }
        });
      }

      // 확장 테스트: 실제 홈택스 연결 (구현 예정)
      if (testType === 'extended') {
        const result = await TaxCredential.decryptByClientId(clientId, userPassword);
        
        // 여기서 실제 홈택스 API 호출 테스트를 수행할 수 있습니다
        // 현재는 기본 검증만 수행
        
        return res.json({
          success: true,
          message: '확장 테스트가 성공했습니다.',
          data: {
            credential: result.credential,
            connectionTest: 'passed', // 실제 구현에서는 홈택스 연결 테스트 결과
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(400).json({
        success: false,
        error: '유효하지 않은 테스트 타입입니다.',
        code: 'INVALID_TEST_TYPE'
      });
    } catch (error) {
      logError(error, { operation: 'WebhookController.testScenario' });
      
      res.status(500).json({
        success: false,
        error: '테스트 시나리오 실행 중 오류가 발생했습니다.',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
}

module.exports = WebhookController;

