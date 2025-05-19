# ───────── Stage 1: build  ─────────
FROM node:20-alpine AS build
WORKDIR /app

# ① copy manifests & install *all* deps (incl. dev) to compile TypeScript
COPY package*.json tsconfig.json ./
RUN npm ci

# ② copy source, run tsc → dist/
COPY src ./src
RUN npm run build         # generates dist/index.js

# ───────── Stage 2: runtime  ─────────
FROM node:20-alpine
WORKDIR /app

# ③ only copy production deps to keep the image tiny
COPY package*.json ./
RUN npm ci --omit=dev      # ← this drops ts-node-dev, @types/*, …

# ④ copy compiled output & Prisma artifacts
COPY --from=build /app/dist        ./dist
COPY prisma ./prisma
RUN npx prisma generate            # Prisma client for runtime

# ⑤ expose and start
ENV PORT=3002
EXPOSE 3002
CMD ["node", "dist/index.js"]