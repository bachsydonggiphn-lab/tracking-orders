// Root entry point for cloud deployment runners (Render / Heroku)
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

require(path.join(__dirname, "dist", "server.cjs"));
