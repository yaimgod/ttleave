# ─────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat is required.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────
# Stage 2: Build the Next.js application
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars must be baked into the client bundle at build time.
# Two ways they can arrive:
#   1. Local / CI:   --build-arg NEXT_PUBLIC_SUPABASE_URL=https://...
#   2. Coolify:      --mount=type=secret,id=NEXT_PUBLIC_SUPABASE_URL,env=NEXT_PUBLIC_SUPABASE_URL
#                    (available as shell env inside RUN, but NOT via ARG)
# Declaring ARG picks up --build-arg; the RUN shell already has the secret-mount
# vars. Either way, they end up in the shell env when `next build` runs.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_TELEMETRY_DISABLED=1
# GitHub Actions runners have 4 CPUs + 16GB RAM — no need to cap parallelism.
# For local builds on low-RAM machines, pass: --build-arg SINGLE_THREADED=1
ARG SINGLE_THREADED
ENV WEBPACK_SINGLE_THREADED=${SINGLE_THREADED}
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3: Production runner
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only what's needed for standalone output
COPY --from=builder /app/public ./public

# Set correct permissions for prerendered cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
CMD ["node", "server.js"]
