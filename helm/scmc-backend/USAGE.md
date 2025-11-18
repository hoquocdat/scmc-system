# SCMC Backend Helm Chart Usage Guide

This guide provides practical examples for deploying the SCMC backend using Helm.

## Table of Contents

- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Secret Management Strategies](#secret-management-strategies)
- [Common Operations](#common-operations)

## Development Deployment

### Using values-dev.yaml (Simplest for Development)

The `values-dev.yaml` file includes everything you need for local development:

```bash
# Install with all defaults
helm install scmc-backend ./helm/scmc-backend -f ./helm/scmc-backend/values-dev.yaml

# Access the service
kubectl port-forward svc/scmc-backend 8080:80

# Test
curl http://localhost:8080/api/health
```

### Using --set Flags

```bash
helm install scmc-backend ./helm/scmc-backend \
  --set secrets.create=true \
  --set secrets.data.DATABASE_URL='postgresql://localhost:5432/scmc_sms' \
  --set secrets.data.JWT_SECRET='dev-secret' \
  --set replicaCount=1 \
  --set autoscaling.enabled=false \
  --set ingress.enabled=false
```

## Production Deployment

### Option 1: External Secret Management (Recommended)

Best for production environments with proper secret management.

```bash
# Step 1: Create secrets using kubectl
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='postgresql://prod-user:prod-pass@db-host:5432/scmc_sms' \
  --from-literal=JWT_SECRET='your-super-secure-jwt-secret-here'

# Step 2: Create production values file (copy from example)
cp ./helm/scmc-backend/values-production.example.yaml values-production.yaml

# Step 3: Edit values-production.yaml with your settings
# - Update domain names
# - Adjust resource limits
# - Configure autoscaling
# - Set correct image tag

# Step 4: Install
helm install scmc-backend ./helm/scmc-backend -f values-production.yaml
```

### Option 2: Helm-Managed Secrets

Simpler but requires careful handling of values files.

```bash
# Step 1: Create production values file
cat > values-production.yaml <<EOF
image:
  tag: "v1.0.0"

secrets:
  create: true
  data:
    DATABASE_URL: "postgresql://prod-user:prod-pass@db-host:5432/scmc_sms"
    JWT_SECRET: "your-super-secure-jwt-secret"

ingress:
  enabled: true
  hosts:
    - host: api.yourdomain.com
      paths:
        - path: /*
          pathType: ImplementationSpecific

managedCertificate:
  domains:
    - api.yourdomain.com

autoscaling:
  minReplicas: 3
  maxReplicas: 20
EOF

# Step 2: Install (values file contains secrets, so keep it secure!)
helm install scmc-backend ./helm/scmc-backend -f values-production.yaml

# IMPORTANT: Add values-production.yaml to .gitignore!
echo "values-production.yaml" >> .gitignore
```

### Option 3: Using --set for Secrets (CI/CD)

Good for CI/CD pipelines where secrets come from environment variables.

```bash
helm install scmc-backend ./helm/scmc-backend \
  -f values-production.yaml \
  --set secrets.create=true \
  --set secrets.data.DATABASE_URL="${DATABASE_URL}" \
  --set secrets.data.JWT_SECRET="${JWT_SECRET}" \
  --set image.tag="${CI_COMMIT_SHA}"
```

## Secret Management Strategies

### Strategy 1: Kubernetes Secrets (Manual)

```bash
# Create secret
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='...' \
  --from-literal=JWT_SECRET='...'

# Deploy with secrets.create=false (default)
helm install scmc-backend ./helm/scmc-backend
```

**Pros:**
- Secrets separate from Helm
- Can use different secret management tools
- Secrets not in Helm history

**Cons:**
- Manual secret creation step
- Must manage secret lifecycle separately

### Strategy 2: Sealed Secrets

```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# Create sealed secret
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='...' \
  --from-literal=JWT_SECRET='...' \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Commit sealed-secret.yaml to git (it's encrypted!)
# Apply sealed secret
kubectl apply -f sealed-secret.yaml

# Deploy
helm install scmc-backend ./helm/scmc-backend
```

**Pros:**
- Secrets can be safely committed to git
- Encrypted at rest
- Automatic decryption in cluster

**Cons:**
- Requires Sealed Secrets controller
- Additional complexity

### Strategy 3: Google Secret Manager

```bash
# Create secrets in Google Secret Manager
gcloud secrets create scmc-database-url --data-file=-
# (paste DATABASE_URL and press Ctrl+D)

gcloud secrets create scmc-jwt-secret --data-file=-
# (paste JWT_SECRET and press Ctrl+D)

# Use External Secrets Operator or Workload Identity to sync
# (requires additional setup)
```

### Strategy 4: Helm-Managed (Development Only)

```bash
# Use values-dev.yaml
helm install scmc-backend ./helm/scmc-backend -f values-dev.yaml
```

**Pros:**
- Simplest for development
- Everything in one file

**Cons:**
- Secrets visible in Helm history
- Not recommended for production
- Risk of committing secrets to git

## Common Operations

### Upgrade Deployment

```bash
# Upgrade with new image
helm upgrade scmc-backend ./helm/scmc-backend \
  -f values-production.yaml \
  --set image.tag=v1.1.0

# Upgrade with new values
helm upgrade scmc-backend ./helm/scmc-backend \
  -f values-production-updated.yaml
```

### Update Secrets

```bash
# If using external secrets (Option 1):
kubectl delete secret scmc-backend-secrets
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='new-url' \
  --from-literal=JWT_SECRET='new-secret'
kubectl rollout restart deployment/scmc-backend

# If using Helm-managed secrets (Option 2):
helm upgrade scmc-backend ./helm/scmc-backend \
  -f values-production.yaml \
  --set secrets.data.DATABASE_URL='new-url'
```

### Rollback

```bash
# List releases
helm history scmc-backend

# Rollback to previous version
helm rollback scmc-backend

# Rollback to specific revision
helm rollback scmc-backend 3
```

### View Current Configuration

```bash
# View all values (including defaults)
helm get values scmc-backend --all

# View only user-supplied values
helm get values scmc-backend

# View manifest
helm get manifest scmc-backend
```

### Debug Installation

```bash
# Dry run to see what would be created
helm install scmc-backend ./helm/scmc-backend \
  -f values-production.yaml \
  --dry-run --debug

# Template locally without installing
helm template scmc-backend ./helm/scmc-backend \
  -f values-production.yaml
```

### Uninstall

```bash
# Uninstall release
helm uninstall scmc-backend

# If you created secrets externally, delete them too
kubectl delete secret scmc-backend-secrets
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Deploy to GKE
  run: |
    helm upgrade --install scmc-backend ./helm/scmc-backend \
      --namespace production \
      --create-namespace \
      --set image.tag=${{ github.sha }} \
      --set secrets.create=true \
      --set secrets.data.DATABASE_URL="${{ secrets.DATABASE_URL }}" \
      --set secrets.data.JWT_SECRET="${{ secrets.JWT_SECRET }}" \
      --wait \
      --timeout 5m
```

### GitLab CI Example

```yaml
deploy:
  script:
    - helm upgrade --install scmc-backend ./helm/scmc-backend
        --namespace production
        --set image.tag=${CI_COMMIT_SHA}
        --set secrets.create=true
        --set secrets.data.DATABASE_URL="${DATABASE_URL}"
        --set secrets.data.JWT_SECRET="${JWT_SECRET}"
```

## Best Practices

1. **Never commit secrets to git**
   - Use `.gitignore` for values files with secrets
   - Use external secret management for production

2. **Use specific image tags in production**
   - Don't use `latest` tag
   - Use commit SHAs or semantic versions

3. **Set resource limits**
   - Always define CPU and memory limits
   - Monitor and adjust based on actual usage

4. **Enable autoscaling**
   - Use HPA for production workloads
   - Set appropriate min/max replicas

5. **Use namespaces**
   - Separate environments (dev, staging, prod)
   - Use different namespaces for isolation

6. **Test before deploying**
   - Use `--dry-run` to validate
   - Test in staging environment first
