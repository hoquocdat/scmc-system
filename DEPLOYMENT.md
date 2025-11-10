# Deployment Guide

This document provides instructions for deploying the SCMC Workshop Management System to production environments.

## Architecture Overview

- **Backend**: NestJS API deployed on Google Cloud Run
- **Frontend**: React/Vite application deployed on Vercel
- **Database**: PostgreSQL hosted on Supabase
- **CI/CD**: GitHub Actions workflows for automated deployments

## Prerequisites

### Google Cloud Platform (Backend)
1. GCP Project created
2. Cloud Run API enabled
3. Artifact Registry API enabled
4. Service account with the following roles:
   - Cloud Run Admin
   - Artifact Registry Writer
   - Service Account User

### Vercel (Frontend)
1. Vercel account and project created
2. Vercel CLI installed (`npm install -g vercel`)
3. Project linked to Vercel

### GitHub Secrets Required

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

#### Backend Secrets
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: Service account JSON key (entire content)
- `DATABASE_URL`: PostgreSQL connection string (stored in GCP Secret Manager)
- `JWT_SECRET`: JWT signing secret (stored in GCP Secret Manager)
- `SUPABASE_URL`: Supabase project URL (stored in GCP Secret Manager)
- `SUPABASE_ANON_KEY`: Supabase anonymous key (stored in GCP Secret Manager)
- `SUPABASE_SERVICE_KEY`: Supabase service role key (stored in GCP Secret Manager)

#### Frontend Secrets
- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

## Setup Instructions

### 1. Google Cloud Setup (Backend)

#### Create GCP Project
```bash
gcloud projects create scmc-workshop --name="SCMC Workshop"
gcloud config set project scmc-workshop
```

#### Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

#### Create Artifact Registry Repository
```bash
gcloud artifacts repositories create scmc \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="SCMC Workshop container images"
```

#### Create Service Account
```bash
gcloud iam service-accounts create scmc-deployer \
  --display-name="SCMC Deployer"

gcloud projects add-iam-policy-binding scmc-workshop \
  --member="serviceAccount:scmc-deployer@scmc-workshop.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding scmc-workshop \
  --member="serviceAccount:scmc-deployer@scmc-workshop.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding scmc-workshop \
  --member="serviceAccount:scmc-deployer@scmc-workshop.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### Generate Service Account Key
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=scmc-deployer@scmc-workshop.iam.gserviceaccount.com
```

Copy the entire contents of `key.json` and add it as `GCP_SA_KEY` secret in GitHub.

#### Create Secrets in GCP Secret Manager
```bash
# Database URL
echo -n "postgresql://user:password@host:5432/database" | \
  gcloud secrets create DATABASE_URL --data-file=-

# JWT Secret
echo -n "your-jwt-secret-here" | \
  gcloud secrets create JWT_SECRET --data-file=-

# Supabase URL
echo -n "https://your-project.supabase.co" | \
  gcloud secrets create SUPABASE_URL --data-file=-

# Supabase Anonymous Key
echo -n "your-supabase-anon-key" | \
  gcloud secrets create SUPABASE_ANON_KEY --data-file=-

# Supabase Service Key
echo -n "your-supabase-service-key" | \
  gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-
```

#### Grant Cloud Run Access to Secrets
```bash
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:scmc-deployer@scmc-workshop.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for other secrets: JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
```

### 2. Vercel Setup (Frontend)

#### Install Vercel CLI
```bash
npm install -g vercel
```

#### Link Project to Vercel
```bash
cd frontend
vercel link
```

Follow the prompts to link your project. This will create a `.vercel` directory with project configuration.

#### Get Vercel Credentials
```bash
# Get your Vercel token from: https://vercel.com/account/tokens
# Create a new token with full access

# Get your Organization ID and Project ID
cat .vercel/project.json
```

Add the following to GitHub secrets:
- `VERCEL_TOKEN`: Your token from Vercel dashboard
- `VERCEL_ORG_ID`: From `.vercel/project.json`
- `VERCEL_PROJECT_ID`: From `.vercel/project.json`

#### Configure Environment Variables in Vercel
Go to your Vercel project settings → Environment Variables and add:

```
VITE_API_BASE_URL=https://scmc-backend-xxxxx.run.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Backend Dockerfile

Ensure your `backend/Dockerfile` is optimized for production:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npx prisma generate

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/main"]
```

## Deployment Workflows

### Backend Deployment (Cloud Run)

The backend deployment workflow ([.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)) automatically:

1. Triggers on push to `main` or `production` branches
2. Authenticates to Google Cloud
3. Builds Docker image
4. Pushes image to Artifact Registry
5. Creates runtime service account with minimal permissions
6. Checks if service exists to determine deployment method
7. Deploys to Cloud Run (secrets configured only on first deployment)
8. Tests the deployment health endpoint

**Configuration**:
- Region: `asia-southeast1`
- Memory: `512Mi`
- CPU: `1`
- Timeout: `300s`
- Auto-scaling: `0-10` instances
- Allow unauthenticated access

**Deployment Strategy**:
- **First Deployment**: Uses `--set-secrets` to configure all secrets
- **Subsequent Deployments**: Only updates the container image, preserving existing secrets
- This approach avoids unnecessary secret updates and improves deployment speed

#### Manual Deployment Methods

**Method 1: Update Image Only (Recommended for regular deployments)**

This method preserves all existing secrets and environment variables:

```bash
cd backend

# Build and push Docker image
docker build -t asia-southeast1-docker.pkg.dev/scmc-workshop/scmc/scmc-backend:latest .
docker push asia-southeast1-docker.pkg.dev/scmc-workshop/scmc/scmc-backend:latest

# Deploy only the new image (secrets remain unchanged)
gcloud run deploy scmc-backend \
  --image=asia-southeast1-docker.pkg.dev/scmc-workshop/scmc/scmc-backend:latest \
  --platform=managed \
  --region=asia-southeast1
```

**Method 2: Full Configuration (First deployment or secret changes)**

Use this when deploying for the first time or when you need to update secrets:

```bash
gcloud run deploy scmc-backend \
  --image=asia-southeast1-docker.pkg.dev/scmc-workshop/scmc/scmc-backend:latest \
  --platform=managed \
  --region=asia-southeast1 \
  --service-account=scmc-backend-runtime@PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --cpu-boost \
  --execution-environment=gen2 \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"
```

**Method 3: Using Configuration File (Alternative)**

Deploy using the YAML configuration file:

```bash
# Update the image in the config file
sed -i "s|IMAGE_PLACEHOLDER|asia-southeast1-docker.pkg.dev/scmc-workshop/scmc/scmc-backend:latest|g" .github/cloud-run-config.yaml

# Deploy using the config file
gcloud run services replace .github/cloud-run-config.yaml \
  --region=asia-southeast1

# Restore placeholder for next deployment
git checkout .github/cloud-run-config.yaml
```

#### Updating Secrets Without Redeployment

To update secrets without triggering a new deployment:

```bash
# Update a secret value in Secret Manager
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run will automatically use the latest version on next cold start
# Or force restart all instances:
gcloud run services update scmc-backend \
  --region=asia-southeast1 \
  --update-secrets="SECRET_NAME=SECRET_NAME:latest"
```

### Frontend Deployment (Vercel)

The frontend deployment workflow ([.github/workflows/deploy-frontend.yml](.github/workflows/deploy-frontend.yml)) automatically:

1. Triggers on push to `main` or `production` branches
2. Installs dependencies
3. Pulls Vercel environment configuration
4. Builds the project
5. Deploys to Vercel production
6. Tests the deployment

**Manual Deployment**:
```bash
cd frontend

# Deploy to Vercel production
vercel --prod

# Or build and deploy prebuilt artifacts
vercel build --prod
vercel deploy --prebuilt --prod
```

## Database Migrations

### Production Migration Strategy

1. **Create Migration Locally**:
```bash
cd backend
npx prisma migrate dev --name description_of_change
```

2. **Test Migration**:
```bash
# Test on local database first
npx prisma migrate deploy
```

3. **Apply to Production**:
```bash
# SSH into Cloud Run instance or use Cloud Shell
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

### Rollback Strategy

If a deployment fails:

1. **Backend**: Revert to previous Cloud Run revision
```bash
gcloud run services update-traffic scmc-backend \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-southeast1
```

2. **Frontend**: Revert to previous Vercel deployment
```bash
# Via Vercel dashboard or CLI
vercel rollback
```

3. **Database**: Prisma doesn't support automatic rollback. Create a new migration that reverts changes:
```bash
cd backend
npx prisma migrate dev --name revert_previous_change
```

## Monitoring and Logging

### Backend (Cloud Run)

**View Logs**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend" --limit 50 --format json
```

**Monitor Metrics**:
- Go to Cloud Run console → Select service → Metrics tab
- Monitor: Request count, latency, error rate, instance count

**Set Up Alerts**:
```bash
# Create alert for error rate > 5%
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="SCMC Backend High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=60s
```

### Frontend (Vercel)

**View Logs**:
- Go to Vercel dashboard → Your project → Deployments → Select deployment → Logs

**Monitor Performance**:
- Vercel provides automatic Web Vitals monitoring
- Access via: Dashboard → Your project → Analytics

## Security Considerations

### Backend
- ✅ All secrets stored in GCP Secret Manager (never in code)
- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ HTTPS enforced by Cloud Run
- ✅ CORS configured for frontend domain only
- ⚠️ Consider: Rate limiting, API key rotation schedule

### Frontend
- ✅ Environment variables for API endpoints
- ✅ No sensitive data in client-side code
- ✅ HTTPS enforced by Vercel
- ⚠️ Consider: Content Security Policy headers

### Database
- ✅ Connection via SSL
- ✅ Row-level security policies in Supabase
- ✅ Regular automated backups
- ⚠️ Consider: Point-in-time recovery setup

## Cost Optimization

### Cloud Run (Backend)
- **Current Config**: 0-10 instances, 512Mi, 1 CPU
- **Expected Cost**: ~$5-20/month for low traffic
- **Optimization**:
  - Set `min-instances=0` for cold starts (free tier covers idle time)
  - Monitor and adjust max-instances based on usage
  - Consider Reserved instances for consistent traffic

### Vercel (Frontend)
- **Free Tier**: Covers most small-medium projects
- **Bandwidth**: 100GB/month included
- **Build Minutes**: 6000 minutes/month
- **Optimization**:
  - Enable edge caching
  - Optimize image assets
  - Use Vercel Analytics (optional, paid)

### Supabase (Database)
- **Free Tier**: 500MB database, 2GB bandwidth
- **Paid Plans**: Start at $25/month for production
- **Optimization**:
  - Regular VACUUM operations
  - Index optimization for queries
  - Archive old service orders

## Troubleshooting

### Backend Deployment Fails

**Issue**: Docker build fails
```bash
# Check Docker build locally
cd backend
docker build -t test .

# Common fixes:
# 1. Check Dockerfile syntax
# 2. Ensure all dependencies in package.json
# 3. Verify Prisma schema is valid
```

**Issue**: Cloud Run deployment fails with health check error
```bash
# Check service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend" --limit 10

# Common fixes:
# 1. Verify DATABASE_URL secret is correct
# 2. Check Prisma migrations are applied
# 3. Ensure /health endpoint exists and returns 200
```

**Issue**: Secrets not accessible
```bash
# Grant access to secrets
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR_SA@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Frontend Deployment Fails

**Issue**: Build fails on Vercel
```bash
# Test build locally
cd frontend
npm run build

# Common fixes:
# 1. Check for TypeScript errors
# 2. Ensure environment variables are set in Vercel
# 3. Verify all dependencies are in package.json
```

**Issue**: API calls fail after deployment
- Check `VITE_API_BASE_URL` in Vercel environment variables
- Verify CORS configuration in backend allows Vercel domain
- Check Cloud Run service is publicly accessible

### Database Connection Issues

**Issue**: Connection timeout
- Verify database URL is correct
- Check Supabase project is active
- Ensure connection pooling settings are appropriate

**Issue**: Migration fails
```bash
# Check current migration status
npx prisma migrate status

# Force reset (CAUTION: Development only)
npx prisma migrate reset

# Apply specific migration
npx prisma migrate resolve --applied MIGRATION_NAME
```

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly**:
- Review Cloud Run logs for errors
- Check Vercel analytics for performance issues
- Monitor database size and backup status

**Monthly**:
- Review and optimize database indexes
- Update dependencies (npm outdated)
- Review and rotate API keys/tokens
- Check cost reports and optimize resources

**Quarterly**:
- Security audit (npm audit, Snyk)
- Performance benchmarking
- Disaster recovery test
- Review and update documentation

### Contacts

- **GCP Support**: [Google Cloud Console](https://console.cloud.google.com/support)
- **Vercel Support**: [Vercel Support](https://vercel.com/support)
- **Supabase Support**: [Supabase Dashboard](https://app.supabase.com/)

## Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [NestJS Production Best Practices](https://docs.nestjs.com/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)
- [Prisma Production Guide](https://www.prisma.io/docs/guides/deployment)
