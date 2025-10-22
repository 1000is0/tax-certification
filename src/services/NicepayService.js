const axios = require('axios');
const crypto = require('crypto');
const { logError, logger } = require('../utils/logger');

/**
 * 나이스페이 API 서비스
 */
class NicepayService {
  constructor() {
    this.clientId = process.env.NICEPAY_CLIENT_ID;
    this.secretKey = process.env.NICEPAY_SECRET_KEY;
    this.apiUrl = process.env.NICEPAY_API_URL || 'https://api.nicepay.co.kr';
  }

  /**
   * API 요청 헤더 생성 (Server Key 방식)
   */
  getHeaders() {
    // Client ID와 Secret Key를 Base64로 인코딩
    const credentials = Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64');
    
    logger.info('나이스페이 인증 헤더 생성', { 
      clientId: this.clientId?.substring(0, 10) + '...', 
      hasSecretKey: !!this.secretKey,
      authHeader: `Basic ${credentials.substring(0, 20)}...`
    });
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`
    };
  }

  /**
   * 결제 준비 (클라이언트 토큰 발급)
   */
  async preparePayment({ orderId, amount, goodsName, returnUrl, mallUserId, directPayMethod }) {
    try {
      const requestData = {
        orderId,
        amount,
        goodsName,
        returnUrl,
        mallUserId
      };

      // 결제 수단 제한이 있는 경우 추가
      if (directPayMethod) {
        requestData.payMethod = directPayMethod;
      }

      const response = await axios.post(
        `${this.apiUrl}/v1/payments/ready`,
        requestData,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 결제 준비 성공', { orderId });
      
      return {
        success: true,
        clientToken: response.data.clientToken,
        orderId: response.data.orderId
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.preparePayment', 
        orderId,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '결제 준비에 실패했습니다.'
      };
    }
  }

  /**
   * 결제 승인
   */
  async approvePayment({ tid, amount }) {
    try {
      const requestData = { amount };

      // 나이스페이 신버전 API 승인 엔드포인트 (여러 가능성 시도)
      const response = await axios.post(
        `${this.apiUrl}/v1/payments/${tid}`, // /approve 제거
        requestData,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 결제 승인 성공', { tid });

      const data = response.data;
      
      return {
        success: true,
        tid: data.tid,
        orderId: data.orderId,
        amount: data.amount,
        paidAt: data.paidAt,
        payMethod: data.payMethod,
        cardName: data.card?.cardName,
        cardNum: data.card?.cardNum,
        billingKey: data.billingKey // 정기결제용
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.approvePayment', 
        tid,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '결제 승인에 실패했습니다.',
        code: error.response?.data?.code
      };
    }
  }

  /**
   * 결제 취소
   */
  async cancelPayment({ tid, amount, reason, cancelTaxFreeAmount = 0 }) {
    try {
      const requestData = {
        amount,
        reason,
        cancelTaxFreeAmount
      };

      const response = await axios.post(
        `${this.apiUrl}/v1/payments/${tid}/cancel`,
        requestData,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 결제 취소 성공', { tid });

      return {
        success: true,
        tid: response.data.tid,
        cancelledAt: response.data.cancelledAt,
        cancelAmount: response.data.cancelAmount
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.cancelPayment', 
        tid,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '결제 취소에 실패했습니다.'
      };
    }
  }

  /**
   * 결제 조회
   */
  async getPayment(tid) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v1/payments/${tid}`,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        payment: response.data
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.getPayment', 
        tid,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '결제 조회에 실패했습니다.'
      };
    }
  }

  /**
   * 빌링키 발급 (정기결제용)
   */
  async issueBillingKey({ orderId, encData }) {
    try {
      const requestData = {
        orderId,
        encData
      };

      const response = await axios.post(
        `${this.apiUrl}/v1/subscribe/regist`,
        requestData,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 빌링키 발급 성공', { orderId });

      return {
        success: true,
        billingKey: response.data.billingKey,
        cardName: response.data.card?.cardName,
        cardNum: response.data.card?.cardNum
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.issueBillingKey', 
        orderId,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '빌링키 발급에 실패했습니다.'
      };
    }
  }

  /**
   * 빌링키로 결제 (정기결제)
   */
  async payWithBillingKey({ billingKey, orderId, amount, goodsName, mallUserId }) {
    try {
      const requestData = {
        orderId,
        amount,
        goodsName,
        mallUserId,
        billingKey
      };

      const response = await axios.post(
        `${this.apiUrl}/v1/subscribe/payments`,
        requestData,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 빌링키 결제 성공', { orderId, billingKey });

      const data = response.data;
      
      return {
        success: true,
        tid: data.tid,
        orderId: data.orderId,
        amount: data.amount,
        paidAt: data.paidAt
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.payWithBillingKey', 
        orderId, 
        billingKey,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '빌링키 결제에 실패했습니다.',
        code: error.response?.data?.code
      };
    }
  }

  /**
   * 빌링키 삭제
   */
  async deleteBillingKey(billingKey) {
    try {
      const response = await axios.delete(
        `${this.apiUrl}/v1/subscribe/${billingKey}`,
        { headers: this.getHeaders() }
      );

      logger.info('나이스페이 빌링키 삭제 성공', { billingKey });

      return {
        success: true
      };
    } catch (error) {
      logError(error, { 
        operation: 'NicepayService.deleteBillingKey', 
        billingKey,
        response: error.response?.data 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || '빌링키 삭제에 실패했습니다.'
      };
    }
  }
}

module.exports = new NicepayService();

