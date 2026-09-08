# 🛠️ Tahap 1: Build kode Vite/React
FROM node:18-alpine as build
WORKDIR /app

# Copy daftar dependency dan install
COPY package*.json ./
RUN npm install

# Copy seluruh kode
COPY . .

# 🌟 TANGKAP VARIABEL DARI DOCKER COMPOSE AGAR TERBACA OLEH VITE
ARG VITE_API_BASE_URL
ARG VITE_MAPBOX_TOKEN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

# Bangun aplikasi menjadi file statis HTML/JS
RUN npm run build

# 🚀 Tahap 2: Sajikan dengan Web Server Nginx
FROM nginx:alpine
# Suntikkan konfigurasi Nginx khusus SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Pindahkan hasil build dari Tahap 1 ke folder Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]