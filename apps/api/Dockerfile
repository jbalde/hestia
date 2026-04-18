FROM node:20-alpine
RUN apk add --no-cache python3 make g++
RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN yarn install --immutable
RUN yarn workspace @hestia/api build

ENV NODE_ENV=production
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
