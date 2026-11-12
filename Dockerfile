# Этап 1: сборка TypeScript в JavaScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Этап 2: маленький образ только с тем, что нужно для запуска
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY data ./data
USER node
CMD ["node", "dist/main.js"]
