# SCMC Backend Helm Chart

Helm chart for deploying the SCMC Workshop Management System backend to Google Kubernetes Engine (GKE).

## Quick Start

### Development (Local/Minikube)

```bash
# Install with development values (includes secrets)
helm install scmc-backend ./helm/scmc-backend -f ./helm/scmc-backend/values-dev.yaml

# Access via port-forward
kubectl port-forward svc/scmc-backend 8080:80

# Test
curl http://localhost:8080/api/health
```

### Production (GKE)

```bash
# 1. Create secrets externally
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/scmc_sms' \
  --from-literal=JWT_SECRET='your-secure-jwt-secret'

# 2. Copy and customize production values
cp ./helm/scmc-backend/values-production.example.yaml values-production.yaml
# Edit values-production.yaml with your domain and settings

# 3. Install
helm install scmc-backend ./helm/scmc-backend -f values-production.yaml
```

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- GKE cluster with Workload Identity enabled (optional but recommended)
- PostgreSQL database (Cloud SQL or external)

## Installation

### 1. Secrets Management

The chart supports two ways to manage secrets:

#### Option A: Helm-Managed Secrets (Recommended for Development)

Secrets are created by Helm using values files or `--set` flags:

```bash
# Using a values file (see values-dev.yaml)
helm install scmc-backend ./helm/scmc-backend -f values-dev.yaml

# Or using --set flags
helm install scmc-backend ./helm/scmc-backend \
  --set secrets.create=true \
  --set secrets.data.DATABASE_URL='postgresql://user:pass@host:5432/scmc_sms' \
  --set secrets.data.JWT_SECRET='your-jwt-secret'
```

#### Option B: External Secret Management (Recommended for Production)

Create secrets separately before installing the chart:

```bash
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='postgresql://user:password@host:5432/scmc_sms' \
  --from-literal=JWT_SECRET='your-secure-random-jwt-secret-here'
```

Then install with `secrets.create=false` (the default):

```bash
helm install scmc-backend ./helm/scmc-backend -f values-production.yaml
```

**Note**: The secret keys must be in uppercase (e.g., `DATABASE_URL`, `JWT_SECRET`) as they will be directly mapped to environment variables in the container via `envFrom`.

### 2. Reserve Static IP (for Ingress)

```bash
gcloud compute addresses create scmc-backend-ip \
  --global \
  --ip-version=IPV4 \
  --project=your-project-id

# Get the IP address
gcloud compute addresses describe scmc-backend-ip --global
```

### 3. Update DNS

Point your domain to the reserved static IP address.

### 4. Configure Values

Create a `values-production.yaml` file with your custom values:

```yaml
image:
  tag: "v1.0.0"  # Use specific version tag in production

ingress:
  hosts:
    - host: api.yourdomain.com
      paths:
        - path: /*
          pathType: ImplementationSpecific

managedCertificate:
  domains:
    - api.yourdomain.com

app:
  corsOrigin: "https://yourdomain.com"

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  minReplicas: 3
  maxReplicas: 20
```

### 5. Install the Chart

```bash
# Install with default values
helm install scmc-backend ./helm/scmc-backend

# Install with custom values
helm install scmc-backend ./helm/scmc-backend \
  -f values-production.yaml \
  --namespace scmc \
  --create-namespace
```

## Upgrading

```bash
# Upgrade with new image tag
helm upgrade scmc-backend ./helm/scmc-backend \
  --set image.tag=v1.1.0 \
  -f values-production.yaml

# Upgrade with new values file
helm upgrade scmc-backend ./helm/scmc-backend \
  -f values-production.yaml
```

## Uninstalling

```bash
helm uninstall scmc-backend
```

## Configuration

The following table lists the configurable parameters of the SCMC Backend chart and their default values.

### Image Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.registry` | Container image registry | `asia-southeast1-docker.pkg.dev` |
| `image.repository` | Container image repository | `truestack/scmc/scmc-backend` |
| `image.tag` | Container image tag | `latest` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |

### Deployment Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas (ignored if autoscaling enabled) | `2` |
| `resources.limits.cpu` | CPU limit | `500m` |
| `resources.limits.memory` | Memory limit | `512Mi` |
| `resources.requests.cpu` | CPU request | `250m` |
| `resources.requests.memory` | Memory request | `256Mi` |

### Service Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `service.targetPort` | Container port | `3000` |

### Ingress Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class | `gce` |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |

### Autoscaling Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `autoscaling.enabled` | Enable HPA | `true` |
| `autoscaling.minReplicas` | Minimum replicas | `2` |
| `autoscaling.maxReplicas` | Maximum replicas | `10` |
| `autoscaling.targetCPUUtilizationPercentage` | Target CPU % | `70` |
| `autoscaling.targetMemoryUtilizationPercentage` | Target memory % | `80` |

### Application Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.port` | Application port | `3000` |
| `app.nodeEnv` | Node environment | `production` |
| `app.jwtExpiration` | JWT token expiration | `7d` |
| `app.corsOrigin` | CORS origin | `*` |

### Secrets Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `secrets.name` | Secret name | `scmc-backend-secrets` |
| `secrets.databaseUrlKey` | Database URL key in secret | `database-url` |
| `secrets.jwtSecretKey` | JWT secret key in secret | `jwt-secret` |

## Examples

### Development Environment

```bash
helm install scmc-backend ./helm/scmc-backend \
  --set image.tag=dev \
  --set replicaCount=1 \
  --set autoscaling.enabled=false \
  --set ingress.enabled=false
```

### Production Environment

```bash
helm install scmc-backend ./helm/scmc-backend \
  --set image.tag=v1.0.0 \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=20 \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=1Gi \
  -f values-production.yaml
```

### Using with Cloud SQL

```bash
# Create secret with Cloud SQL connection (note uppercase keys for envFrom)
kubectl create secret generic scmc-backend-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@/scmc_sms?host=/cloudsql/project:region:instance' \
  --from-literal=JWT_SECRET='your-jwt-secret'

# Install with Cloud SQL proxy sidecar (if needed)
# Update deployment.yaml to include Cloud SQL proxy container
```

## Monitoring

### Check Deployment Status

```bash
helm status scmc-backend
kubectl get all -l app.kubernetes.io/instance=scmc-backend
```

### View Logs

```bash
kubectl logs -l app.kubernetes.io/name=scmc-backend -f
```

### Check HPA Status

```bash
kubectl get hpa
kubectl describe hpa scmc-backend
```

### Check Ingress Status

```bash
kubectl get ingress
kubectl describe ingress scmc-backend
```

### Check Certificate Status

```bash
kubectl describe managedcertificate scmc-backend-cert
```

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod -l app.kubernetes.io/name=scmc-backend
kubectl logs -l app.kubernetes.io/name=scmc-backend
```

### Database connection errors

```bash
# Verify secret exists and is correct
kubectl get secret scmc-backend-secrets

# Check DATABASE_URL (note uppercase key name for envFrom)
kubectl get secret scmc-backend-secrets -o jsonpath='{.data.DATABASE_URL}' | base64 --decode

# List all keys in the secret
kubectl get secret scmc-backend-secrets -o jsonpath='{.data}' | jq 'keys'
```

### Ingress not working

```bash
# Check ingress status
kubectl describe ingress scmc-backend

# Check events
kubectl get events --sort-by='.metadata.creationTimestamp'

# Verify static IP
gcloud compute addresses describe scmc-backend-ip --global
```

### Certificate not provisioning

Google Managed Certificates can take 10-15 minutes to provision. Ensure:
- DNS is pointing to the Load Balancer IP
- The domain is correctly configured in the ManagedCertificate resource

```bash
kubectl describe managedcertificate scmc-backend-cert
```

## Support

For issues and questions, please check the main project documentation or create an issue in the repository.
