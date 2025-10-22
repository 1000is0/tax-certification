-- users 테이블에 name, phone 컬럼 추가

-- name 컬럼 추가 (필수)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- phone 컬럼 추가 (필수)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 기존 사용자들을 위한 기본값 설정 (임시)
UPDATE users
SET name = COALESCE(name, '미입력'),
    phone = COALESCE(phone, '000-0000-0000')
WHERE name IS NULL OR phone IS NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE users
ALTER COLUMN name SET NOT NULL;

ALTER TABLE users
ALTER COLUMN phone SET NOT NULL;

COMMENT ON COLUMN users.name IS '사용자 이름';
COMMENT ON COLUMN users.phone IS '휴대폰 번호';

