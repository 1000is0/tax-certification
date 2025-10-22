const { query } = require('../config/supabase');
const { logError } = require('../utils/logger');

/**
 * 크레딧 거래 모델
 */
class CreditTransaction {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.amount = data.amount;
    this.balanceAfter = data.balance_after;
    this.type = data.type;
    this.description = data.description;
    this.relatedId = data.related_id;
    this.expiresAt = data.expires_at;
    this.metadata = data.metadata;
    this.createdAt = data.created_at;
  }

  /**
   * 크레딧 거래 생성 (잔액 자동 업데이트)
   */
  static async create({ userId, amount, type, description, relatedId = null, expiresAt = null, metadata = null }) {
    try {
      // 트랜잭션으로 처리해야 하지만, Supabase는 RPC 필요
      // 여기서는 순차적으로 처리 (PostgreSQL 함수로 개선 가능)

      // 1. 현재 잔액 조회
      const userResult = await query('users', 'select', {
        where: { id: userId },
        columns: 'credit_balance'
      });

      if (userResult.error || !userResult.data || userResult.data.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      const currentBalance = userResult.data[0].credit_balance || 0;
      const newBalance = currentBalance + amount;

      // 잔액 부족 체크 (차감 시)
      if (amount < 0 && newBalance < 0) {
        throw new Error('크레딧이 부족합니다.');
      }

      // 2. 거래 기록 생성
      const transactionResult = await query('credit_transactions', 'insert', {
        data: {
          user_id: userId,
          amount,
          balance_after: newBalance,
          type,
          description,
          related_id: relatedId,
          expires_at: expiresAt,
          metadata
        }
      });

      if (transactionResult.error) {
        throw transactionResult.error;
      }

      // 3. 사용자 잔액 업데이트
      const updateResult = await query('users', 'update', {
        where: { id: userId },
        data: { credit_balance: newBalance }
      });

      if (updateResult.error) {
        throw updateResult.error;
      }

      return new CreditTransaction(transactionResult.data[0]);
    } catch (error) {
      logError(error, { operation: 'CreditTransaction.create', userId, amount, type });
      throw error;
    }
  }

  /**
   * 사용자의 크레딧 거래 이력 조회
   */
  static async findByUserId(userId, { limit = 50, offset = 0, type = null } = {}) {
    try {
      const options = {
        where: { user_id: userId },
        order: { created_at: 'desc' },
        limit,
        offset
      };

      if (type) {
        options.where.type = type;
      }

      const result = await query('credit_transactions', 'select', options);

      if (result.error) {
        throw result.error;
      }

      return (result.data || []).map(item => new CreditTransaction(item));
    } catch (error) {
      logError(error, { operation: 'CreditTransaction.findByUserId', userId });
      throw error;
    }
  }

  /**
   * 사용자의 현재 크레딧 잔액 조회
   */
  static async getBalance(userId) {
    try {
      const result = await query('users', 'select', {
        where: { id: userId },
        columns: 'credit_balance, subscription_tier'
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return { balance: 0, tier: 'free' };
      }

      return {
        balance: result.data[0].credit_balance || 0,
        tier: result.data[0].subscription_tier || 'free'
      };
    } catch (error) {
      logError(error, { operation: 'CreditTransaction.getBalance', userId });
      throw error;
    }
  }

  /**
   * 만료된 크레딧 조회 (크론잡용)
   */
  static async findExpired() {
    try {
      const result = await query('credit_transactions', 'select', {
        where: {
          expires_at: { $lte: new Date().toISOString() },
          type: 'subscription_grant' // 구독 크레딧만 만료
        }
      });

      if (result.error) {
        throw result.error;
      }

      return (result.data || []).map(item => new CreditTransaction(item));
    } catch (error) {
      logError(error, { operation: 'CreditTransaction.findExpired' });
      throw error;
    }
  }

  /**
   * 크레딧 사용 (차감)
   */
  static async deduct(userId, amount, description, relatedId = null) {
    if (amount <= 0) {
      throw new Error('차감할 크레딧은 양수여야 합니다.');
    }

    return this.create({
      userId,
      amount: -amount, // 음수로 저장
      type: 'usage',
      description,
      relatedId
    });
  }

  /**
   * 크레딧 충전 (구매)
   */
  static async charge(userId, amount, description, relatedId = null) {
    if (amount <= 0) {
      throw new Error('충전할 크레딧은 양수여야 합니다.');
    }

    return this.create({
      userId,
      amount,
      type: 'purchase',
      description,
      relatedId,
      expiresAt: null // 구매 크레딧은 만료 없음
    });
  }

  /**
   * 구독 크레딧 지급 (만료일 포함)
   */
  static async grantSubscription(userId, amount, description, expiresAt) {
    if (amount <= 0) {
      throw new Error('지급할 크레딧은 양수여야 합니다.');
    }

    return this.create({
      userId,
      amount,
      type: 'subscription_grant',
      description,
      expiresAt
    });
  }

  /**
   * 관리자 크레딧 지급
   */
  static async adminGrant(userId, amount, description, adminId) {
    return this.create({
      userId,
      amount,
      type: 'admin_grant',
      description,
      metadata: { granted_by: adminId }
    });
  }

  /**
   * JSON 변환
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      amount: this.amount,
      balanceAfter: this.balanceAfter,
      type: this.type,
      description: this.description,
      relatedId: this.relatedId,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

module.exports = CreditTransaction;

