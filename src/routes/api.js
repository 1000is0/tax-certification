const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const CredentialController = require('../controllers/CredentialController');
const CreditController = require('../controllers/CreditController');
const WebhookController = require('../controllers/WebhookController');
const { authenticateToken, requireAdmin, authenticateAPIKey, auditLog } = require('../middleware/auth');

const router = express.Router();

// 입력 검증 규칙
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password').isLength({ min: 8 }).withMessage('비밀번호는 최소 8자 이상이어야 합니다.'),
  body('name').trim().isLength({ min: 2 }).withMessage('이름은 최소 2자 이상이어야 합니다.'),
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

// 인증서 관련 라우트
router.post('/credentials', authenticateToken, credentialValidation, auditLog('create', 'credentials'), CredentialController.createCredential);
router.get('/credentials', authenticateToken, CredentialController.getUserCredentials);
router.get('/credentials/:id', authenticateToken, CredentialController.getCredential);
router.put('/credentials/:id', authenticateToken, updateCredentialValidation, auditLog('update', 'credentials'), CredentialController.updateCredential);
router.delete('/credentials/:id', authenticateToken, auditLog('delete', 'credentials'), CredentialController.deleteCredential);
router.post('/credentials/:id/deactivate', authenticateToken, auditLog('update', 'credentials'), CredentialController.deactivateCredential);
router.post('/credentials/test-connection', authenticateToken, clientIdValidation, CredentialController.testConnection);

// 크레딧 관련 라우트
router.get('/credits', authenticateToken, CreditController.getBalance);
router.get('/credits/history', authenticateToken, CreditController.getHistory);
router.get('/credits/plans', CreditController.getPlans);
router.get('/credits/subscription', authenticateToken, CreditController.getMySubscription);

// 관리자용 라우트
router.get('/admin/credentials', authenticateToken, requireAdmin, CredentialController.getAllCredentials);
router.get('/admin/credentials/stats', authenticateToken, requireAdmin, CredentialController.getCredentialStats);
router.post('/admin/credits/grant', authenticateToken, requireAdmin, CreditController.adminGrant);

// Make 웹훅용 라우트 (API 키 인증)
router.post('/webhook/decrypt-credentials', authenticateAPIKey, clientIdValidation, WebhookController.decryptCredentials);
router.post('/webhook/log', authenticateAPIKey, WebhookController.logWebhookCall);
router.get('/webhook/health', authenticateAPIKey, WebhookController.healthCheck);
router.post('/webhook/test', authenticateAPIKey, WebhookController.testScenario);

// 헬스 체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;
