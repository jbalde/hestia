FROM node:20-alpine
RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN yarn install --immutable

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn workspace @hestia/web build

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["../../node_modules/.bin/next", "start", "--port", "3000"]
