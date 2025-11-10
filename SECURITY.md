# Security Guide - SCMC Workshop Management System

This document outlines security best practices for deploying and managing the SCMC application in production.

## Table of Contents
- [Secret Management](#secret-management)
- [Cloud Run Security](#cloud-run-security)
- [Database Security](#database-security)
- [Authentication & Authorization](#authentication--authorization)
- [Network Security](#network-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Security Checklist](#security-checklist)

---

## Secret Management

### Google Cloud Secret Manager (Recommended)

All sensitive data should be stored in Google Cloud Secret Manager, never in environment variables or code.

#### Creating Secrets

```bash
# Database connection string
echo -n "postgresql://user:password@host:5432/database" | \
  gcloud secrets create DATABASE_URL \
  --data-file=- \
  --replication-policy="automatic" \
  --project=${PROJECT_ID}

# JWT signing secret (generate strong random secret)
openssl rand -base64 32 | \
  gcloud secrets create JWT_SECRET \
  --data-file=- \
  --replication-policy="automatic" \
  --project=${PROJECT_ID}

# Supabase credentials
echo -n "https://xxxxx.supabase.co" | \
  gcloud secrets create SUPABASE_URL --data-file=- --project=${PROJECT_ID}

echo -n "eyJhbGc..." | \
  gcloud secrets create SUPABASE_ANON_KEY --data-file=- --project=${PROJECT_ID}

echo -n "eyJhbGc..." | \
  gcloud secrets create SUPABASE_SERVICE_KEY --data-file=- --project=${PROJECT_ID}
```

#### Secret Rotation

Rotate secrets regularly (every 90 days recommended):

```bash
# Add new version to existing secret
echo -n "new-secret-value" | \
  gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run will automatically use the latest version
# Test the new deployment first before destroying old versions

# Disable old version after confirming new version works
gcloud secrets versions disable VERSION_NUMBER --secret=SECRET_NAME

# Destroy old version after retention period
gcloud secrets versions destroy VERSION_NUMBER --secret=SECRET_NAME
```

#### Service Account for Secret Access

The GitHub workflow automatically creates a dedicated runtime service account with minimal permissions:

```bash
# Runtime service account: scmc-backend-runtime@PROJECT_ID.iam.gserviceaccount.com
# Permissions: roles/secretmanager.secretAccessor (read-only access to secrets)
```

**Key Security Features:**
- ✅ Dedicated service account per service
- ✅ Minimal permissions (only Secret Manager read access)
- ✅ No ability to modify or delete secrets
- ✅ Automatic IAM policy binding in workflow

#### Secret Access Logging

Enable audit logging for secret access:

```bash
# Enable Data Access audit logs for Secret Manager
gcloud projects set-iam-policy ${PROJECT_ID} policy.yaml
```

**policy.yaml:**
```yaml
auditConfigs:
- auditLogConfigs:
  - logType: DATA_READ
  - logType: DATA_WRITE
  service: secretmanager.googleapis.com
```

---

## Cloud Run Security

### Service Account Best Practices

**DON'T:**
- ❌ Use default Compute Engine service account
- ❌ Grant project-wide IAM roles
- ❌ Use same service account for multiple services
- ❌ Grant service accounts more permissions than needed

**DO:**
- ✅ Create dedicated service account per Cloud Run service
- ✅ Grant minimum required permissions (principle of least privilege)
- ✅ Use workload identity for GCP resource access
- ✅ Regularly audit service account permissions

### Environment Variables vs Secrets

**Use Secrets for:**
- Database passwords and connection strings
- API keys and tokens
- Encryption keys
- OAuth client secrets
- Any credential that grants access

**Use Environment Variables for:**
- Non-sensitive configuration (NODE_ENV, LOG_LEVEL)
- Public endpoints (if truly public)
- Feature flags
- Application settings

### Network Security

#### Private Services (Recommended for Production)

For services that don't need public access:

```bash
gcloud run deploy $SERVICE_NAME \
  --no-allow-unauthenticated \
  --ingress=internal-and-cloud-load-balancing
```

Then use Cloud Load Balancer with:
- Cloud Armor for DDoS protection
- SSL certificates
- Rate limiting
- IP allowlisting

#### Public Services with Cloud Armor

```bash
# Create Cloud Armor security policy
gcloud compute security-policies create scmc-armor-policy \
  --description "Security policy for SCMC backend"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy scmc-armor-policy \
  --expression "true" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600

# Block common attack patterns
gcloud compute security-policies rules create 2000 \
  --security-policy scmc-armor-policy \
  --expression "evaluatePreconfiguredExpr('sqli-stable')" \
  --action deny-403

gcloud compute security-policies rules create 3000 \
  --security-policy scmc-armor-policy \
  --expression "evaluatePreconfiguredExpr('xss-stable')" \
  --action deny-403
```

### VPC Connector (Optional - for database in VPC)

If your database is in a private VPC:

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create scmc-connector \
  --region=${REGION} \
  --range=10.8.0.0/28

# Deploy with VPC connector
gcloud run deploy $SERVICE_NAME \
  --vpc-connector=scmc-connector \
  --vpc-egress=private-ranges-only
```

### Resource Limits

Set appropriate limits to prevent resource exhaustion:

```yaml
# In workflow or manual deployment
--min-instances=0          # Scale to zero when idle
--max-instances=10         # Prevent runaway costs
--memory=512Mi            # Appropriate for NestJS app
--cpu=1                   # 1 vCPU
--timeout=300             # 5 minute timeout
--concurrency=80          # Max concurrent requests per instance
--cpu-throttling          # Enable CPU throttling when idle
```

---

## Database Security

### PostgreSQL/Supabase Security

#### Connection Security

**Always use SSL/TLS:**
```bash
# In DATABASE_URL, ensure SSL mode is enabled
postgresql://user:pass@host:5432/db?sslmode=require
```

**Connection Pooling:**
```typescript
// In Prisma schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Enable connection pooling
  relationMode = "prisma"
}
```

#### Row-Level Security (RLS)

Enable RLS policies in Supabase:

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bike_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Example policy: Managers can see all service orders
CREATE POLICY "Managers can view all orders" ON service_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );
```

#### Database Backups

**Automated Backups:**
- Supabase provides automatic daily backups
- Configure point-in-time recovery (PITR) for production
- Test restore procedures regularly

**Manual Backups:**
```bash
# Export database
pg_dump "${DATABASE_URL}" > backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to Cloud Storage for long-term retention
gsutil cp backup_*.sql gs://scmc-backups/
```

#### Database User Permissions

Create separate database users with minimal permissions:

```sql
-- Read-only user for analytics
CREATE USER analytics_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE scmc TO analytics_readonly;
GRANT USAGE ON SCHEMA public TO analytics_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_readonly;

-- Application user (created by Supabase)
-- Should have INSERT, UPDATE, DELETE on necessary tables only
```

---

## Authentication & Authorization

### JWT Security

**Token Configuration:**
```typescript
// In backend
JwtModule.register({
  secret: process.env.JWT_SECRET, // Strong random secret from Secret Manager
  signOptions: {
    expiresIn: '8h',              // Short expiration time
    algorithm: 'HS256',            // Strong algorithm
    issuer: 'scmc-backend',        // Identify token issuer
    audience: 'scmc-frontend',     // Validate token audience
  },
});
```

**Token Storage (Frontend):**
```typescript
// DO: Store in httpOnly cookie (if possible) or memory
// DON'T: Store in localStorage (XSS vulnerability)

// Use secure cookie attributes
document.cookie = `token=${jwt}; Secure; SameSite=Strict; HttpOnly`;
```

### Role-Based Access Control (RBAC)

Enforce permissions at multiple layers:

1. **API Layer (Guards)**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'finance')
@Get('sensitive-data')
getSensitiveData() { }
```

2. **Database Layer (RLS policies)**
```sql
-- Enforced by Supabase
```

3. **Frontend Layer (UI restrictions)**
```typescript
// Hide UI elements based on role
{user.role === 'manager' && <AdminPanel />}
```

### Password Security

**If implementing password authentication:**
```typescript
import * as bcrypt from 'bcrypt';

// Hash passwords with high salt rounds
const hashedPassword = await bcrypt.hash(password, 12);

// Compare passwords securely
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

**Password Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, special characters
- No common passwords (use zxcvbn library)
- Enforce password expiration (90 days)

---

## Network Security

### CORS Configuration

**Backend CORS setup:**
```typescript
// In main.ts
app.enableCors({
  origin: [
    'https://scmc.vercel.app',          // Production frontend
    'https://scmc-staging.vercel.app',  // Staging frontend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600, // Cache preflight for 1 hour
});
```

**Never use:**
```typescript
// ❌ DON'T DO THIS IN PRODUCTION
origin: '*'  // Allows any origin
```

### Content Security Policy (CSP)

**Vercel configuration (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.run.app"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

### Rate Limiting

**Backend rate limiting:**
```typescript
// Install @nestjs/throttler
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // Time to live in seconds
      limit: 100,   // Max requests per TTL
    }),
  ],
})
export class AppModule {}

// Protect sensitive endpoints
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5 requests per minute
@Post('login')
login() { }
```

---

## Monitoring & Auditing

### Cloud Logging

**Log sensitive operations:**
```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('SecurityAudit');

// Log authentication attempts
logger.log(`Login attempt: ${email}`);
logger.warn(`Failed login: ${email} - ${reason}`);

// Log privilege escalation
logger.warn(`Permission denied: User ${userId} attempted ${action}`);

// Log data access
logger.log(`User ${userId} accessed customer ${customerId}`);
```

**Structured logging:**
```typescript
logger.log({
  event: 'user.login',
  userId: user.id,
  role: user.role,
  ip: request.ip,
  timestamp: new Date().toISOString(),
});
```

### Cloud Monitoring Alerts

**Set up alerts for:**
```bash
# High error rate
gcloud alpha monitoring policies create \
  --notification-channels=${CHANNEL_ID} \
  --display-name="High Error Rate" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s

# Unusual traffic patterns
gcloud alpha monitoring policies create \
  --notification-channels=${CHANNEL_ID} \
  --display-name="Unusual Traffic" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=60s

# Failed authentication attempts
gcloud alpha monitoring policies create \
  --notification-channels=${CHANNEL_ID} \
  --display-name="Failed Auth Attempts" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

### Activity Logging

**Database audit trail:**
```typescript
// Log all critical operations to activity_logs table
await this.activityLogService.create({
  user_id: userId,
  entity_type: 'service_order',
  entity_id: orderId,
  action: 'update',
  old_values: { status: 'pending' },
  new_values: { status: 'completed' },
  ip_address: request.ip,
  user_agent: request.headers['user-agent'],
});
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in Google Cloud Secret Manager
- [ ] Dedicated service account created with minimal permissions
- [ ] JWT secret is strong (32+ random characters)
- [ ] Database uses SSL/TLS connections
- [ ] Row-Level Security (RLS) enabled on all tables
- [ ] CORS configured with specific origins (no wildcards)
- [ ] Rate limiting enabled on API endpoints
- [ ] Content Security Policy headers configured
- [ ] Security headers enabled (X-Frame-Options, etc.)
- [ ] Environment variables reviewed (no secrets exposed)

### Post-Deployment

- [ ] Cloud Armor security policy applied (if using public ingress)
- [ ] Monitoring alerts configured
- [ ] Audit logging enabled
- [ ] Backup and restore procedures tested
- [ ] Secrets rotation schedule established
- [ ] Security scanning enabled (npm audit, Snyk)
- [ ] Dependencies up to date with security patches
- [ ] Penetration testing completed (if required)

### Regular Maintenance (Monthly)

- [ ] Review access logs for anomalies
- [ ] Check for failed authentication attempts
- [ ] Update dependencies (npm update)
- [ ] Run security audit (npm audit)
- [ ] Review service account permissions
- [ ] Verify backups are working
- [ ] Test disaster recovery procedures

### Quarterly

- [ ] Rotate all secrets (JWT, API keys, etc.)
- [ ] Review and update security policies
- [ ] Conduct security training for team
- [ ] Perform vulnerability assessment
- [ ] Review and update this security guide

---

## Incident Response

### Security Incident Procedures

1. **Detection**: Monitor alerts, logs, user reports
2. **Containment**:
   - Revoke compromised credentials immediately
   - Disable affected user accounts
   - Block suspicious IP addresses
3. **Investigation**:
   - Review audit logs
   - Identify scope of breach
   - Document timeline
4. **Recovery**:
   - Rotate all secrets
   - Deploy security patches
   - Restore from clean backups if needed
5. **Post-Incident**:
   - Document lessons learned
   - Update security procedures
   - Notify affected parties if required

### Emergency Contacts

- **GCP Support**: https://console.cloud.google.com/support
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://app.supabase.com/support

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [Vercel Security](https://vercel.com/docs/security)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/deployment)
