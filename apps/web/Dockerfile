FROM node:24
RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN yarn install

ARG NEXT_PUBLIC_API_URL=http://mini.local:10000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn workspace @hestia/web build

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["../../node_modules/.bin/next", "start", "--port", "3000"]
