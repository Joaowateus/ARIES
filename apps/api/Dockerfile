FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Compile seed separately
RUN npx tsc --project tsconfig.seed.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 3001
# On startup: run migrations, seed (idempotent), then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-seed/prisma/seed.js && node dist/index.js"]
