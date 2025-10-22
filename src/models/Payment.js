const { query } = require('../config/supabase');
const { logError } = require('../utils/logger');

/**
 * 결제 정보 모델
 */
class Payment {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.orderId = data.order_id;
    this.orderName = data.order_name;
    this.amount = data.amount;
    this.paymentType = data.payment_type;
    this.relatedId = data.related_id;
    this.tid = data.tid;
    this.payMethod = data.pay_method;
    this.cardName = data.card_name;
    this.cardNum = data.card_num;
    this.status = data.status;
    this.billingKey = data.billing_key;
    this.paidAt = data.paid_at;
    this.cancelledAt = data.cancelled_at;
    this.refundedAt = data.refunded_at;
    this.failCode = data.fail_code;
    this.failMessage = data.fail_message;
    this.metadata = data.metadata;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * 결제 생성 (주문 생성)
   */
  static async create({ userId, orderId, orderName, amount, paymentType, relatedId, metadata = {} }) {
    try {
      const result = await query('payments', 'insert', {
        data: {
          user_id: userId,
          order_id: orderId,
          order_name: orderName,
          amount,
          payment_type: paymentType,
          related_id: relatedId,
          status: 'pending',
          metadata
        }
      });

      if (result.error) {
        throw result.error;
      }

      return new Payment(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Payment.create', userId, orderId });
      throw error;
    }
  }

  /**
   * 주문 ID로 결제 조회
   */
  static async findByOrderId(orderId) {
    try {
      const result = await query('payments', 'select', {
        where: { order_id: orderId },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new Payment(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Payment.findByOrderId', orderId });
      throw error;
    }
  }

  /**
   * 나이스페이 TID로 결제 조회
   */
  static async findByTid(tid) {
    try {
      const result = await query('payments', 'select', {
        where: { tid },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new Payment(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Payment.findByTid', tid });
      throw error;
    }
  }

  /**
   * ID로 결제 조회
   */
  static async findById(id) {
    try {
      const result = await query('payments', 'select', {
        where: { id },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new Payment(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Payment.findById', id });
      throw error;
    }
  }

  /**
   * 사용자별 결제 내역 조회
   */
  static async findByUserId(userId, { page = 1, limit = 10, status = null } = {}) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = { user_id: userId };
      
      if (status) {
        whereClause.status = status;
      }

      const result = await query('payments', 'select', {
        where: whereClause,
        offset,
        limit
      });

      if (result.error) {
        throw result.error;
      }

      // 전체 개수 조회
      const countResult = await query('payments', 'select', {
        where: whereClause,
        columns: 'id'
      });

      return {
        payments: (result.data || []).map(data => new Payment(data)),
        totalCount: countResult.data?.length || 0
      };
    } catch (error) {
      logError(error, { operation: 'Payment.findByUserId', userId });
      throw error;
    }
  }

  /**
   * 결제 정보 업데이트
   */
  async update(data) {
    try {
      const result = await query('payments', 'update', {
        where: { id: this.id },
        data
      });

      if (result.error) {
        throw result.error;
      }

      // 객체 속성 업데이트
      Object.assign(this, result.data[0]);

      return this;
    } catch (error) {
      logError(error, { operation: 'Payment.update', paymentId: this.id });
      throw error;
    }
  }

  /**
   * 결제 완료 처리
   */
  async markAsPaid({ tid, payMethod, cardName, cardNum, billingKey = null }) {
    try {
      await this.update({
        status: 'paid',
        tid,
        pay_method: payMethod,
        card_name: cardName,
        card_num: cardNum,
        billing_key: billingKey,
        paid_at: new Date().toISOString()
      });

      return this;
    } catch (error) {
      logError(error, { operation: 'Payment.markAsPaid', paymentId: this.id });
      throw error;
    }
  }

  /**
   * 결제 실패 처리
   */
  async markAsFailed({ failCode, failMessage }) {
    try {
      await this.update({
        status: 'failed',
        fail_code: failCode,
        fail_message: failMessage
      });

      return this;
    } catch (error) {
      logError(error, { operation: 'Payment.markAsFailed', paymentId: this.id });
      throw error;
    }
  }

  /**
   * 결제 취소 처리
   */
  async markAsCancelled() {
    try {
      await this.update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      return this;
    } catch (error) {
      logError(error, { operation: 'Payment.markAsCancelled', paymentId: this.id });
      throw error;
    }
  }

  /**
   * 환불 처리
   */
  async markAsRefunded() {
    try {
      await this.update({
        status: 'refunded',
        refunded_at: new Date().toISOString()
      });

      return this;
    } catch (error) {
      logError(error, { operation: 'Payment.markAsRefunded', paymentId: this.id });
      throw error;
    }
  }

  /**
   * JSON 변환
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      orderId: this.orderId,
      orderName: this.orderName,
      amount: this.amount,
      paymentType: this.paymentType,
      relatedId: this.relatedId,
      tid: this.tid,
      payMethod: this.payMethod,
      cardName: this.cardName,
      cardNum: this.cardNum,
      status: this.status,
      billingKey: this.billingKey,
      paidAt: this.paidAt,
      cancelledAt: this.cancelledAt,
      refundedAt: this.refundedAt,
      failCode: this.failCode,
      failMessage: this.failMessage,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Payment;

