-- Supabase 데이터베이스 스키마
-- 세무사 자동화 프로그램용 테이블 생성

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 세무사 인증서 정보 테이블 (암호화 저장)
CREATE TABLE tax_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(10) NOT NULL, -- 사업자등록번호 (10자리 숫자)
    encrypted_cert_data TEXT NOT NULL, -- 암호화된 인증서 PEM 문자열
    encrypted_private_key TEXT NOT NULL, -- 암호화된 개인키 PEM 문자열
    encrypted_cert_password TEXT NOT NULL, -- 암호화된 인증서 비밀번호
    encryption_iv VARCHAR(32) NOT NULL, -- 초기화 벡터 (Base64)
    encryption_tag VARCHAR(32) NOT NULL, -- 인증 태그 (Base64)
    encryption_salt VARCHAR(64) NOT NULL, -- 솔트 (Base64)
    cert_name VARCHAR(100), -- 인증서 이름 (평문)
    cert_type VARCHAR(50) DEFAULT 'business', -- 인증서 타입
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 감사 로그 테이블
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', 'login', 'logout'
    resource_type VARCHAR(50) NOT NULL, -- 'user', 'credentials', 'hometax'
    resource_id UUID,
    client_id VARCHAR(10), -- 사업자등록번호
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_status INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Make 웹훅 로그 테이블
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_type VARCHAR(50) NOT NULL, -- 'make', 'airtable'
    client_id VARCHAR(10), -- 사업자등록번호
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_data JSONB,
    processing_time INTEGER, -- 밀리초
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 설정 테이블
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_tax_credentials_user_id ON tax_credentials(user_id);
CREATE INDEX idx_tax_credentials_client_id ON tax_credentials(client_id);
CREATE INDEX idx_tax_credentials_active ON tax_credentials(is_active);
CREATE INDEX idx_tax_credentials_expires ON tax_credentials(expires_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_client_id ON audit_logs(client_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_webhook_logs_type ON webhook_logs(webhook_type);
CREATE INDEX idx_webhook_logs_client_id ON webhook_logs(client_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);

CREATE INDEX idx_system_settings_key ON system_settings(key);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_credentials_updated_at BEFORE UPDATE ON tax_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 관리자 사용자 생성 (비밀번호: admin123)
INSERT INTO users (email, password_hash, name, role) VALUES 
('admin@taxautomation.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4/LewdBPj4', 'System Administrator', 'admin');

-- 기본 시스템 설정
INSERT INTO system_settings (key, value, description) VALUES 
('encryption_algorithm', 'aes-256-gcm', '암호화 알고리즘'),
('session_timeout', '86400', '세션 타임아웃 (초)'),
('max_login_attempts', '5', '최대 로그인 시도 횟수'),
('password_min_length', '8', '비밀번호 최소 길이'),
('audit_log_retention_days', '365', '감사 로그 보관 기간 (일)'),
('client_id_format', '^[0-9]{10}$', '사업자등록번호 형식 정규식');

-- 뷰 생성: 사용자별 인증서 요약
CREATE VIEW user_credentials_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    COUNT(tc.id) as total_credentials,
    COUNT(CASE WHEN tc.is_active = true THEN 1 END) as active_credentials,
    COUNT(CASE WHEN tc.expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_credentials,
    MAX(tc.created_at) as last_credential_created
FROM users u
LEFT JOIN tax_credentials tc ON u.id = tc.user_id
GROUP BY u.id, u.email, u.name;

-- 뷰 생성: 클라이언트별 인증서 통계
CREATE VIEW client_credentials_stats AS
SELECT 
    client_id,
    COUNT(*) as total_credentials,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_credentials,
    COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_credentials,
    MAX(created_at) as last_created,
    MIN(created_at) as first_created
FROM tax_credentials
GROUP BY client_id;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 인증서는 소유자만 접근 가능
CREATE POLICY "Users can view own credentials" ON tax_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" ON tax_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON tax_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" ON tax_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- 관리자는 모든 데이터 접근 가능
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all credentials" ON tax_credentials
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 감사 로그는 관리자만 접근 가능
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 웹훅 로그는 관리자만 접근 가능
CREATE POLICY "Admins can view webhook logs" ON webhook_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 함수: 클라이언트 ID로 인증서 조회 (Make 웹훅용)
CREATE OR REPLACE FUNCTION get_credentials_by_client_id(client_id_param VARCHAR(10))
RETURNS TABLE (
    id UUID,
    user_id UUID,
    client_id VARCHAR(10),
    encrypted_cert_data TEXT,
    encrypted_private_key TEXT,
    encrypted_cert_password TEXT,
    encryption_iv VARCHAR(32),
    encryption_tag VARCHAR(32),
    encryption_salt VARCHAR(64),
    cert_name VARCHAR(100),
    cert_type VARCHAR(50),
    is_active BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.id,
        tc.user_id,
        tc.client_id,
        tc.encrypted_cert_data,
        tc.encrypted_private_key,
        tc.encrypted_cert_password,
        tc.encryption_iv,
        tc.encryption_tag,
        tc.encryption_salt,
        tc.cert_name,
        tc.cert_type,
        tc.is_active,
        tc.expires_at,
        tc.created_at,
        tc.updated_at
    FROM tax_credentials tc
    WHERE tc.client_id = client_id_param 
    AND tc.is_active = true
    ORDER BY tc.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수: 사업자등록번호 유효성 검사
CREATE OR REPLACE FUNCTION validate_client_id(client_id_param VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    -- 10자리 숫자인지 확인
    IF client_id_param ~ '^[0-9]{10}$' THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 함수: 암호화된 데이터 업데이트
CREATE OR REPLACE FUNCTION update_encrypted_credentials(
    credential_id UUID,
    new_encrypted_cert_data TEXT,
    new_encrypted_private_key TEXT,
    new_encrypted_cert_password TEXT,
    new_encryption_iv VARCHAR(32),
    new_encryption_tag VARCHAR(32),
    new_encryption_salt VARCHAR(64)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tax_credentials 
    SET 
        encrypted_cert_data = new_encrypted_cert_data,
        encrypted_private_key = new_encrypted_private_key,
        encrypted_cert_password = new_encrypted_cert_password,
        encryption_iv = new_encryption_iv,
        encryption_tag = new_encryption_tag,
        encryption_salt = new_encryption_salt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = credential_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

