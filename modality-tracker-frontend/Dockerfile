FROM node:20-alpine AS build
WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build       # `next build` or `vite build` etc.

# ── runtime ──
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["npm", "start"]    # `next start`