# --- TradeDesk frontend (React build served by nginx) ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# "/api" is proxied to the backend by nginx (see nginx.conf), so the default
# VITE_API_BASE of "/api" is correct for the container.
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
