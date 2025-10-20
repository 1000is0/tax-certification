const app = require('../src/app');

module.exports = (req, res) => {
  try {
    console.log('API request received:', req.method, req.url);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    return app(req, res);
  } catch (err) {
    // Failsafe to avoid silent 500s in serverless runtime
    console.error('API function fatal error:', err);
    console.error('Error stack:', err.stack);
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      code: 'FATAL_ERROR',
      details: err.message
    }));
  }
};


