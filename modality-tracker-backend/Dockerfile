###############################
#  Stage 1 – build container  #
###############################
FROM node:20-alpine AS build
WORKDIR /app

# 1️⃣  install **all** dependencies (prod + dev)
COPY package*.json ./
RUN npm ci

# 2️⃣  copy Prisma schema and generate the client
COPY prisma ./prisma
RUN npx prisma generate           # ➜ creates node_modules/@prisma

# 3️⃣  copy the source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build                 # tsc -p tsconfig.json

###############################
#  Stage 2 – runtime image    #
###############################
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 4️⃣  install **production-only** dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# 5️⃣  copy compiled output, prisma bits, and binaries
COPY --from=build /app/dist   ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3002
CMD ["node", "dist/index.js"]