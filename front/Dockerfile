# Imagen del front para QA y produccion. Dev sigue corriendo con Vite directo
# (ver AGENTS.md), este Dockerfile no se usa ahi.
#
# VITE_API_URL es relativa ("/api/v1") en los dos entornos: Nginx, en el
# servidor, es quien decide a que backend mandar /api segun el subdominio.
# Por eso esta misma imagen sirve igual para qa y para main.

# Etapa 1: compila el front
FROM node:22-alpine AS build

WORKDIR /app

# El .env del repo NO entra al build (esta en .dockerignore), asi que la
# variable se define aqui o el bundle sale sin ella: axios quedaria con
# baseURL undefined y llamaria a /auth/me en vez de /api/v1/auth/me. Nginx
# devolveria el index.html con 200 y el front reventaria leyendo HTML como
# si fuera JSON. Vite da prioridad a las variables que ya existen en el
# entorno por encima de los archivos .env, asi que este es el valor que queda
# compilado.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: solo sirve los archivos ya compilados
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
