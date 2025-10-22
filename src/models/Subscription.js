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
    this.pendingTier = data.pending_tier; // 다음 결제일부터 적용될 티어 (다운그레이드 시)
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
    test_hourly: {
      name: '테스트 (1시간)',
      price: 100,
      monthlyCredits: 10,
      billingCycle: 'hourly',
      popular: false,
      description: '1시간마다 갱신되는 테스트 플랜',
      features: [
        '1시간마다 10 크레딧 지급',
        '자동 갱신 테스트용',
        '관리자 전용'
      ],
      limitations: [],
      isTest: true
    },
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
      
      // 구독 주기에 따라 종료일 설정
      if (tierConfig.billingCycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else if (tierConfig.billingCycle === 'hourly') {
        end.setHours(end.getHours() + 1);
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
   * 티어 변경 (업그레이드: 일할계산 + 추가결제, 다운그레이드: 다음 주기부터 적용)
   */
  async changeTier(newTier, paymentResult = null) {
    try {
      // pending_tier가 있으면 다운그레이드 예약 상태
      // 이 경우 현재 티어와 비교하는 것이 아니라 pending_tier와 비교
      const effectiveTier = this.pendingTier || this.tier;
      const oldTierConfig = Subscription.TIERS[effectiveTier];
      const newTierConfig = Subscription.TIERS[newTier];
      
      if (!newTierConfig) {
        throw new Error('유효하지 않은 티어입니다.');
      }

      // 업그레이드 여부 판단 (가격 비교)
      const isUpgrade = newTierConfig.price > (oldTierConfig.price || 0);
      const isDowngrade = newTierConfig.price < (oldTierConfig.price || 0);

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

      // 특별 케이스: pending_tier가 있고 현재 tier로 다시 변경하려는 경우 = 다운그레이드 취소
      if (this.pendingTier && newTier === this.tier) {
        logger.info('구독 다운그레이드 취소', {
          userId: this.userId,
          currentTier: this.tier,
          cancelledPendingTier: this.pendingTier
        });

        // pending_tier만 제거
        await this.update({
          pending_tier: null
        });

        return { 
          type: 'downgrade_cancelled', 
          message: `${newTierConfig.name} 플랜으로의 다운그레이드가 취소되었습니다. 현재 플랜이 계속 유지됩니다.` 
        };
      }

      if (isUpgrade) {

        // 업그레이드: 차액 결제 필요
        const oldPriceProrated = (oldTierConfig.price || 0) * remainingRatio;
        const newPriceProrated = newTierConfig.price * remainingRatio;
        const additionalCharge = Math.ceil(newPriceProrated - oldPriceProrated);

        logger.info('구독 업그레이드 - 일할계산', {
          userId: this.userId,
          oldTier: this.tier,
          newTier,
          totalDays,
          remainingDays,
          remainingRatio,
          oldPriceProrated,
          newPriceProrated,
          additionalCharge,
          paymentProvided: !!paymentResult
        });

        // 결제 정보가 없으면 오류
        if (!paymentResult) {
          throw new Error('업그레이드 시 추가 결제 정보가 필요합니다.');
        }

        // 일할계산된 크레딧 (업그레이드)
        const proratedCredits = newTierConfig.monthlyCredits 
          ? Math.floor(newTierConfig.monthlyCredits * remainingRatio)
          : 0;

        // 티어 업데이트 (pending_tier도 초기화)
        await this.update({
          tier: newTier,
          pending_tier: null,
          monthly_credit_quota: newTierConfig.monthlyCredits,
          price: newTierConfig.price
        });

        // users 테이블 업데이트
        await query('users', 'update', {
          where: { id: this.userId },
          data: { subscription_tier: newTier }
        });

        // 일할계산된 크레딧 지급
        if (proratedCredits > 0) {
          await CreditTransaction.create({
            userId: this.userId,
            amount: proratedCredits,
            type: 'subscription_grant',
            description: `${newTierConfig.name} 플랜 업그레이드 (일할계산: ${remainingDays}일/${totalDays}일)`,
            relatedId: this.id,
            expiresAt: cycleEnd.toISOString()
          });
        }

        return { type: 'upgrade', additionalCharge, proratedCredits };

      } else if (isDowngrade) {
        // 다운그레이드: pending_tier에 저장, 다음 주기부터 적용
        logger.info('구독 다운그레이드 - pending_tier 설정', {
          userId: this.userId,
          currentTier: this.tier,
          pendingTier: newTier,
          currentCycleEnd: this.billingCycleEnd,
          nextPrice: newTierConfig.price,
          nextCredits: newTierConfig.monthlyCredits
        });

        // pending_tier만 업데이트 (현재 티어와 크레딧은 유지)
        await this.update({
          pending_tier: newTier
        });

        // 크레딧 지급 없음 (현재 주기 크레딧 유지)
        return { type: 'downgrade', message: `다음 결제일(${this.billingCycleEnd})부터 ${newTierConfig.name} 플랜이 적용됩니다.` };

      } else {
        // 동일 가격 (예: monthly ↔ yearly)
        throw new Error('동일하거나 유효하지 않은 플랜 변경입니다.');
      }

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
      
      // 구독 주기에 따라 종료일 설정
      if (tierConfig.billingCycle === 'yearly') {
        end.setFullYear(end.getFullYear() + 1);
      } else if (tierConfig.billingCycle === 'hourly') {
        end.setHours(end.getHours() + 1);
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

