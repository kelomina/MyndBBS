FROM node:22-alpine

WORKDIR /app
COPY scripts/plugin-gateway.mjs ./plugin-gateway.mjs

ENV NODE_ENV=production
ENV PLUGIN_ROOT=/plugins
ENV PORT=3500

USER node
EXPOSE 3500
CMD ["node", "/app/plugin-gateway.mjs"]
