# 🛠️ Gunakan image node versi full alpine atau standard untuk kompensasi native bindings
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
# Bersihkan cache dan pasang ulang dengan bersih
RUN npm cache clean --force
RUN npm install

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_MAPBOX_TOKEN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN npm run build

# 🚀 Tahap 2: Sajikan dengan Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]