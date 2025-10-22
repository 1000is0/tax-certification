-- subscriptions 테이블에 pending_tier 컬럼 추가
-- 다운그레이드 시 "다음 결제일부터 적용될 티어"를 저장

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS pending_tier VARCHAR(50);

COMMENT ON COLUMN subscriptions.pending_tier IS '다음 결제일부터 적용될 티어 (다운그레이드 시)';

