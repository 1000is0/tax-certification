const crypto = require('crypto');
const { logError } = require('./logger');

class EncryptionService {
  constructor() {
    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 12; // GCM 권장 IV 96-bit
    this.tagLength = 16; // 128 bits
    this.masterKey = this.getMasterKey();
  }

  // 마스터 키 가져오기
  getMasterKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
    }
    
    // 키가 32바이트가 되도록 해시 처리
    return crypto.createHash('sha256').update(key).digest();
  }

  // 사용자별 암호화 키 생성
  generateUserKey(userPassword, salt) {
    return crypto.pbkdf2Sync(userPassword, salt, 100000, this.keyLength, 'sha256');
  }

  // 랜덤 솔트 생성
  generateSalt() {
    return crypto.randomBytes(32);
  }

  // 랜덤 IV 생성
  generateIV() {
    return crypto.randomBytes(this.ivLength);
  }

  // 데이터 암호화
  encrypt(text, userPassword = null) {
    try {
      let key;
      let salt;

      if (userPassword) {
        // 사용자별 키 사용
        salt = this.generateSalt();
        key = this.generateUserKey(userPassword, salt);
      } else {
        // 마스터 키 사용
        key = this.masterKey;
        salt = null;
      }

      const iv = this.generateIV();
      const cipher = crypto.createCipheriv(this.algorithm, key, iv, { authTagLength: this.tagLength });
      cipher.setAAD(Buffer.from('tax-automation', 'utf8'));
      const encryptedBuffer = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      const result = {
        encrypted: encryptedBuffer.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt ? salt.toString('hex') : null
      };

      return result;
    } catch (error) {
      logError(error, { operation: 'encrypt' });
      throw new Error('암호화 중 오류가 발생했습니다.');
    }
  }

  // 데이터 복호화
  decrypt(encryptedData, userPassword = null) {
    try {
      let key;

      if (userPassword && encryptedData.salt) {
        // 사용자별 키 사용
        const salt = Buffer.from(encryptedData.salt, 'hex');
        key = this.generateUserKey(userPassword, salt);
      } else {
        // 마스터 키 사용
        key = this.masterKey;
      }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv, { authTagLength: this.tagLength });
      decipher.setAAD(Buffer.from('tax-automation', 'utf8'));
      decipher.setAuthTag(tag);
      const decryptedBuffer = Buffer.concat([
        decipher.update(Buffer.from(encryptedData.encrypted, 'hex')),
        decipher.final()
      ]);
      const decrypted = decryptedBuffer.toString('utf8');

      return decrypted;
    } catch (error) {
      logError(error, { operation: 'decrypt' });
      throw new Error('복호화 중 오류가 발생했습니다.');
    }
  }

  // 인증서 정보 암호화 (마스터 키 사용)
  encryptCredentials(credentials) {
    try {
      const credentialsString = JSON.stringify(credentials);
      const encrypted = this.encrypt(credentialsString); // userPassword 제거 - 마스터 키 사용
      
      return {
        encrypted_cert_data: encrypted.encrypted,
        encrypted_private_key: encrypted.encrypted,
        encrypted_cert_password: encrypted.encrypted,
        encryption_iv: encrypted.iv,
        encryption_tag: encrypted.tag,
        encryption_salt: null // 마스터 키 사용하므로 salt 불필요
      };
    } catch (error) {
      logError(error, { operation: 'encryptCredentials' });
      throw new Error('인증서 정보 암호화 중 오류가 발생했습니다.');
    }
  }

  // 인증서 정보 복호화 (마스터 키 사용)
  decryptCredentials(encryptedCredentials) {
    try {
      const encryptedData = {
        encrypted: encryptedCredentials.encrypted_cert_data,
        iv: encryptedCredentials.encryption_iv,
        tag: encryptedCredentials.encryption_tag,
        salt: null // 마스터 키 사용하므로 salt 불필요
      };

      const decryptedString = this.decrypt(encryptedData); // userPassword 제거 - 마스터 키 사용
      return JSON.parse(decryptedString);
    } catch (error) {
      logError(error, { operation: 'decryptCredentials' });
      throw new Error('인증서 정보 복호화 중 오류가 발생했습니다.');
    }
  }

  // 해시 생성 (비밀번호용)
  hashPassword(password) {
    const salt = crypto.randomBytes(32);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  // 비밀번호 검증
  verifyPassword(password, hash, salt) {
    const hashBuffer = Buffer.from(hash, 'hex');
    const saltBuffer = Buffer.from(salt, 'hex');
    const derivedHash = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha256');
    return crypto.timingSafeEqual(hashBuffer, derivedHash);
  }

  // 랜덤 토큰 생성
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // HMAC 서명 생성
  createHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // HMAC 서명 검증
  verifyHMAC(data, signature, secret) {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

// 싱글톤 인스턴스 생성
const encryptionService = new EncryptionService();

module.exports = encryptionService;
