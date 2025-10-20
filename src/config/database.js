const { Pool } = require('pg');
const logger = require('../utils/logger');

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_automation',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// 데이터베이스 풀 생성
const pool = new Pool(dbConfig);

// 연결 이벤트 핸들러
pool.on('connect', () => {
  logger.info('데이터베이스 연결 성공');
});

pool.on('error', (err) => {
  logger.error('데이터베이스 연결 오류:', err);
  process.exit(-1);
});

// 데이터베이스 연결 테스트
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('데이터베이스 연결 테스트 성공:', result.rows[0]);
    client.release();
    return true;
  } catch (err) {
    logger.error('데이터베이스 연결 테스트 실패:', err);
    return false;
  }
};

// 쿼리 실행 헬퍼 함수
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('쿼리 실행 완료', { text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('쿼리 실행 오류:', { text, params, error: err.message });
    throw err;
  }
};

// 트랜잭션 실행 헬퍼 함수
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// 연결 종료
const closePool = async () => {
  try {
    await pool.end();
    logger.info('데이터베이스 연결 풀 종료');
  } catch (err) {
    logger.error('데이터베이스 연결 풀 종료 오류:', err);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool
};

