const { query } = require('../config/supabase');
const { logError, logger } = require('../utils/logger');
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
      name: '무료',
      price: 0,
      monthlyCredits: 10,
      billingCycle: 'monthly',
      popular: false,
      description: '개인 사용자를 위한 무료 플랜',
      features: [
        '월 10 크레딧',
        '기본 기능',
        '커뮤니티 지원'
      ],
      limitations: [
        '제한된 API 호출',
        '표준 처리 속도'
      ]
    },
    starter: {
      name: '스타터',
      price: 29000,
      monthlyCredits: 100,
      billingCycle: 'monthly',
      popular: false,
      description: '소규모 비즈니스를 위한 시작 플랜',
      features: [
        '월 100 크레딧',
        '모든 기본 기능',
        '이메일 지원',
        '월간 리포트'
      ],
      limitations: []
    },
    starter_yearly: {
      name: '스타터 (연간)',
      price: 313200, // 29000 × 12 × 0.9 (10% 할인)
      monthlyCredits: 100,
      billingCycle: 'yearly',
      popular: false,
      description: '소규모 비즈니스를 위한 시작 플랜 (연간 결제 시 10% 할인)',
      features: [
        '월 100 크레딧',
        '모든 기본 기능',
        '이메일 지원',
        '월간 리포트',
        '연간 10% 할인'
      ],
      limitations: []
    },
    professional: {
      name: '프로페셔널',
      price: 79000,
      monthlyCredits: 300,
      billingCycle: 'monthly',
      popular: true,
      description: '전문가와 성장하는 비즈니스를 위한 플랜',
      features: [
        '월 300 크레딧',
        '모든 고급 기능',
        '우선 이메일 지원',
        '전화 지원',
        '주간 리포트',
        'API 접근'
      ],
      limitations: []
    },
    professional_yearly: {
      name: '프로페셔널 (연간)',
      price: 852800, // 79000 × 12 × 0.9 (10% 할인)
      monthlyCredits: 300,
      billingCycle: 'yearly',
      popular: true,
      description: '전문가와 성장하는 비즈니스를 위한 플랜 (연간 결제 시 10% 할인)',
      features: [
        '월 300 크레딧',
        '모든 고급 기능',
        '우선 이메일 지원',
        '전화 지원',
        '주간 리포트',
        'API 접근',
        '연간 10% 할인'
      ],
      limitations: []
    },
    business: {
      name: '비즈니스',
      price: 199000,
      monthlyCredits: 1000,
      billingCycle: 'monthly',
      popular: false,
      description: '대규모 비즈니스를 위한 프리미엄 플랜',
      features: [
        '월 1,000 크레딧',
        '모든 프리미엄 기능',
        '전담 계정 매니저',
        '24/7 우선 지원',
        '일간 리포트',
        '고급 API 접근',
        '커스텀 통합'
      ],
      limitations: []
    },
    business_yearly: {
      name: '비즈니스 (연간)',
      price: 2148800, // 199000 × 12 × 0.9 (10% 할인)
      monthlyCredits: 1000,
      billingCycle: 'yearly',
      popular: false,
      description: '대규모 비즈니스를 위한 프리미엄 플랜 (연간 결제 시 10% 할인)',
      features: [
        '월 1,000 크레딧',
        '모든 프리미엄 기능',
        '전담 계정 매니저',
        '24/7 우선 지원',
        '일간 리포트',
        '고급 API 접근',
        '커스텀 통합',
        '연간 10% 할인'
      ],
      limitations: []
    },
    enterprise: {
      name: '엔터프라이즈',
      price: null,
      monthlyCredits: null,
      billingCycle: 'custom',
      popular: false,
      description: '대기업을 위한 맞춤형 솔루션',
      features: [
        '무제한 크레딧',
        '맞춤형 솔루션',
        '전담 기술 지원팀',
        '24/7 프리미엄 지원',
        '실시간 리포트',
        '전용 서버 옵션',
        '온프레미스 배포 가능',
        'SLA 보장',
        '맞춤형 계약'
      ],
      limitations: [],
      isCustom: true
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
      
      // 연간 구독이면 1년, 월간 구독이면 1개월
      if (tierConfig.billingCycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }

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

      // 모든 active 구독을 가져와서 JavaScript로 필터링
      const result = await query('subscriptions', 'select', {
        where: { status: 'active' }
      });

      if (result.error) {
        throw result.error;
      }

      // next_billing_date가 오늘 이하인 구독 필터링
      const subscriptions = (result.data || [])
        .filter(item => item.next_billing_date <= today)
        .map(item => new Subscription(item));

      return subscriptions;
    } catch (error) {
      logError(error, { operation: 'Subscription.findDueForRenewal' });
      throw error;
    }
  }

  /**
   * 만료된 구독 조회 (크론잡용)
   */
  static async findExpired() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // suspended 또는 cancelled 상태인 구독을 모두 가져옴
      const result = await query('subscriptions', 'select', {});

      if (result.error) {
        throw result.error;
      }

      // billing_cycle_end가 오늘보다 이전이고, suspended 또는 cancelled 상태인 구독 필터링
      const subscriptions = (result.data || [])
        .filter(item => 
          item.billing_cycle_end < today && 
          (item.status === 'suspended' || item.status === 'cancelled')
        )
        .map(item => new Subscription(item));

      return subscriptions;
    } catch (error) {
      logError(error, { operation: 'Subscription.findExpired' });
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
   * 티어 변경 (일할계산 및 크레딧 지급)
   */
  async changeTier(newTier) {
    try {
      const oldTierConfig = Subscription.TIERS[this.tier];
      const newTierConfig = Subscription.TIERS[newTier];
      
      if (!newTierConfig) {
        throw new Error('유효하지 않은 티어입니다.');
      }

      // 일할계산: 남은 기간 계산
      const now = new Date();
      const cycleEnd = new Date(this.billingCycleEnd);
      const cycleStart = new Date(this.billingCycleStart);
      
      // 전체 기간 (일)
      const totalDays = Math.ceil((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24));
      // 남은 기간 (일)
      const remainingDays = Math.ceil((cycleEnd - now) / (1000 * 60 * 60 * 24));
      
      // 남은 기간 비율
      const remainingRatio = remainingDays / totalDays;

      // 일할계산된 크레딧 (남은 기간에 비례, null 체크)
      const proratedCredits = newTierConfig.monthlyCredits 
        ? Math.floor(newTierConfig.monthlyCredits * remainingRatio)
        : 0;

      logger.info('구독 티어 변경 - 일할계산', {
        userId: this.userId,
        oldTier: this.tier,
        newTier,
        totalDays,
        remainingDays,
        remainingRatio,
        fullCredits: newTierConfig.monthlyCredits,
        proratedCredits
      });

      // 티어 업데이트
      await this.update({
        tier: newTier,
        monthly_credit_quota: newTierConfig.monthlyCredits,
        price: newTierConfig.price
      });

      // users 테이블 업데이트
      await query('users', 'update', {
        where: { id: this.userId },
        data: { subscription_tier: newTier }
      });

      // 일할계산된 크레딧 지급 (0보다 클 때만)
      if (proratedCredits > 0 && newTierConfig.monthlyCredits) {
        await CreditTransaction.create({
          userId: this.userId,
          amount: proratedCredits,
          type: 'subscription_grant',
          description: `${newTierConfig.name} 플랜 업그레이드 (일할계산: ${remainingDays}일/${totalDays}일)`,
          relatedId: this.id,
          expiresAt: cycleEnd.toISOString()
        });
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
   * 구독 재활성화 (취소된 구독 부활)
   */
  async reactivate() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 이미 만료된 구독은 재활성화 불가
      if (this.billingCycleEnd < today) {
        throw new Error('만료된 구독은 재활성화할 수 없습니다.');
      }

      // 다음 결제일을 현재 주기 종료일로 설정
      await this.update({
        status: 'active',
        next_billing_date: this.billingCycleEnd
      });

      logger.info('구독 재활성화', { subscriptionId: this.id, userId: this.userId });

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.reactivate', subscriptionId: this.id });
      throw error;
    }
  }

  /**
   * 구독 갱신 (결제 후 호출)
   */
  async renew() {
    try {
      const tierConfig = Subscription.TIERS[this.tier];
      const start = new Date();
      const end = new Date(start);
      
      // 연간 구독이면 1년, 월간 구독이면 1개월
      if (tierConfig.billingCycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }

      const nextBilling = new Date(end);

      await this.update({
        billing_cycle_start: start.toISOString().split('T')[0],
        billing_cycle_end: end.toISOString().split('T')[0],
        next_billing_date: nextBilling.toISOString().split('T')[0],
        status: 'active'
      });

      // 크레딧 지급
      if (this.monthlyCreditQuota > 0) {
        await CreditTransaction.grantSubscription(
          this.userId,
          this.monthlyCreditQuota,
          `${tierConfig.name} 플랜 크레딧 지급`,
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
   * 구독 일시정지 (결제 실패 등)
   */
  async suspend(reason = null) {
    try {
      await this.update({
        status: 'suspended',
        metadata: { 
          ...this.metadata, 
          suspend_reason: reason,
          suspended_at: new Date().toISOString()
        }
      });

      logger.info('구독 일시정지', { subscriptionId: this.id, reason });

      return this;
    } catch (error) {
      logError(error, { operation: 'Subscription.suspend', subscriptionId: this.id });
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

