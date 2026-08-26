import express from "express";
import next from "next";
import path from "path";
import { app as expressApp } from "../api/src/app";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

// Next.js must run from apps/web directory where .next/ is built
const webDir = path.resolve(process.cwd(), "apps/web");
const app = next({ dev, dir: webDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Forward all /api/* to the Express API app
  server.all("/api/*", (req, res, next) => {
    expressApp(req, res, next);
  });

  // Health check endpoint
  server.get("/health", (req, res, next) => {
    expressApp(req, res, next);
  });

  // Everything else goes to Next.js
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`> NetMaster ready on http://0.0.0.0:${port}`);
    console.log(`> API routes at http://0.0.0.0:${port}/api/v1/*`);
  });
});
