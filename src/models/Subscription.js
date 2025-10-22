const { query } = require('../config/supabase');
const { logError } = require('../utils/logger');
const CreditTransaction = require('./CreditTransaction');

/**
 * 구독 모델
 */
class Subscription {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.tier = data.tier;
    this.status = data.status;
    this.billingKey = data.billing_key;
    this.billingCycleStart = data.billing_cycle_start;
    this.billingCycleEnd = data.billing_cycle_end;
    this.nextBillingDate = data.next_billing_date;
    this.monthlyCreditQuota = data.monthly_credit_quota;
    this.price = data.price;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * 구독 티어 설정
   */
  static TIERS = {
    free: {
      name: 'Free',
      price: 0,
      monthlyCredits: 0,
      features: ['기본 기능']
    },
    basic: {
      name: 'Basic',
      price: 29000,
      monthlyCredits: 100,
      features: ['월 100 크레딧', '기본 지원']
    },
    pro: {
      name: 'Pro',
      price: 99000,
      monthlyCredits: 500,
      features: ['월 500 크레딧', '우선 지원', 'API 접근']
    },
    enterprise: {
      name: 'Enterprise',
      price: 299000,
      monthlyCredits: 2000,
      features: ['월 2000 크레딧', '전담 지원', 'API 무제한', '커스텀 기능']
    }
  };

  /**
   * 구독 생성
   */
  static async create({ userId, tier, billingKey = null, startDate = null }) {
    try {
      const tierConfig = this.TIERS[tier];
      if (!tierConfig) {
        throw new Error('유효하지 않은 티어입니다.');
      }

      const start = startDate ? new Date(startDate) : new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const nextBilling = new Date(end);

      const result = await query('subscriptions', 'insert', {
        data: {
          user_id: userId,
          tier,
          status: 'active',
          billing_key: billingKey,
          billing_cycle_start: start.toISOString().split('T')[0],
          billing_cycle_end: end.toISOString().split('T')[0],
          next_billing_date: nextBilling.toISOString().split('T')[0],
          monthly_credit_quota: tierConfig.monthlyCredits,
          price: tierConfig.price
        }
      });

      if (result.error) {
        throw result.error;
      }

      // users 테이블의 subscription_tier 업데이트
      await query('users', 'update', {
        where: { id: userId },
        data: { subscription_tier: tier }
      });

      // 크레딧 지급 (Free 티어 제외)
      if (tierConfig.monthlyCredits > 0) {
        await CreditTransaction.grantSubscription(
          userId,
          tierConfig.monthlyCredits,
          `${tierConfig.name} 플랜 월 크레딧 지급`,
          end.toISOString()
        );
      }

      return new Subscription(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Subscription.create', userId, tier });
      throw error;
    }
  }

  /**
   * 사용자의 구독 조회
   */
  static async findByUserId(userId) {
    try {
      const result = await query('subscriptions', 'select', {
        where: { user_id: userId },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new Subscription(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Subscription.findByUserId', userId });
      throw error;
    }
  }

  /**
   * ID로 구독 조회
   */
  static async findById(id) {
    try {
      const result = await query('subscriptions', 'select', {
        where: { id },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new Subscription(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'Subscription.findById', id });
      throw error;
    }
  }

  /**
   * 갱신이 필요한 구독 조회 (크론잡용)
   */
  static async findDueForRenewal() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const result = await query('subscriptions', 'select', {
        where: {
          status: 'active',
          next_billing_date: { $lte: today }
        }
      });

      if (result.error) {
        throw result.error;
      }

      return (result.data || []).map(item => new Subscription(item));
    } catch (error) {
      logError(error, { operation: 'Subscription.findDueForRenewal' });
      throw error;
    }
  }

  /**
   * 구독 업데이트
   */
  async update(data) {
    try {
      const result = await query('subscriptions', 'update', {
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
      logError(error, { operation: 'Subscription.update', subscriptionId: this.id });
      throw error;
    }
  }

  /**
   * 티어 변경
   */
  async changeTier(newTier) {
    try {
      const tierConfig = Subscription.TIERS[newTier];
      if (!tierConfig) {
        throw new Error('유효하지 않은 티어입니다.');
      }

      // 티어 업데이트
      await this.update({
        tier: newTier,
        monthly_credit_quota: tierConfig.monthlyCredits,
        price: tierConfig.price
      });

      // users 테이블 업데이트
      await query('users', 'update', {
        where: { id: this.userId },
        data: { subscription_tier: newTier }
      });

      // 즉시 새 티어의 크레딧 지급 (프로레이션은 나중에 구현)
      if (tierConfig.monthlyCredits > 0) {
        const endDate = new Date(this.billingCycleEnd);
        await CreditTransaction.grantSubscription(
          this.userId,
          tierConfig.monthlyCredits,
          `${tierConfig.name} 플랜으로 업그레이드 - 크레딧 지급`,
          endDate.toISOString()
        );
      }

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.changeTier', subscriptionId: this.id, newTier });
      throw error;
    }
  }

  /**
   * 구독 취소
   */
  async cancel() {
    try {
      await this.update({
        status: 'cancelled',
        next_billing_date: null
      });

      // users 테이블을 free로 변경하지 않음 (현재 주기가 끝날 때까지 유지)

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.cancel', subscriptionId: this.id });
      throw error;
    }
  }

  /**
   * 구독 갱신 (결제 후 호출)
   */
  async renew() {
    try {
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const nextBilling = new Date(end);

      await this.update({
        billing_cycle_start: start.toISOString().split('T')[0],
        billing_cycle_end: end.toISOString().split('T')[0],
        next_billing_date: nextBilling.toISOString().split('T')[0],
        status: 'active'
      });

      // 크레딧 지급
      if (this.monthlyCreditQuota > 0) {
        const tierConfig = Subscription.TIERS[this.tier];
        await CreditTransaction.grantSubscription(
          this.userId,
          this.monthlyCreditQuota,
          `${tierConfig.name} 플랜 월 크레딧 지급`,
          end.toISOString()
        );
      }

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.renew', subscriptionId: this.id });
      throw error;
    }
  }

  /**
   * 구독 만료 처리
   */
  async expire() {
    try {
      await this.update({
        status: 'expired'
      });

      // users 테이블을 free로 변경
      await query('users', 'update', {
        where: { id: this.userId },
        data: { subscription_tier: 'free' }
      });

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.expire', subscriptionId: this.id });
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
      tier: this.tier,
      tierName: Subscription.TIERS[this.tier]?.name || this.tier,
      status: this.status,
      billingCycleStart: this.billingCycleStart,
      billingCycleEnd: this.billingCycleEnd,
      nextBillingDate: this.nextBillingDate,
      monthlyCreditQuota: this.monthlyCreditQuota,
      price: this.price,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Subscription;

