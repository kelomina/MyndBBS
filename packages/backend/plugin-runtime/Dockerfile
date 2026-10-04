FROM node:22-alpine
WORKDIR /app
COPY scripts/plugin-gateway.mjs scripts/plugin-host.mjs scripts/plugin-v2.mjs scripts/plugin-runtime.mjs ./
ENV NODE_ENV=production
ENV PLUGIN_ROOT=/plugins
ENV PORT=3500
# Supervisor creates per-plugin candidates on the isolated internal runtime net.
# Never bake keys, shared control tokens, or application .env into this image.
USER node
EXPOSE 3500
CMD ["node", "/app/plugin-gateway.mjs"]
