FROM node:22-alpine
RUN apk add --no-cache docker-cli tar
WORKDIR /app
COPY scripts/plugin-control.mjs scripts/plugin-v2.mjs scripts/plugin-archive.mjs ./
ENV NODE_ENV=production
ENV PLUGIN_ROOT=/opt/myndbbs/plugins
ENV PLUGIN_DOCKER_ROOT=/opt/myndbbs/plugins
ENV PORT=3600
# Only this trusted supervisor receives the Docker socket and runtime master secret.
USER root
EXPOSE 3600
CMD ["node", "/app/plugin-control.mjs"]
