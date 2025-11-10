# Deployment Quick Start Guide

Quick reference for deploying SCMC backend and frontend.

## Prerequisites

- Google Cloud SDK installed and configured
- Docker installed
- Vercel CLI installed (`npm install -g vercel`)
- Required secrets created in GCP Secret Manager

## Backend Deployment (Cloud Run)

### Standard Deployment (Code Changes Only)

When you've made code changes and just need to deploy the new version:

```bash
# Navigate to backend directory
cd backend

# Build and tag Docker image
docker build -t asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest .

# Push to Artifact Registry
docker push asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest

# Deploy to Cloud Run (preserves existing secrets and config)
gcloud run deploy scmc-backend \
  --image=asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest \
  --region=asia-southeast1
```

**That's it!** This is the fastest deployment method for regular updates.

### First-Time Deployment or Secret Updates

Use this when:
- Deploying for the first time
- Updating secrets
- Changing resource limits

```bash
# 1. Create runtime service account (first time only)
gcloud iam service-accounts create scmc-backend-runtime \
  --display-name="Cloud Run runtime service account"

# 2. Grant Secret Manager access
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:scmc-backend-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. Build and push image
cd backend
docker build -t asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest .
docker push asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest

# 4. Deploy with full configuration
gcloud run deploy scmc-backend \
  --image=asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/scmc-backend:latest \
  --platform=managed \
  --region=asia-southeast1 \
  --service-account=scmc-backend-runtime@${PROJECT_ID}.iam.gserviceaccount.com \
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

### Quick Commands

```bash
# View service details
gcloud run services describe scmc-backend --region=asia-southeast1

# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend" --limit 50

# Get service URL
gcloud run services describe scmc-backend \
  --region=asia-southeast1 \
  --format='value(status.url)'

# Scale to zero (stop all instances)
gcloud run services update scmc-backend \
  --region=asia-southeast1 \
  --min-instances=0

# Force restart (useful after secret updates)
gcloud run services update scmc-backend \
  --region=asia-southeast1 \
  --update-env-vars="FORCE_RESTART=$(date +%s)"
```

## Frontend Deployment (Vercel)

### Standard Deployment

```bash
cd frontend

# Deploy to production
vercel --prod
```

### First-Time Setup

```bash
cd frontend

# Link to Vercel project
vercel link

# Set environment variables in Vercel dashboard:
# - VITE_API_BASE_URL
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY

# Deploy
vercel --prod
```

### Quick Commands

```bash
# Deploy to preview (non-production)
vercel

# View deployments
vercel ls

# View logs
vercel logs

# Rollback to previous deployment
vercel rollback
```

## Secret Management

### Create Secret

```bash
# Interactive (will prompt for value)
gcloud secrets create SECRET_NAME --replication-policy="automatic"

# From file
echo -n "secret-value" | gcloud secrets create SECRET_NAME --data-file=-
```

### Update Secret

```bash
# Add new version
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Cloud Run will use latest version automatically
# Or force update:
gcloud run services update scmc-backend \
  --region=asia-southeast1 \
  --update-secrets="SECRET_NAME=SECRET_NAME:latest"
```

### View Secrets

```bash
# List all secrets
gcloud secrets list

# View secret metadata (not the value)
gcloud secrets describe SECRET_NAME

# View secret versions
gcloud secrets versions list SECRET_NAME

# Access secret value (requires permission)
gcloud secrets versions access latest --secret=SECRET_NAME
```

## Database Migrations

### Apply Migrations

```bash
cd backend

# Run migrations against production database
DATABASE_URL="your-production-url" npx prisma migrate deploy

# Or via Cloud Run (if Prisma is installed in container)
gcloud run jobs execute prisma-migrate \
  --region=asia-southeast1 \
  --wait
```

### Create New Migration

```bash
cd backend

# Create migration locally
npx prisma migrate dev --name description_of_change

# Test on local database first
npx prisma migrate deploy

# Then apply to production
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

## Monitoring

### View Logs

```bash
# Backend logs (last 50 entries)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend" \
  --limit 50 \
  --format=json

# Real-time logs
gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend"

# Filter for errors only
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend AND severity>=ERROR" \
  --limit 50
```

### Check Service Health

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe scmc-backend \
  --region=asia-southeast1 \
  --format='value(status.url)')

# Test health endpoint
curl -f ${SERVICE_URL}/health

# Test with verbose output
curl -v ${SERVICE_URL}/health
```

### View Metrics

```bash
# Open Cloud Console metrics page
gcloud run services describe scmc-backend \
  --region=asia-southeast1 \
  --format='value(status.url)' | \
  xargs -I {} echo "https://console.cloud.google.com/run/detail/asia-southeast1/scmc-backend/metrics"
```

## Troubleshooting

### Backend Won't Start

```bash
# Check recent logs for errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scmc-backend AND severity>=ERROR" \
  --limit 10 \
  --format=json

# Common issues:
# 1. Database connection failed - check DATABASE_URL secret
# 2. Missing secrets - verify all secrets exist and have correct permissions
# 3. Out of memory - increase memory limit
```

### Secrets Not Working

```bash
# Verify secret exists
gcloud secrets describe SECRET_NAME

# Verify service account has access
gcloud secrets get-iam-policy SECRET_NAME

# Grant access if missing
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:scmc-backend-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deployment Failed

```bash
# Check deployment status
gcloud run services describe scmc-backend --region=asia-southeast1

# View latest revision
gcloud run revisions list \
  --service=scmc-backend \
  --region=asia-southeast1 \
  --limit=5

# Rollback to previous revision
gcloud run services update-traffic scmc-backend \
  --region=asia-southeast1 \
  --to-revisions=PREVIOUS_REVISION=100
```

## Environment Variables

Set these in your local environment for convenience:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PROJECT_ID="your-project-id"
export REGION="asia-southeast1"
export SERVICE_NAME="scmc-backend"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

Then you can use variables in commands:
```bash
gcloud run deploy ${SERVICE_NAME} \
  --image=asia-southeast1-docker.pkg.dev/${PROJECT_ID}/scmc/${SERVICE_NAME}:latest \
  --region=${REGION}
```

## GitHub Actions

The GitHub Actions workflows handle deployment automatically:

- **Backend**: Triggered on push to `main` or `production` with changes in `backend/` directory
- **Frontend**: Triggered on push to `main` or `production` with changes in `frontend/` directory

To manually trigger:
1. Go to GitHub repository → Actions tab
2. Select workflow (Deploy Backend or Deploy Frontend)
3. Click "Run workflow" button
4. Select branch and click "Run workflow"

## Cost Optimization

```bash
# Scale to zero when not in use (dev/staging)
gcloud run services update scmc-backend \
  --region=asia-southeast1 \
  --min-instances=0 \
  --max-instances=1

# View current billing
gcloud billing accounts list
gcloud beta billing projects describe ${PROJECT_ID}

# Set budget alerts in Cloud Console:
# https://console.cloud.google.com/billing/budgets
```

## Quick Links

- **Cloud Run Console**: https://console.cloud.google.com/run
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager
- **Logs Explorer**: https://console.cloud.google.com/logs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com/

---

For detailed documentation, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [CLAUDE.md](CLAUDE.md) - Project documentation
