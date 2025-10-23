const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const CredentialController = require('../controllers/CredentialController');
const CreditController = require('../controllers/CreditController');
const UserController = require('../controllers/UserController');
const PaymentController = require('../controllers/PaymentController');
const SubscriptionController = require('../controllers/SubscriptionController');
const WebhookController = require('../controllers/WebhookController');
const MakeController = require('../controllers/MakeController');
const { authenticateToken, requireAdmin, authenticateAPIKey, auditLog } = require('../middleware/auth');
const { requireCredit } = require('../middleware/creditCheck');

const router = express.Router();

// 입력 검증 규칙
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password').isLength({ min: 8 }).withMessage('비밀번호는 최소 8자 이상이어야 합니다.'),
  body('name').trim().isLength({ min: 2 }).withMessage('이름은 최소 2자 이상이어야 합니다.'),
  body('phone').notEmpty().withMessage('휴대폰 번호를 입력해주세요.'),
  body('role').optional().isIn(['user', 'admin']).withMessage('유효하지 않은 역할입니다.')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요.')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력해주세요.'),
  body('newPassword').isLength({ min: 8 }).withMessage('새 비밀번호는 최소 8자 이상이어야 합니다.')
];

const credentialValidation = [
  body('clientId').matches(/^[0-9]{10}$/).withMessage('사업자등록번호는 10자리 숫자여야 합니다.'),
  body('certData').notEmpty().withMessage('인증서 데이터를 입력해주세요.'),
  body('privateKey').notEmpty().withMessage('개인키를 입력해주세요.'),
  body('certPassword').notEmpty().withMessage('인증서 비밀번호를 입력해주세요.'),
  body('certName').optional().trim().isLength({ min: 2 }).withMessage('인증서 이름은 최소 2자 이상이어야 합니다.'),
  body('certType').optional().isIn(['personal', 'business']).withMessage('유효하지 않은 인증서 타입입니다.')
];

const updateCredentialValidation = [
  body('certName').optional().trim().isLength({ min: 2 }).withMessage('인증서 이름은 최소 2자 이상이어야 합니다.'),
  body('certType').optional().isIn(['personal', 'business']).withMessage('유효하지 않은 인증서 타입입니다.')
];

const clientIdValidation = [
  body('clientId').matches(/^[0-9]{10}$/).withMessage('사업자등록번호는 10자리 숫자여야 합니다.')
];

// 인증 관련 라우트
router.post('/auth/register', registerValidation, AuthController.register);
router.post('/auth/login', loginValidation, AuthController.login);
router.post('/auth/refresh', AuthController.refreshToken);
router.post('/auth/logout', authenticateToken, AuthController.logout);
router.post('/auth/verify-password', authenticateToken, AuthController.verifyPassword);
router.get('/auth/me', authenticateToken, AuthController.getCurrentUser);
router.put('/auth/change-password', authenticateToken, changePasswordValidation, AuthController.changePassword);
router.delete('/auth/account', authenticateToken, AuthController.deleteAccount);

// 사용자 프로필 관련 라우트
router.get('/users/profile', authenticateToken, UserController.getMyProfile);
router.put('/users/profile', authenticateToken, UserController.updateMyProfile);
router.put('/users/password', authenticateToken, UserController.changePassword);

// 인증서 관련 라우트
router.post('/credentials', authenticateToken, credentialValidation, auditLog('create', 'credentials'), CredentialController.createCredential);
router.get('/credentials', authenticateToken, CredentialController.getUserCredentials);
router.get('/credentials/:id', authenticateToken, CredentialController.getCredential);
router.put('/credentials/:id', authenticateToken, updateCredentialValidation, auditLog('update', 'credentials'), CredentialController.updateCredential);
router.delete('/credentials/:id', authenticateToken, auditLog('delete', 'credentials'), CredentialController.deleteCredential);
router.post('/credentials/:id/deactivate', authenticateToken, auditLog('update', 'credentials'), CredentialController.deactivateCredential);
router.post('/credentials/test-connection', authenticateToken, clientIdValidation, requireCredit(5, '인증서 연결 테스트'), CredentialController.testConnection);

// 크레딧 관련 라우트
router.get('/credits', authenticateToken, CreditController.getBalance);
router.get('/credits/history', authenticateToken, CreditController.getHistory);
router.get('/credits/plans', CreditController.getPlans);
router.get('/credits/subscription', authenticateToken, CreditController.getMySubscription);

// 구독 관련 라우트
router.get('/subscriptions/my', authenticateToken, SubscriptionController.getMySubscription);
router.post('/subscriptions/cancel', authenticateToken, SubscriptionController.cancelSubscription);
router.post('/subscriptions/reactivate', authenticateToken, SubscriptionController.reactivateSubscription);
router.get('/subscriptions/change-tier-quote', authenticateToken, SubscriptionController.getChangeTierQuote);
router.post('/subscriptions/change-tier', authenticateToken, SubscriptionController.changeTier);

// 구독 관리 API (내부/크론잡용)
router.post('/subscriptions/renew', SubscriptionController.renewSubscriptions);
router.post('/subscriptions/expire', SubscriptionController.expireSubscriptions);

// 결제 관련 라우트
router.post('/payments/prepare/credit', authenticateToken, PaymentController.prepareCreditPayment);
router.post('/payments/prepare/subscription', authenticateToken, PaymentController.prepareSubscriptionPayment);
router.post('/payments/prepare/tier-upgrade', authenticateToken, PaymentController.prepareTierUpgradePayment);
router.all('/payments/callback', PaymentController.paymentCallback); // 나이스페이 결제 완료 콜백 (GET/POST 모두 허용, 인증 불필요)
router.post('/payments/approve', authenticateToken, PaymentController.approvePayment);
router.post('/payments/cancel', authenticateToken, PaymentController.cancelPayment);
router.get('/payments/history', authenticateToken, PaymentController.getPaymentHistory);

// 관리자용 라우트
router.get('/admin/credentials', authenticateToken, requireAdmin, CredentialController.getAllCredentials);
router.get('/admin/credentials/stats', authenticateToken, requireAdmin, CredentialController.getCredentialStats);
router.get('/admin/users', authenticateToken, requireAdmin, UserController.getAllUsers);
router.post('/admin/credits/grant', authenticateToken, requireAdmin, CreditController.adminGrant);

// Make 웹훅용 라우트 (API 키 인증)
router.post('/webhook/decrypt-credentials', authenticateAPIKey, clientIdValidation, WebhookController.decryptCredentials);
router.post('/webhook/log', authenticateAPIKey, WebhookController.logWebhookCall);
router.get('/webhook/health', authenticateAPIKey, WebhookController.healthCheck);
router.post('/webhook/test', authenticateAPIKey, WebhookController.testScenario);

// 나이스페이 웹훅 (인증 불필요 - 나이스페이 서버에서 직접 호출)
// 웹훅은 카드결제만 사용하므로 불필요

// Make 연동 API
router.post('/make/execute', MakeController.executeWorkflow);
router.post('/make/validate', MakeController.validateCredits);
router.post('/make/complete', MakeController.completeTask);

// 헬스 체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;
