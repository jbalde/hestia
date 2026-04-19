FROM node:24
RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN yarn install
RUN yarn workspace @hestia/api build

ENV NODE_ENV=production
EXPOSE 9999
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
