FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm install -g bun
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --filter web build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/shared ./packages/shared

EXPOSE 3000

CMD ["bun", "run", "--filter", "web", "start"]
