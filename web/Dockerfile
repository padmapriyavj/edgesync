FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

COPY . .

ARG VITE_ORIGIN_URL=http://localhost:4000
ARG VITE_EDGE_US_URL=http://localhost:5001
ARG VITE_EDGE_EU_URL=http://localhost:5002
ARG VITE_EDGE_AP_URL=http://localhost:5003

ENV VITE_ORIGIN_URL=$VITE_ORIGIN_URL
ENV VITE_EDGE_US_URL=$VITE_EDGE_US_URL
ENV VITE_EDGE_EU_URL=$VITE_EDGE_EU_URL
ENV VITE_EDGE_AP_URL=$VITE_EDGE_AP_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
