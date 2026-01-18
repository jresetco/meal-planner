#!/usr/bin/env node

/**
 * Generate an encryption key for the ENCRYPTION_KEY environment variable
 * Run: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto')

const key = crypto.randomBytes(32).toString('hex')

console.log('\n🔐 Generated Encryption Key:\n')
console.log(key)
console.log('\n📝 Add this to your environment variables:')
console.log(`ENCRYPTION_KEY="${key}"`)
console.log('\n⚠️  IMPORTANT:')
console.log('1. Add this to your .env.local file (for local development)')
console.log('2. Add this to your deployment platform secrets (Vercel/Railway/etc)')
console.log('3. NEVER commit this key to version control')
console.log('4. Keep this key secure - losing it means you cannot decrypt existing passwords\n')
