import express from "express";
import next from "next";
import { app as expressApp, config } from "../api/src/app";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Forward all /api/* and /health to the Express API app
  // The API app already has CORS, JSON parsing, all routes, error handlers
  server.all("/api/*", (req, res, next) => {
    expressApp(req, res, next);
  });

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
