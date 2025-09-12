// Lightweight wrapper around `jose` for verifying OpenAI ID tokens (ESM-only package)
// We keep CommonJS here and import jose dynamically inside async functions.

const OPENAI_ISSUER = 'https://api.openai.com'

let cachedJose = null
let cachedJwks = null

async function getJose() {
  if (!cachedJose) {
    cachedJose = await import('jose')
  }
  return cachedJose
}

async function getRemoteJwks() {
  if (!cachedJwks) {
    const { createRemoteJWKSet } = await getJose()
    cachedJwks = createRemoteJWKSet(new URL('https://api.openai.com/.well-known/jwks.json'))
  }
  return cachedJwks
}

/**
 * Verify an OpenAI ID token using remote JWKS.
 * @param {string} idToken - The JWT string returned by OpenAI OAuth.
 * @param {string} clientId - Your configured OpenAI OAuth client_id (audience).
 * @returns {Promise<object>} The verified JWT payload.
 */
async function verifyOpenAIIdToken(idToken, clientId) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid ID token')
  }
  if (!clientId) {
    throw new Error('Missing client_id for verification')
  }

  const { jwtVerify } = await getJose()
  const jwks = await getRemoteJwks()

  // Perform full verification including signature, issuer and audience
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: OPENAI_ISSUER,
    audience: clientId
  })

  return payload
}

module.exports = {
  verifyOpenAIIdToken,
  OPENAI_ISSUER
}
