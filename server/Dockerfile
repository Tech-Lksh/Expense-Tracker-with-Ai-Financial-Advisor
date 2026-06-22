# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init

# ---------- Dependencies (cached layer) ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- Production image ----------
FROM base AS production
ENV NODE_ENV=production

# Run as a non-root user — never run a production Node process as root.
RUN addgroup -S nodejs && adduser -S expressapp -G nodejs

COPY --chown=expressapp:nodejs --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=expressapp:nodejs package.json ./
COPY --chown=expressapp:nodejs src ./src
COPY --chown=expressapp:nodejs docs ./docs

RUN mkdir -p logs && chown expressapp:nodejs logs

USER expressapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# dumb-init ensures SIGTERM is forwarded correctly so server.js's graceful
# shutdown handler actually runs (PID 1 otherwise swallows signals).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
