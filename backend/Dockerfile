# =============================================================================
# Build Stage
# =============================================================================
FROM node:20 AS builder

WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Copy package files and TS config
COPY package*.json tsconfig.json ./

# Install all dependencies
RUN npm install && npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20 AS runner

ENV NODE_ENV=production

WORKDIR /app

# Install dumb-init
RUN apt-get update && apt-get install -y dumb-init \
 && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy locale files
COPY --from=builder /app/src/locales ./dist/locales

# Copy healthcheck script
COPY healthcheck.js ./
RUN chmod +x healthcheck.js

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
