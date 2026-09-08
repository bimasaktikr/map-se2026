# Tahap 1: Build React
FROM node:20-alpine as build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Tahap 2: Gunakan Nginx untuk menjalankan web super ringan
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]