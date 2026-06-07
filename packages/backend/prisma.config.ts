import { defineConfig } from "prisma/config";

// DATABASE_URL is provided by Docker environment in production, or .env in development.
// Note: dotenv is NOT imported here because it is a devDependency and not available in production.
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://dummy:5432/dummy",
  },
});
