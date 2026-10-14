FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS api
COPY server ./server
COPY package.json ./
EXPOSE 8787
CMD ["npm", "run", "api:production"]

FROM dependencies AS frontend-build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS web
COPY nginx.production.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O - http://127.0.0.1/ || exit 1
