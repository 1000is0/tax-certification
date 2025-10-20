-- 세무사 자동화 프로그램 데이터베이스 스키마
-- PostgreSQL 13+ 호환

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
    encrypted_cert_key TEXT NOT NULL, -- AES 암호화된 인증서 키
    encrypted_password TEXT NOT NULL, -- AES 암호화된 비밀번호
    encrypted_additional_data JSONB, -- 기타 민감 정보 (암호화)
    encryption_iv VARCHAR(32) NOT NULL, -- 초기화 벡터 (Base64)
    cert_name VARCHAR(100), -- 인증서 이름 (평문)
    cert_type VARCHAR(50), -- 인증서 타입
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
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_status INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 홈택스 연동 로그 테이블
CREATE TABLE hometax_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id UUID NOT NULL REFERENCES tax_credentials(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL, -- 'login', 'data_fetch', 'data_submit'
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'pending'
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    execution_time INTEGER, -- 밀리초
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Make 웹훅 로그 테이블
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_type VARCHAR(50) NOT NULL, -- 'make', 'airtable'
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
CREATE INDEX idx_tax_credentials_active ON tax_credentials(is_active);
CREATE INDEX idx_tax_credentials_expires ON tax_credentials(expires_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_hometax_logs_user_id ON hometax_logs(user_id);
CREATE INDEX idx_hometax_logs_credential_id ON hometax_logs(credential_id);
CREATE INDEX idx_hometax_logs_status ON hometax_logs(status);
CREATE INDEX idx_hometax_logs_created_at ON hometax_logs(created_at);

CREATE INDEX idx_webhook_logs_type ON webhook_logs(webhook_type);
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
('audit_log_retention_days', '365', '감사 로그 보관 기간 (일)');

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

-- 뷰 생성: 홈택스 연동 통계
CREATE VIEW hometax_stats AS
SELECT 
    DATE(created_at) as date,
    operation,
    status,
    COUNT(*) as count,
    AVG(execution_time) as avg_execution_time,
    MAX(execution_time) as max_execution_time
FROM hometax_logs
GROUP BY DATE(created_at), operation, status
ORDER BY date DESC;

-- 권한 설정 (실제 운영 시에는 적절한 사용자 권한으로 변경)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tax_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tax_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO tax_app_user;

