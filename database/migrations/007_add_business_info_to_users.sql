-- users 테이블에 사업자 정보 컬럼 추가

ALTER TABLE users ADD COLUMN IF NOT EXISTS business_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_business_number ON users(business_number);
CREATE INDEX IF NOT EXISTS idx_users_company_name ON users(company_name);

-- 복합 인덱스 추가 (사업자번호 + 상호 조회용)
CREATE INDEX IF NOT EXISTS idx_users_business_lookup ON users(business_number, company_name);

COMMENT ON COLUMN users.business_number IS '사업자등록번호';
COMMENT ON COLUMN users.company_name IS '상호명';
