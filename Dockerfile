# FSP WhatsApp Assistant — production image for Railway.
#
# node:sqlite is a Node builtin, so there is nothing to compile and no native
# module to match against the base image.
#
# Two stages only. Installing inside the builder avoids copying node_modules
# between stages — that copy is the single largest layer in a Next.js build
# and the first thing to fail on a host that is short of disk.

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json next.config.mjs ./
COPY src ./src

# Real secrets come from Railway's environment at runtime. SESSION_SECRET is
# read lazily on first use, so nothing is baked into the image.
RUN npm run build \
 && npm prune --omit=dev \
 && rm -rf /root/.npm /app/.next/cache

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/fsp.db

# Runs as root so the Railway volume mounted at /data is always writable.
RUN mkdir -p /data

# The standalone output carries its own minimal node_modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Keeps `node scripts/setup-evolution.mjs` usable from the Railway shell.
COPY scripts ./scripts

EXPOSE 3000

# Railway injects PORT; the standalone server honours PORT and HOSTNAME.
CMD ["node", "server.js"]
