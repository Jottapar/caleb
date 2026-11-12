# Imagen del front para QA y produccion. Dev sigue corriendo con Vite directo
# (ver AGENTS.md), este Dockerfile no se usa ahi.
#
# VITE_API_URL es relativa ("/api/v1") en los dos entornos: Nginx, en el
# servidor, es quien decide a que backend mandar /api segun el subdominio.
# Por eso esta misma imagen sirve igual para qa y para main.

# Etapa 1: compila el front
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: solo sirve los archivos ya compilados
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
