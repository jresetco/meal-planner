# Secure Secrets Management

## Environment Variables

This app uses environment variables for sensitive configuration. Here's how to manage them securely:

## 🔐 ENCRYPTION_KEY

**What it is:** A 32-byte encryption key (64 hex characters) used to encrypt sensitive data like Paprika passwords in the database.

### Generate the Key

```bash
node scripts/generate-encryption-key.js
```

Or manually:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Local Development

1. Create `.env.local` (this file is gitignored):
```env
ENCRYPTION_KEY="your-64-character-hex-key-here"
```

2. Never commit `.env.local` to Git

### Production Deployment

Choose your deployment platform:

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add `ENCRYPTION_KEY` with your generated key
3. Available to all deployments (Production, Preview, Development)

#### Railway
1. Go to Project → Variables
2. Add `ENCRYPTION_KEY` variable
3. Automatically encrypted at rest

#### Heroku
```bash
heroku config:set ENCRYPTION_KEY="your-key-here"
```

#### AWS (Secrets Manager)
```bash
aws secretsmanager create-secret \
  --name meal-planner/encryption-key \
  --secret-string "your-key-here"
```

Then reference in your app configuration.

## 🚫 NOT GitHub Secrets

**GitHub Secrets are for CI/CD workflows only**, not runtime environment variables. They're used during GitHub Actions builds but aren't accessible to your deployed app.

## ⚠️ CRITICAL: Key Rotation

If you need to rotate the encryption key:

1. **Generate new key** (don't replace the old one yet)
2. **Decrypt all passwords** with old key
3. **Re-encrypt** with new key  
4. **Update environment variable**
5. **Delete old key**

Losing the encryption key means **permanent data loss** - you cannot decrypt existing passwords.

## 🔒 Security Best Practices

1. ✅ Use different keys for dev/staging/production
2. ✅ Store keys in platform-specific secrets management
3. ✅ Never log or expose the encryption key
4. ✅ Backup the key in a secure password manager (1Password, LastPass)
5. ❌ Never commit `.env.local` or `.env` to Git
6. ❌ Never share keys via Slack/email/text
7. ❌ Never use GitHub Secrets for runtime config

## 📋 Other Secrets

All these should be stored the same way as ENCRYPTION_KEY:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth.js session encryption
- `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - AI provider keys

## 🔄 Migration Note

If you have existing Paprika passwords stored in plaintext:

1. They'll continue to work (backward compatible)
2. On next save, they'll automatically be encrypted
3. Consider forcing a re-save: Go to Settings → Save Paprika credentials again
