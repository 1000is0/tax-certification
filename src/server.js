const app = require('./app');
const { testConnection } = require('./config/supabase');
const { logInfo, logError } = require('./utils/logger');
const PORT = process.env.PORT || 3000;

// app 미들웨어/라우트는 src/app.js에서 구성

// 서버 시작
const startServer = async () => {
  try {
    // Supabase 연결 테스트
    const isConnected = await testConnection();
    if (!isConnected) {
      // 개발 편의를 위해 연결 실패 시에도 서버는 기동하고 경고만 남김
      logError(new Error('Supabase 연결 실패'), { operation: 'startServer' });
    }

    app.listen(PORT, () => {
      logInfo(`서버가 포트 ${PORT}에서 시작되었습니다.`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
      });
    });
  } catch (error) {
    logError(error, { operation: 'startServer' });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM 신호를 받았습니다. 서버를 종료합니다.');
  process.exit(0);
});

process.on('SIGINT', () => {
  logInfo('SIGINT 신호를 받았습니다. 서버를 종료합니다.');
  process.exit(0);
});

// 처리되지 않은 Promise rejection 핸들러
process.on('unhandledRejection', (reason, promise) => {
  logError(new Error(`처리되지 않은 Promise rejection: ${reason}`), {
    promise: promise.toString(),
    reason: reason.toString()
  });
});

// 처리되지 않은 예외 핸들러
process.on('uncaughtException', (error) => {
  logError(error, { operation: 'uncaughtException' });
  process.exit(1);
});

startServer();

module.exports = app;
