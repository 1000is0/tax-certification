# Make 시나리오 설정 가이드

## 개요
이 문서는 Make.com에서 세무사 자동화 프로그램의 웹훅을 사용하는 방법을 설명합니다.

## 웹훅 엔드포인트

### 기본 설정
- **URL**: `https://your-domain.com/api/webhook/decrypt-credentials`
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `X-API-Key: your_make_webhook_secret`

### 요청 데이터
```json
{
  "clientId": "1234567890",
  "userPassword": "user_password_here"
}
```

### 응답 데이터
```json
{
  "success": true,
  "message": "인증서 정보가 성공적으로 복호화되었습니다.",
  "data": {
    "credential": {
      "id": "uuid-here",
      "clientId": "1234567890",
      "certName": "우리회사 인증서",
      "certType": "business"
    },
    "decryptedData": {
      "certData": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
      "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
      "certPassword": "cert_password_here"
    }
  }
}
```

## Make 시나리오 예시

### 1. 에어테이블 → 홈택스 자동화

```
1. 트리거: Airtable - Watch Records
   - Base: 세무 데이터베이스
   - Table: 세무 신고 데이터
   - Event: Record created

2. 웹훅: HTTP - Make a Request
   - URL: https://your-domain.com/api/webhook/decrypt-credentials
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - X-API-Key: {{your_webhook_secret}}
   - Body:
     - clientId: {{1.client_id}} (에어테이블의 사업자등록번호 필드)
     - userPassword: {{1.user_password}} (에어테이블의 사용자 비밀번호 필드)

3. 데이터 처리: Tools - Set Variable
   - Variable: certData
   - Value: {{2.data.decryptedData.certData}}

4. 홈택스 API 호출: HTTP - Make a Request
   - URL: https://hometax.go.kr/api/endpoint
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - Authorization: Bearer {{certData}}
   - Body: 홈택스 API 요구사항에 따른 데이터

5. 결과 업데이트: Airtable - Update Record
   - Base: 세무 데이터베이스
   - Table: 세무 신고 데이터
   - Record ID: {{1.id}}
   - Fields:
     - status: completed
     - result_data: {{4.response}}
     - processed_at: {{now}}
```

### 2. 정기 보고서 자동화

```
1. 트리거: Schedule - Every Month
   - Day: 1
   - Time: 09:00

2. 데이터 조회: Airtable - List Records
   - Base: 세무 데이터베이스
   - Table: 월간 보고서 데이터
   - Filter: status = "pending"

3. 반복: Iterator - For Each
   - Array: {{2.records}}

4. 웹훅: HTTP - Make a Request
   - URL: https://your-domain.com/api/webhook/decrypt-credentials
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - X-API-Key: {{your_webhook_secret}}
   - Body:
     - clientId: {{3.client_id}}
     - userPassword: {{3.user_password}}

5. 홈택스 제출: HTTP - Make a Request
   - URL: https://hometax.go.kr/api/submit
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - Authorization: Bearer {{4.data.decryptedData.certData}}
   - Body: 월간 보고서 데이터

6. 결과 업데이트: Airtable - Update Record
   - Base: 세무 데이터베이스
   - Table: 월간 보고서 데이터
   - Record ID: {{3.id}}
   - Fields:
     - status: submitted
     - submission_id: {{5.response.id}}
     - submitted_at: {{now}}

7. 알림: Email - Send Email
   - To: {{3.email}}
   - Subject: 월간 보고서 제출 완료
   - Body: 제출 결과 및 상세 정보
```

### 3. 에러 처리 시나리오

```
1. 에러 발생 시: Error Handling
   - Error Type: HTTP Error
   - Error Code: 4xx, 5xx

2. 로그 기록: HTTP - Make a Request
   - URL: https://your-domain.com/api/webhook/log
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - X-API-Key: {{your_webhook_secret}}
   - Body:
     - webhookType: "make"
     - clientId: {{client_id}}
     - payload: {{original_request}}
     - responseStatus: {{error_code}}
     - errorMessage: {{error_message}}
     - processingTime: {{execution_time}}

3. 알림 발송: Slack - Post Message
   - Channel: #tax-automation-alerts
   - Message: 에러 발생 알림 및 상세 정보

4. 재시도 로직: Tools - Sleep
   - Duration: 300 (5분)

5. 재시도: HTTP - Make a Request
   - URL: {{original_url}}
   - Method: {{original_method}}
   - Headers: {{original_headers}}
   - Body: {{original_body}}
```

## 보안 고려사항

### 1. API 키 관리
- Make 시나리오에서 API 키는 환경변수로 관리
- 절대 하드코딩하지 않음
- 정기적인 키 로테이션

### 2. 데이터 전송
- 모든 통신은 HTTPS 사용
- 민감한 데이터는 암호화하여 전송
- 로그에 민감한 정보 기록 금지

### 3. 접근 제어
- IP 화이트리스트 설정 (선택사항)
- 요청 빈도 제한
- 비정상적인 접근 패턴 모니터링

## 테스트 방법

### 1. 웹훅 연결 테스트
```bash
curl -X POST https://your-domain.com/api/webhook/health \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_webhook_secret"
```

### 2. 인증서 복호화 테스트
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

### 3. Make 시나리오 테스트
- Make 대시보드에서 시나리오 실행
- 각 단계별 결과 확인
- 에러 발생 시 로그 확인

## 문제 해결

### 일반적인 오류

1. **401 Unauthorized**
   - API 키 확인
   - 헤더 형식 확인

2. **400 Bad Request**
   - 요청 데이터 형식 확인
   - 필수 필드 누락 확인

3. **404 Not Found**
   - 사업자등록번호 확인
   - 인증서 존재 여부 확인

4. **500 Internal Server Error**
   - 서버 로그 확인
   - 데이터베이스 연결 상태 확인

### 로그 확인
- 서버 로그: `logs/combined.log`
- 보안 로그: `logs/security.log`
- 감사 로그: `logs/audit.log`

## 모니터링

### 1. 성능 모니터링
- 응답 시간 측정
- 처리량 모니터링
- 에러율 추적

### 2. 보안 모니터링
- 비정상적인 접근 패턴 감지
- 실패한 인증 시도 추적
- 데이터 접근 로그 분석

### 3. 비즈니스 모니터링
- 처리된 요청 수
- 성공/실패 비율
- 사용자별 활동 통계

