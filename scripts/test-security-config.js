const assert = require('assert');
const path = require('path');

const securityPath = path.resolve(__dirname, '../server/config/security.js');

function loadSecurityWithEnv(env) {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS
  };

  process.env.NODE_ENV = env.NODE_ENV;
  process.env.CORS_ORIGINS = env.CORS_ORIGINS;
  delete require.cache[securityPath];

  const security = require(securityPath);

  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  delete require.cache[securityPath];
  return security;
}

function callOrigin(corsOptions, origin) {
  return new Promise((resolve, reject) => {
    corsOptions.origin(origin, (err, allowed) => {
      if (err) return reject(err);
      resolve(allowed);
    });
  });
}

(async () => {
  const prodSecurity = loadSecurityWithEnv({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://allowed.example,https://miniapp.example'
  });

  assert.strictEqual(await callOrigin(prodSecurity.corsOptions, 'https://allowed.example'), true);
  await assert.rejects(() => callOrigin(prodSecurity.corsOptions, 'https://blocked.example'));

  const devSecurity = loadSecurityWithEnv({
    NODE_ENV: 'development',
    CORS_ORIGINS: '*'
  });

  assert.strictEqual(await callOrigin(devSecurity.corsOptions, 'https://anything.example'), true);
  assert.strictEqual(await callOrigin(devSecurity.corsOptions, undefined), true);

  console.log('Security config tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
