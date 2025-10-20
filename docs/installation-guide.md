# 설치 및 실행 가이드

## 1. 프로젝트 설정

### 1.1 저장소 클론
```bash
git clone <repository-url>
cd tax-certification
```

### 1.2 의존성 설치
```bash
# 백엔드 의존성 설치
npm install

# 프론트엔드 의존성 설치
cd frontend
npm install
cd ..
```

## 2. 환경 설정

### 2.1 환경 변수 파일 생성
```bash
cp env.example .env
```

### 2.2 환경 변수 설정
`.env` 파일을 편집하여 다음 값들을 설정하세요:

```env
# 서버 설정
PORT=3000
NODE_ENV=development

# Supabase 설정 (Supabase 프로젝트에서 가져오기)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT 설정 (랜덤한 긴 문자열 생성)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# 암호화 설정 (32자리 문자열 생성)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# 에어테이블 설정
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here

# Make 웹훅 설정 (랜덤한 문자열 생성)
MAKE_WEBHOOK_SECRET=your_make_webhook_secret_here
```

## 3. Supabase 설정

### 3.1 Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 URL과 API 키 복사
3. `.env` 파일에 설정

### 3.2 데이터베이스 스키마 적용
1. Supabase 대시보드 → SQL Editor
2. `database/supabase-schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기 후 실행

### 3.3 RLS 정책 확인
- Row Level Security가 활성화되어 있는지 확인
- 사용자별 데이터 접근 권한이 올바르게 설정되었는지 확인

## 4. 개발 서버 실행

### 4.1 백엔드 서버 실행
```bash
npm run dev
```

### 4.2 프론트엔드 서버 실행 (별도 터미널)
```bash
cd frontend
npm run dev
```

### 4.3 접속 확인
- 백엔드: http://localhost:3000
- 프론트엔드: http://localhost:5173

## 5. 초기 설정

### 5.1 관리자 계정 생성
기본 관리자 계정이 자동으로 생성됩니다:
- 이메일: `admin@taxautomation.com`
- 비밀번호: `admin123`

### 5.2 첫 번째 사용자 등록
1. 프론트엔드에서 회원가입
2. 로그인 후 인증서 정보 등록

## 6. Make.com 연동 설정

### 6.1 웹훅 엔드포인트 설정
- URL: `https://your-domain.com/api/webhook/decrypt-credentials`
- Method: `POST`
- Headers: `X-API-Key: your_make_webhook_secret`

### 6.2 테스트 요청
```bash
curl -X POST https://your-domain.com/api/webhook/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_webhook_secret" \
  -d '{
    "clientId": "1234567890",
    "userPassword": "test_password",
    "testType": "basic"
  }'
```

## 7. 프로덕션 배포

### 7.1 환경 변수 설정
- `NODE_ENV=production`
- 프로덕션용 Supabase 프로젝트 사용
- 강력한 JWT_SECRET 및 ENCRYPTION_KEY 설정

### 7.2 빌드
```bash
# 프론트엔드 빌드
cd frontend
npm run build
cd ..

# 프로덕션 서버 실행
npm start
```

### 7.3 보안 설정
- HTTPS 사용 필수
- 방화벽 설정
- 정기적인 보안 업데이트

## 8. 문제 해결

### 8.1 일반적인 문제

**Supabase 연결 실패**
- URL과 API 키 확인
- 네트워크 연결 상태 확인
- Supabase 프로젝트 상태 확인

**인증서 복호화 실패**
- 사용자 비밀번호 확인
- 암호화 키 설정 확인
- 데이터베이스 스키마 확인

**Make 웹훅 오류**
- API 키 확인
- 요청 데이터 형식 확인
- 서버 로그 확인

### 8.2 로그 확인
```bash
# 실시간 로그 확인
tail -f logs/combined.log

# 에러 로그 확인
tail -f logs/error.log

# 보안 로그 확인
tail -f logs/security.log
```

### 8.3 디버깅
```bash
# 개발 모드에서 상세 로그 확인
NODE_ENV=development npm run dev

# 특정 로그 레벨 설정
LOG_LEVEL=debug npm run dev
```

## 9. 백업 및 복구

### 9.1 데이터베이스 백업
- Supabase 대시보드에서 자동 백업 설정
- 정기적인 수동 백업 수행

### 9.2 설정 파일 백업
- `.env` 파일 백업
- 중요한 설정 정보 별도 저장

## 10. 업데이트

### 10.1 코드 업데이트
```bash
git pull origin main
npm install
cd frontend && npm install && cd ..
```

### 10.2 데이터베이스 마이그레이션
- 새로운 스키마 변경사항 확인
- Supabase SQL Editor에서 마이그레이션 실행

### 10.3 서비스 재시작
```bash
# 개발 환경
npm run dev

# 프로덕션 환경
pm2 restart tax-certification
```
