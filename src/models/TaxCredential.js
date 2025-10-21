const { query, rpc, supabase } = require('../config/supabase');
const encryptionService = require('../utils/encryption');
const { logError, logAudit } = require('../utils/logger');

class TaxCredential {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.clientId = data.client_id; // 사업자등록번호
    this.encryptedCertData = data.encrypted_cert_data; // 인증서 PEM 문자열
    this.encryptedPrivateKey = data.encrypted_private_key; // 개인키 PEM 문자열
    this.encryptedCertPassword = data.encrypted_cert_password; // 인증서 비밀번호
    this.encryptionIv = data.encryption_iv;
    this.encryptionTag = data.encryption_tag;
    this.encryptionSalt = data.encryption_salt;
    this.certName = data.cert_name;
    this.certType = data.cert_type;
    this.isActive = data.is_active;
    this.expiresAt = data.expires_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // 인증서 정보 생성
  static async create(credentialData) {
    try {
      const { 
        userId, 
        clientId, 
        certData, 
        privateKey, 
        certPassword, 
        certName, 
        certType = 'business', 
        expiresAt 
      } = credentialData;
      
      // 사업자등록번호 유효성 검사
      if (!clientId || !/^[0-9]{10}$/.test(clientId)) {
        throw new Error('사업자등록번호는 10자리 숫자여야 합니다.');
      }

      // 인증서 정보 암호화 (마스터 키 사용)
      const credentials = {
        certData,
        privateKey,
        certPassword
      };

      const encrypted = encryptionService.encryptCredentials(credentials); // userPassword 제거
      
      const result = await query('tax_credentials', 'insert', {
        data: {
          user_id: userId,
          client_id: clientId,
          encrypted_cert_data: encrypted.encrypted_cert_data,
          encrypted_private_key: encrypted.encrypted_private_key,
          encrypted_cert_password: encrypted.encrypted_cert_password,
          encryption_iv: encrypted.encryption_iv,
          encryption_tag: encrypted.encryption_tag,
          encryption_salt: null, // 마스터 키 사용하므로 NULL
          cert_name: certName,
          cert_type: certType,
          expires_at: expiresAt
        }
      });

      if (result.error) {
        throw result.error;
      }

      const credential = new TaxCredential(result.data[0]);
      
      logAudit('create', 'credentials', credential.id, userId, {
        clientId: credential.clientId,
        certName: credential.certName,
        certType: credential.certType
      });

      return credential;
    } catch (error) {
      logError(error, { operation: 'TaxCredential.create' });
      throw error;
    }
  }

  // 사용자별 인증서 조회
  static async findByUserId(userId) {
    try {
      const result = await query('tax_credentials', 'select', {
        where: { user_id: userId, is_active: true },
        orderBy: 'created_at'
      });

      if (result.error) {
        throw result.error;
      }

      return result.data.map(row => new TaxCredential(row));
    } catch (error) {
      logError(error, { operation: 'TaxCredential.findByUserId' });
      throw error;
    }
  }

  // 클라이언트 ID로 인증서 조회 (Make 웹훅용)
  static async findByClientId(clientId) {
    try {
      console.log('Finding credential by clientId:', clientId);
      
      // 직접 Supabase 클라이언트 사용
      const result = await supabase
        .from('tax_credentials')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .single();

      console.log('Query result:', result);

      // PGRST116 에러는 "데이터 없음"을 의미하므로 null 반환
      if (result.error) {
        if (result.error.code === 'PGRST116') {
          console.log('No credentials found for clientId:', clientId);
          return null;
        }
        console.error('Query error:', result.error);
        logError(result.error, { operation: 'TaxCredential.findByClientId' });
        throw result.error;
      }

      if (!result.data) {
        console.log('No credentials found for clientId:', clientId);
        return null;
      }

      console.log('Found credential:', result.data);
      return new TaxCredential(result.data);
    } catch (error) {
      console.error('Error in findByClientId:', error);
      logError(error, { operation: 'TaxCredential.findByClientId' });
      throw error;
    }
  }

  // ID로 인증서 조회
  static async findById(id) {
    try {
      const result = await query('tax_credentials', 'select', {
        where: { id },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new TaxCredential(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'TaxCredential.findById' });
      throw error;
    }
  }

  // 활성 인증서 조회
  static async findActiveById(id) {
    try {
      const result = await query('tax_credentials', 'select', {
        where: { id, is_active: true },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        return null;
      }

      return new TaxCredential(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'TaxCredential.findActiveById' });
      throw error;
    }
  }

  // 모든 인증서 조회 (관리자용)
  static async findAll(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = {};

      if (filters.userId) {
        whereClause.user_id = filters.userId;
      }

      if (filters.clientId) {
        whereClause.client_id = filters.clientId;
      }

      if (filters.certType) {
        whereClause.cert_type = filters.certType;
      }

      if (filters.isActive !== undefined) {
        whereClause.is_active = filters.isActive;
      }

      // 인증서 목록 조회
      const credentialsResult = await query('tax_credentials', 'select', {
        where: whereClause,
        offset,
        limit,
        orderBy: 'created_at'
      });

      if (credentialsResult.error) {
        throw credentialsResult.error;
      }

      // 전체 개수 조회
      const countResult = await rpc('get_credentials_count', { filters: whereClause });
      const total = countResult || credentialsResult.data.length;

      const credentials = credentialsResult.data.map(row => ({
        ...new TaxCredential(row).toJSON()
      }));

      return {
        credentials,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logError(error, { operation: 'TaxCredential.findAll' });
      throw error;
    }
  }

  // 인증서 정보 복호화
  async decryptCredentials() {
    try {
      const encryptedData = {
        encrypted_cert_data: this.encryptedCertData,
        encrypted_private_key: this.encryptedPrivateKey,
        encrypted_cert_password: this.encryptedCertPassword,
        encryption_iv: this.encryptionIv,
        encryption_tag: this.encryptionTag,
        encryption_salt: this.encryptionSalt // DB 값 사용 (null이면 마스터 키, 있으면 기존 방식)
      };

      const decrypted = encryptionService.decryptCredentials(encryptedData); // userPassword 제거
      
      logAudit('read', 'credentials', this.id, this.userId, {
        action: 'decrypt',
        clientId: this.clientId
      });

      return decrypted;
    } catch (error) {
      logError(error, { operation: 'TaxCredential.decryptCredentials' });
      throw new Error('인증서 정보 복호화에 실패했습니다.');
    }
  }

  // 클라이언트 ID로 인증서 복호화 (Make 웹훅용)
  static async decryptByClientId(clientId) {
    try {
      console.log('Starting decryptByClientId for clientId:', clientId);
      
      const credential = await this.findByClientId(clientId);
      if (!credential) {
        console.log('Credential not found for clientId:', clientId);
        throw new Error('해당 사업자등록번호의 인증서를 찾을 수 없습니다.');
      }

      console.log('Credential found, attempting decryption...');
      const decryptedData = await credential.decryptCredentials(); // userPassword 제거
      console.log('Decryption successful');
      
      logAudit('read', 'credentials', credential.id, credential.userId, {
        action: 'decrypt_by_client_id',
        clientId
      });

      return {
        credential: credential.toJSON(),
        decryptedData
      };
    } catch (error) {
      console.error('Error in decryptByClientId:', error);
      logError(error, { operation: 'TaxCredential.decryptByClientId' });
      throw error;
    }
  }

  // 인증서 정보 업데이트
  async update(updateData) {
    try {
      const { 
        certData, 
        privateKey, 
        certPassword, 
        certName, 
        certType, 
        expiresAt 
      } = updateData;
      
      let encryptedData = null;
      if (certData || privateKey || certPassword) {
        // 기존 데이터 복호화 (마스터 키 사용)
        const existingData = await this.decryptCredentials();
        
        // 새로운 데이터로 업데이트
        const newCredentials = {
          certData: certData || existingData.certData,
          privateKey: privateKey || existingData.privateKey,
          certPassword: certPassword || existingData.certPassword
        };

        encryptedData = encryptionService.encryptCredentials(newCredentials); // userPassword 제거
      }

      const updates = {};

      if (encryptedData) {
        updates.encrypted_cert_data = encryptedData.encrypted_cert_data;
        updates.encrypted_private_key = encryptedData.encrypted_private_key;
        updates.encrypted_cert_password = encryptedData.encrypted_cert_password;
        updates.encryption_iv = encryptedData.encryption_iv;
        updates.encryption_tag = encryptedData.encryption_tag;
        updates.encryption_salt = null; // 마스터 키 사용하므로 NULL
      }

      if (certName !== undefined) {
        updates.cert_name = certName;
      }

      if (certType !== undefined) {
        updates.cert_type = certType;
      }

      if (expiresAt !== undefined) {
        updates.expires_at = expiresAt;
      }

      if (Object.keys(updates).length === 0) {
        return this;
      }

      const result = await query('tax_credentials', 'update', {
        where: { id: this.id },
        data: updates
      });

      if (result.error) {
        throw result.error;
      }

      const updatedCredential = new TaxCredential(result.data[0]);
      
      logAudit('update', 'credentials', this.id, this.userId, {
        updates: updateData,
        clientId: this.clientId
      });

      return updatedCredential;
    } catch (error) {
      logError(error, { operation: 'TaxCredential.update' });
      throw error;
    }
  }

  // 인증서 비활성화
  async deactivate() {
    try {
      const result = await query('tax_credentials', 'update', {
        where: { id: this.id },
        data: { is_active: false }
      });

      if (result.error) {
        throw result.error;
      }

      this.isActive = false;
      
      logAudit('update', 'credentials', this.id, this.userId, {
        action: 'deactivate',
        clientId: this.clientId
      });
    } catch (error) {
      logError(error, { operation: 'TaxCredential.deactivate' });
      throw error;
    }
  }

  // 인증서 삭제
  async delete() {
    try {
      const result = await query('tax_credentials', 'delete', {
        where: { id: this.id }
      });

      if (result.error) {
        throw result.error;
      }
      
      logAudit('delete', 'credentials', this.id, this.userId, {
        clientId: this.clientId
      });
    } catch (error) {
      logError(error, { operation: 'TaxCredential.delete' });
      throw error;
    }
  }

  // 만료된 인증서 조회
  static async findExpired() {
    try {
      const result = await rpc('get_expired_credentials');
      return result.data.map(row => new TaxCredential(row));
    } catch (error) {
      logError(error, { operation: 'TaxCredential.findExpired' });
      throw error;
    }
  }

  // 인증서 통계 조회
  static async getStats() {
    try {
      const result = await rpc('get_credentials_stats');
      return result;
    } catch (error) {
      logError(error, { operation: 'TaxCredential.getStats' });
      throw error;
    }
  }

  // 인증서 요약 정보 반환 (민감한 정보 제외)
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      clientId: this.clientId,
      certName: this.certName,
      certType: this.certType,
      isActive: this.isActive,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // 마스킹된 정보 반환 (보안용)
  toMaskedJSON() {
    return {
      id: this.id,
      userId: this.userId,
      clientId: this.clientId ? this.clientId.replace(/(.{3}).*(.{3})/, '$1****$2') : null,
      certName: this.certName ? this.certName.replace(/(.{2}).*(.{2})/, '$1***$2') : null,
      certType: this.certType,
      isActive: this.isActive,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TaxCredential;