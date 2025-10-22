-- 결제 정보 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 주문 정보
  order_id VARCHAR(100) UNIQUE NOT NULL,
  order_name VARCHAR(200) NOT NULL,
  amount INTEGER NOT NULL,
  
  -- 결제 유형
  payment_type VARCHAR(50) NOT NULL, -- 'one_time_credit' or 'subscription'
  related_id VARCHAR(100), -- credit package id or subscription tier
  
  -- 나이스페이 정보
  tid VARCHAR(100) UNIQUE, -- 나이스페이 거래 ID
  pay_method VARCHAR(50), -- 결제 수단 (card, vbank, etc)
  card_name VARCHAR(100), -- 카드사명
  card_num VARCHAR(20), -- 카드번호 (일부)
  
  -- 결제 상태
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, failed, cancelled, refunded
  
  -- 빌링키 (정기결제용)
  billing_key VARCHAR(100),
  
  -- 결제 일시
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- 기타
  fail_code VARCHAR(50),
  fail_message TEXT,
  metadata JSONB, -- 추가 정보 저장
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_tid ON payments(tid);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- RLS (Row Level Security) 활성화
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 결제 정보만 조회 가능
CREATE POLICY payments_select_policy ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할은 모든 작업 가능
CREATE POLICY payments_service_policy ON payments
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE payments IS '결제 정보 테이블';
COMMENT ON COLUMN payments.order_id IS '주문 ID (고유)';
COMMENT ON COLUMN payments.tid IS '나이스페이 거래 ID';
COMMENT ON COLUMN payments.payment_type IS '결제 유형 (one_time_credit: 일회성 크레딧, subscription: 구독)';
COMMENT ON COLUMN payments.billing_key IS '정기결제용 빌링키';
COMMENT ON COLUMN payments.status IS '결제 상태 (pending: 대기, paid: 완료, failed: 실패, cancelled: 취소, refunded: 환불)';

