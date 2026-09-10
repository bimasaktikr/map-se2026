FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./

# 🌟 Gunakan 'npm install' bersih agar optional dependencies ikut terpasang sempurna
RUN npm install --no-audit --progress=false

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_MAPBOX_TOKEN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]