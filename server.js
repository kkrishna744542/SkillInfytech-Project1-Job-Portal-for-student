import "dotenv/config";

import path from "path";
import express from "express";
import session from "express-session";
import expressLayouts from "express-ejs-layouts";
import { initializeDatabase } from "./config/db.js";
import pagesRouter from "./routes/pages.js";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const SQLiteStore = require("connect-sqlite3")(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: __dirname,
    }),
    secret: process.env.SESSION_SECRET || "skillinfytech-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use(pagesRouter);

app.use((error, req, res, next) => {
  console.error(error);
  req.session.flash = {
    type: "error",
    message: error.message || "Something went wrong.",
  };
  res.redirect(req.get("referer") || "/");
});

async function startServer() {
  await initializeDatabase();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Skillinfytech Job Portal running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});