import dotenv from "dotenv";
import path from "path";

// Load env vars — try multiple paths since CWD varies in monorepo setups.
// Turbo runs API from apps/api/, so also check the monorepo root.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });

import { app, config } from "./app";

app.listen(config.port, () => {
  console.log(`NetMaster API listening on http://localhost:${config.port}`);
});
