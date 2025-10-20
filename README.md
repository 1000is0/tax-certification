# 세무사 자동화 프로그램

## 프로젝트 개요
홈택스 API를 활용한 세무사 자동화 프로그램으로, Make와 에어테이블을 연동하여 세무 업무를 자동화합니다.

## 주요 기능
- 🔐 보안 인증서 관리 (암호화 저장)
- 🏢 홈택스 API 연동
- 📊 에어테이블 데이터 연동
- 🤖 Make 자동화 워크플로우
- 👤 사용자 인증 및 권한 관리
- 📝 감사 로그 및 모니터링

## 기술 스택
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Frontend**: React + Material-UI
- **Authentication**: JWT
- **Encryption**: AES-256-GCM
- **Automation**: Make + Airtable

## 보안 특징
- 민감한 정보는 AES-256-GCM으로 암호화 저장
- 사용자별 개별 암호화 키 사용
- 모든 API 통신은 TLS 1.3으로 암호화
- 감사 로그 및 접근 제어
- Rate Limiting 및 CSRF 보호

## 프로젝트 구조
```
tax-certification/
├── src/                    # 백엔드 소스코드
│   ├── server.js          # 서버 진입점
│   ├── config/            # 설정 파일
│   ├── controllers/       # API 컨트롤러
│   ├── middleware/        # 미들웨어
│   ├── models/           # 데이터베이스 모델
│   ├── routes/           # API 라우트
│   ├── services/         # 비즈니스 로직
│   └── utils/            # 유틸리티 함수
├── frontend/              # 프론트엔드 소스코드
│   ├── src/
│   ├── public/
│   └── package.json
├── database/              # 데이터베이스 스키마
├── docs/                  # 문서
└── tests/                 # 테스트 코드
```

## 설치 및 실행

### 1. 의존성 설치
```bash
npm run install:all
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 필요한 값들을 설정
```

### 3. 데이터베이스 설정
```bash
# PostgreSQL 데이터베이스 생성 및 스키마 적용
npm run db:setup
```

### 4. 개발 서버 실행
```bash
# 백엔드 개발 서버
npm run dev

# 프론트엔드 개발 서버 (별도 터미널)
cd frontend && npm run dev
```

## 환경 변수
```env
# 서버 설정
PORT=3000
NODE_ENV=development

# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 암호화
ENCRYPTION_KEY=your_encryption_key

# 에어테이블
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_base_id

# Make
MAKE_WEBHOOK_SECRET=your_webhook_secret
```

## API 문서
- 인증: `/api/auth/*`
- 인증서 관리: `/api/credentials/*`
- Make 웹훅: `/api/webhook/*`
- 관리자: `/api/admin/*`

## 보안 가이드라인
1. 민감한 정보는 절대 평문으로 저장하지 않음
2. 모든 API는 인증 토큰 필요
3. 암호화 키는 환경변수로 관리
4. 정기적인 보안 업데이트 및 키 로테이션
5. 접근 로그 모니터링

## 라이선스
MIT License
