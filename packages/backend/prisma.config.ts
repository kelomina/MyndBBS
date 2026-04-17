import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://dummy:5432/dummy",
  },
});
