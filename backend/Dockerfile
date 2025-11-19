# Multi-stage build for NestJS backend

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (needed for building)
# @prisma/client postinstall will auto-generate the client
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files and Prisma schema
COPY package*.json ./
COPY --from=builder /app/prisma ./prisma

# Install production dependencies + ts-node for CLI scripts
RUN npm install --omit=dev --legacy-peer-deps && \
    npm install ts-node typescript @types/node --legacy-peer-deps && \
    npm cache clean --force

# Generate Prisma Client (must be after npm install)
# Increase Node memory limit for Prisma generation
RUN NODE_OPTIONS="--max-old-space-size=2048" npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy source files (needed for CLI tools using ts-node)
COPY --from=builder /app/src ./src

# Copy tsconfig for CLI tools
COPY tsconfig*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Set Node.js memory limit for CLI and runtime
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-8080}/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main"]
