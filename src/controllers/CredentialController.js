const TaxCredential = require('../models/TaxCredential');
const User = require('../models/User');
const { logError, logSecurity } = require('../utils/logger');
const { validationResult } = require('express-validator');

class CredentialController {
  // 인증서 정보 저장
  static async createCredential(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { 
        clientId, 
        certData, 
        privateKey, 
        certPassword, 
        certName, 
        certType, 
        expiresAt 
      } = req.body;
      const userId = req.user.userId;

      // 사용자 확인
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: '사용자를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 인증서 정보 생성 (마스터 키로 암호화)
      const credential = await TaxCredential.create({
        userId,
        clientId,
        certData,
        privateKey,
        certPassword,
        certName,
        certType,
        expiresAt
      }); // userPassword 제거 - 마스터 키 사용

      logSecurity('Credential created', {
        userId,
        credentialId: credential.id,
        clientId: credential.clientId,
        certName: credential.certName,
        ip: req.ip
      });

      res.status(201).json({
        message: '인증서 정보가 성공적으로 저장되었습니다.',
        credential: credential.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.createCredential' });
      
      if (error.message.includes('사업자등록번호')) {
        return res.status(400).json({
          error: error.message,
          code: 'INVALID_CLIENT_ID'
        });
      }

      res.status(500).json({
        error: '인증서 정보 저장 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_CREATE_ERROR'
      });
    }
  }

  // 사용자 인증서 목록 조회
  static async getUserCredentials(req, res) {
    try {
      const userId = req.user.userId;

      const credentials = await TaxCredential.findByUserId(userId);

      res.json({
        credentials: credentials.map(cred => cred.toJSON())
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.getUserCredentials' });
      res.status(500).json({
        error: '인증서 목록 조회 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_LIST_ERROR'
      });
    }
  }

  // 특정 인증서 조회
  static async getCredential(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const credential = await TaxCredential.findActiveById(id);
      if (!credential) {
        return res.status(404).json({
          error: '인증서를 찾을 수 없습니다.',
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      // 본인 또는 관리자만 접근 가능
      if (credential.userId !== userId && req.user.role !== 'admin') {
        logSecurity('Unauthorized credential access attempt', {
          userId,
          credentialId: id,
          credentialOwnerId: credential.userId,
          ip: req.ip
        });
        return res.status(403).json({
          error: '접근 권한이 없습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
      }

      res.json({
        credential: credential.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.getCredential' });
      res.status(500).json({
        error: '인증서 조회 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_GET_ERROR'
      });
    }
  }

  // 클라이언트 ID로 인증서 복호화 (Make 웹훅용)
  static async decryptByClientId(req, res) {
    try {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({
          error: '사업자등록번호가 필요합니다.',
          code: 'MISSING_PARAMETERS'
        });
      }

      // 사업자등록번호 형식 검증
      if (!/^[0-9]{10}$/.test(clientId)) {
        return res.status(400).json({
          error: '사업자등록번호는 10자리 숫자여야 합니다.',
          code: 'INVALID_CLIENT_ID_FORMAT'
        });
      }

      const result = await TaxCredential.decryptByClientId(clientId); // userPassword 제거

      logSecurity('Credential decrypted by client ID', {
        clientId,
        credentialId: result.credential.id,
        userId: result.credential.userId,
        ip: req.ip
      });

      res.json({
        message: '인증서 정보가 성공적으로 복호화되었습니다.',
        credential: result.credential,
        decryptedData: result.decryptedData
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.decryptByClientId' });
      
      if (error.message.includes('복호화')) {
        return res.status(400).json({
          error: '인증서 정보 복호화에 실패했습니다. 비밀번호를 확인해주세요.',
          code: 'DECRYPTION_ERROR'
        });
      }

      if (error.message.includes('찾을 수 없습니다')) {
        return res.status(404).json({
          error: error.message,
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      res.status(500).json({
        error: '인증서 복호화 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_DECRYPT_ERROR'
      });
    }
  }

  // 인증서 정보 수정
  static async updateCredential(req, res) {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다.',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.userId;
      const { certData, privateKey, certPassword, certName, certType, expiresAt } = req.body;

      const credential = await TaxCredential.findActiveById(id);
      if (!credential) {
        return res.status(404).json({
          error: '인증서를 찾을 수 없습니다.',
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      // 본인 또는 관리자만 수정 가능
      if (credential.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          error: '접근 권한이 없습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
      }

      // 인증서 정보 업데이트 (마스터 키 사용)
      const updatedCredential = await credential.update({
        certData,
        privateKey,
        certPassword,
        certName,
        certType,
        expiresAt
      }); // userPassword 제거

      logSecurity('Credential updated', {
        userId,
        credentialId: id,
        ip: req.ip
      });

      res.json({
        message: '인증서 정보가 성공적으로 수정되었습니다.',
        credential: updatedCredential.toJSON()
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.updateCredential' });
      
      if (error.message.includes('복호화')) {
        return res.status(400).json({
          error: '사용자 비밀번호가 올바르지 않습니다.',
          code: 'INVALID_USER_PASSWORD'
        });
      }

      res.status(500).json({
        error: '인증서 정보 수정 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_UPDATE_ERROR'
      });
    }
  }

  // 인증서 비활성화
  static async deactivateCredential(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const credential = await TaxCredential.findActiveById(id);
      if (!credential) {
        return res.status(404).json({
          error: '인증서를 찾을 수 없습니다.',
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      // 본인 또는 관리자만 비활성화 가능
      if (credential.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          error: '접근 권한이 없습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
      }

      await credential.deactivate();

      logSecurity('Credential deactivated', {
        userId,
        credentialId: id,
        ip: req.ip
      });

      res.json({
        message: '인증서가 비활성화되었습니다.'
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.deactivateCredential' });
      res.status(500).json({
        error: '인증서 비활성화 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_DEACTIVATE_ERROR'
      });
    }
  }

  // 인증서 삭제
  static async deleteCredential(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const credential = await TaxCredential.findById(id);
      if (!credential) {
        return res.status(404).json({
          error: '인증서를 찾을 수 없습니다.',
          code: 'CREDENTIAL_NOT_FOUND'
        });
      }

      // 본인 또는 관리자만 삭제 가능
      if (credential.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          error: '접근 권한이 없습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
      }

      await credential.delete();

      logSecurity('Credential deleted', {
        userId,
        credentialId: id,
        ip: req.ip
      });

      res.json({
        success: true
      });
    } catch (error) {
      logError(error, { operation: 'CredentialController.deleteCredential' });
      res.status(500).json({
        error: '인증서 삭제 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_DELETE_ERROR'
      });
    }
  }

  // 인증서 연결 테스트
  static async testConnection(req, res) {
    try {
      const { clientId, certData, privateKey, certPassword } = req.body;

      if (!clientId || !certData || !privateKey || !certPassword) {
        return res.status(400).json({
          error: '모든 필드를 입력해주세요.',
          code: 'MISSING_PARAMETERS'
        });
      }

      // 사업자등록번호 형식 검증
      if (!/^[0-9]{10}$/.test(clientId)) {
        return res.status(400).json({
          error: '사업자등록번호는 10자리 숫자여야 합니다.',
          code: 'INVALID_CLIENT_ID_FORMAT'
        });
      }

      // 중복 검사: DB에 이미 해당 사업자등록번호가 있으면 안 됨 (신규 등록용)
      // 이 검사를 먼저 수행하여 불필요한 API 호출을 방지
      const existingCredential = await TaxCredential.findByClientId(clientId);
      if (existingCredential) {
        console.log('Duplicate credential found, returning error');
        return res.status(409).json({
          error: '입력하신 사업자등록번호의 인증서가 이미 등록되어 있습니다.',
          code: 'CREDENTIAL_ALREADY_EXISTS'
        });
      }

      console.log('No duplicate found, proceeding with API call');
      
      // Hyphen API를 통한 실제 연결 테스트
      const axios = require('axios');
      
      // 개행문자 제거 (PEM 데이터에서 \n, \r 제거)
      const cleanCertData = certData.replace(/[\r\n]/g, '');
      const cleanPrivateKey = privateKey.replace(/[\r\n]/g, '');
      
      try {
        console.log('Calling Hyphen API with clientId:', clientId);
        const response = await axios.post('https://api.hyphen.im/in0076000245', {
          loginMethod: 'CERT',
          signCert: cleanCertData,
          signPri: cleanPrivateKey,
          signPw: certPassword,
          bizNo: clientId
        }, {
          headers: {
            'hyphen-gustation': 'Y',
            'user-id': 'demaglobal',
            'Hkey': 'e77b55a09b7a8f2d',
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10초 타임아웃
        });

        console.log('Hyphen API response received:', JSON.stringify(response.data).substring(0, 200));

        // Hyphen API 응답 구조 확인
        // 응답은 { common: {...}, data: {...} } 형태
        const commonData = response.data?.common;
        
        console.log('commonData:', JSON.stringify(commonData));

        // errYn이 "Y"이면 에러
        if (commonData?.errYn === 'Y') {
          const errorMessage = commonData.errMsg || '연결 테스트에 실패했습니다.';
          const errorCode = commonData.errCd;

          logSecurity('Credential connection test failed', {
            clientId,
            userId: req.user?.id,
            errorCode,
            errorMessage,
            ip: req.ip
          });

          // HDM016 에러 코드 특별 처리
          if (errorCode === 'HDM016') {
            return res.status(400).json({
              error: '잠시 후에 다시 시도하세요.',
              code: 'HDM016',
              details: {
                errCd: errorCode,
                errMsg: errorMessage
              }
            });
          }

          return res.status(400).json({
            error: errorMessage,
            code: errorCode || 'CONNECTION_TEST_FAILED',
            details: {
              errCd: errorCode,
              errMsg: errorMessage
            }
          });
        }

        // errYn이 "N"이면 성공
        logSecurity('Credential connection tested successfully', {
          clientId,
          userId: req.user?.id,
          ip: req.ip
        });

        res.json({
          message: '연결 테스트에 성공했습니다.',
          isValidConnection: true
        });
      } catch (apiError) {
        logError(apiError, { operation: 'CredentialController.testConnection.HyphenAPI' });
        
        // 네트워크 에러나 기타 예외 처리
        return res.status(500).json({
          error: '연결 테스트 중 오류가 발생했습니다.',
          code: 'CONNECTION_TEST_ERROR',
          details: apiError.message
        });
      }
    } catch (error) {
      logError(error, { operation: 'CredentialController.testConnection' });

      res.status(500).json({
        error: '연결 테스트 중 오류가 발생했습니다.',
        code: 'CONNECTION_TEST_ERROR'
      });
    }
  }

  // 모든 인증서 조회 (관리자용)
  static async getAllCredentials(req, res) {
    try {
      const { page = 1, limit = 10, userId, certType, isActive, expired } = req.query;

      const result = await TaxCredential.findAll(parseInt(page), parseInt(limit), {
        userId,
        certType,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        expired
      });

      res.json(result);
    } catch (error) {
      logError(error, { operation: 'CredentialController.getAllCredentials' });
      res.status(500).json({
        error: '인증서 목록 조회 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_LIST_ERROR'
      });
    }
  }

  // 인증서 통계 조회
  static async getCredentialStats(req, res) {
    try {
      const stats = await TaxCredential.getStats();
      res.json(stats);
    } catch (error) {
      logError(error, { operation: 'CredentialController.getCredentialStats' });
      res.status(500).json({
        error: '인증서 통계 조회 중 오류가 발생했습니다.',
        code: 'CREDENTIAL_STATS_ERROR'
      });
    }
  }
}

module.exports = CredentialController;
