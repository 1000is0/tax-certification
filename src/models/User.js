const { query, rpc } = require('../config/supabase');
const encryptionService = require('../utils/encryption');
const { logError, logAudit } = require('../utils/logger');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.name = data.name;
    this.role = data.role;
    this.isActive = data.is_active;
    this.lastLogin = data.last_login;
    this.creditBalance = data.credit_balance;
    this.subscriptionTier = data.subscription_tier;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // 사용자 생성
  static async create(userData) {
    try {
      const { email, password, name, role = 'user' } = userData;
      
      // 비밀번호 해시화
      const bcrypt = require('bcryptjs');
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      const result = await query('users', 'insert', {
        data: {
          email,
          password_hash: passwordHash,
          name,
          role
        }
      });

      if (result.error) {
        throw result.error;
      }

      const user = new User(result.data[0]);
      
      logAudit('create', 'user', user.id, null, {
        email: user.email,
        name: user.name,
        role: user.role
      });

      return user;
    } catch (error) {
      logError(error, { operation: 'User.create' });
      throw error;
    }
  }

  // 이메일로 사용자 조회
  static async findByEmail(email) {
    try {
      const result = await query('users', 'select', {
        where: { email },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (result.data.length === 0) {
        return null;
      }

      return new User(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'User.findByEmail' });
      throw error;
    }
  }

  // 모든 사용자 조회 (관리자용)
  static async findAll() {
    try {
      const result = await query('users', 'select', {
        columns: 'id, email, name, role, credit_balance, subscription_tier, created_at'
      });

      if (result.error) {
        throw result.error;
      }

      // JavaScript에서 정렬
      const sortedData = (result.data || []).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      return sortedData.map(userData => new User(userData));
    } catch (error) {
      logError(error, { operation: 'User.findAll' });
      throw error;
    }
  }

  // ID로 사용자 조회
  static async findById(id) {
    try {
      const result = await query('users', 'select', {
        where: { id },
        limit: 1
      });

      if (result.error) {
        throw result.error;
      }

      if (result.data.length === 0) {
        return null;
      }

      return new User(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'User.findById' });
      throw error;
    }
  }

  // 모든 사용자 조회 (페이징)
  static async findAll(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = {};

      if (filters.role) {
        whereClause.role = filters.role;
      }

      if (filters.isActive !== undefined) {
        whereClause.is_active = filters.isActive;
      }

      // 사용자 목록 조회
      const usersResult = await query('users', 'select', {
        where: whereClause,
        offset,
        limit,
        orderBy: 'created_at'
      });

      if (usersResult.error) {
        throw usersResult.error;
      }

      // 전체 개수 조회 (Supabase에서는 별도 쿼리 필요)
      const countResult = await rpc('get_user_count', { filters: whereClause });
      const total = countResult || usersResult.data.length;

      const users = usersResult.data.map(row => new User(row));

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logError(error, { operation: 'User.findAll' });
      throw error;
    }
  }

  // 사용자 정보 업데이트
  async update(updateData) {
    try {
      const { name, role, isActive } = updateData;
      const updates = {};

      if (name !== undefined) {
        updates.name = name;
      }

      if (role !== undefined) {
        updates.role = role;
      }

      if (isActive !== undefined) {
        updates.is_active = isActive;
      }

      if (Object.keys(updates).length === 0) {
        return this;
      }

      const result = await query('users', 'update', {
        where: { id: this.id },
        data: updates
      });

      if (result.error) {
        throw result.error;
      }

      const updatedUser = new User(result.data[0]);
      
      logAudit('update', 'user', this.id, null, {
        updates: updateData
      });

      return updatedUser;
    } catch (error) {
      logError(error, { operation: 'User.update' });
      throw error;
    }
  }

  // 비밀번호 변경
  async changePassword(newPassword) {
    try {
      const bcrypt = require('bcryptjs');
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      
      const result = await query('users', 'update', {
        where: { id: this.id },
        data: { password_hash: passwordHash }
      });

      if (result.error) {
        throw result.error;
      }

      logAudit('update', 'user', this.id, null, {
        action: 'password_change'
      });

      return new User(result.data[0]);
    } catch (error) {
      logError(error, { operation: 'User.changePassword' });
      throw error;
    }
  }

  // 로그인 시간 업데이트
  async updateLastLogin() {
    try {
      const result = await query('users', 'update', {
        where: { id: this.id },
        data: { last_login: new Date().toISOString() }
      });

      if (result.error) {
        throw result.error;
      }

      this.lastLogin = new Date();
    } catch (error) {
      logError(error, { operation: 'User.updateLastLogin' });
      throw error;
    }
  }

  // 사용자 삭제 (소프트 삭제)
  async delete() {
    try {
      const result = await query('users', 'update', {
        where: { id: this.id },
        data: { is_active: false }
      });

      if (result.error) {
        throw result.error;
      }

      this.isActive = false;
      
      logAudit('delete', 'user', this.id, null);
    } catch (error) {
      logError(error, { operation: 'User.delete' });
      throw error;
    }
  }

  // 비밀번호 검증
  async verifyPassword(password) {
    try {
      const bcrypt = require('bcryptjs');
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      logError(error, { operation: 'User.verifyPassword' });
      throw error;
    }
  }

  // 사용자 통계 조회
  static async getStats() {
    try {
      const result = await rpc('get_user_stats');
      return result;
    } catch (error) {
      logError(error, { operation: 'User.getStats' });
      throw error;
    }
  }

  // 비밀번호 검증
  async comparePassword(password) {
    try {
      const bcrypt = require('bcryptjs');
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      logError(error, { operation: 'User.comparePassword' });
      throw error;
    }
  }

  // 사용자 요약 정보 반환 (민감한 정보 제외)
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // 민감한 정보 포함한 전체 정보 반환 (관리자용)
  toFullJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;