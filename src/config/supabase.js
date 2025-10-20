const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL;
// 서버 사이드에서는 서비스 역할 키가 있으면 우선 사용해 RLS 제약을 우회해 서버 작업을 수행
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 개발 편의를 위해 환경변수가 없으면 Supabase를 비활성화하고 서버는 기동되도록 함
const isSupabaseDisabled = !supabaseUrl || !supabaseKey;
if (isSupabaseDisabled) {
  logger.warn('Supabase 환경변수가 설정되지 않아 비활성 상태로 서버를 기동합니다. (.env 설정 필요)');
}

// Supabase 클라이언트 생성 (활성 상태일 때만)
const supabase = isSupabaseDisabled ? null : createClient(supabaseUrl, supabaseKey);

// 연결 테스트
const testConnection = async () => {
  if (isSupabaseDisabled) {
    // 비활성 상태에서는 바로 성공 처리하여 서버 기동을 막지 않음
    return true;
  }
  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1);
    if (error) {
      logger.error('Supabase 연결 테스트 실패:', error);
      return false;
    }
    logger.info('Supabase 연결 테스트 성공');
    return true;
  } catch (err) {
    logger.error('Supabase 연결 테스트 오류:', err);
    return false;
  }
};

// 쿼리 실행 헬퍼 함수
const query = async (table, operation, options = {}) => {
  if (isSupabaseDisabled) {
    throw new Error('Supabase가 비활성화되어 있습니다. .env에 SUPABASE_URL, SUPABASE_ANON_KEY를 설정하세요.');
  }
  const start = Date.now();
  try {
    let result;
    
    switch (operation) {
      case 'select':
        {
          let q = supabase.from(table).select(options.columns || '*');
          if (options.where && typeof options.where === 'object') {
            for (const [k, v] of Object.entries(options.where)) {
              q = q.eq(k, v);
            }
          }
          if (options.orderBy) {
            q = q.order(options.orderBy, { ascending: options.ascending ?? false });
          }
          if (typeof options.offset === 'number' && typeof options.limit === 'number') {
            q = q.range(options.offset, options.offset + options.limit - 1);
          }
          result = await q;
        }
        break;
        
      case 'insert':
        // return inserted rows
        result = await supabase.from(table).insert(options.data).select('*');
        break;
        
      case 'update':
        {
          let q = supabase.from(table).update(options.data).select('*');
          if (options.where && typeof options.where === 'object') {
            for (const [k, v] of Object.entries(options.where)) {
              q = q.eq(k, v);
            }
          }
          result = await q;
        }
        break;
        
      case 'delete':
        {
          let q = supabase.from(table).delete();
          if (options.where && typeof options.where === 'object') {
            for (const [k, v] of Object.entries(options.where)) {
              q = q.eq(k, v);
            }
          }
          result = await q;
        }
        break;
        
      default:
        throw new Error(`지원하지 않는 작업: ${operation}`);
    }
    
    const duration = Date.now() - start;
    logger.debug('Supabase 쿼리 실행 완료', { table, operation, duration });
    
    if (result.error) {
      throw result.error;
    }
    
    return result;
  } catch (err) {
    logger.error('Supabase 쿼리 실행 오류:', { table, operation, error: err.message });
    throw err;
  }
};

// RPC 함수 호출
const rpc = async (functionName, params = {}) => {
  if (isSupabaseDisabled) {
    throw new Error('Supabase가 비활성화되어 있습니다. RPC를 호출할 수 없습니다.');
  }
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (err) {
    logger.error('Supabase RPC 호출 오류:', { functionName, error: err.message });
    throw err;
  }
};

// 실시간 구독
const subscribe = (table, callback, filter = {}) => {
  if (isSupabaseDisabled) {
    return null;
  }
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: table,
      filter: filter
    }, callback)
    .subscribe();
};

module.exports = {
  supabase,
  query,
  rpc,
  subscribe,
  testConnection,
  isSupabaseDisabled
};
