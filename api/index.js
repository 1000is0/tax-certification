const app = require('../src/app');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    // Failsafe to avoid silent 500s in serverless runtime
    console.error('API function fatal error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};


