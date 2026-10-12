FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_CF_FETCH_ENABLED=false

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

RUN chown node:node /app \
    && mkdir -p /app/.wrangler/state /app/.sites-runtime/wrangler/logs \
      /app/.sites-runtime/wrangler/dev-registry /app/.sites-runtime/wrangler/registry \
    && chown -R node:node /app/.wrangler /app/.sites-runtime

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}`).then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"]

CMD ["node", "scripts/start.mjs"]
