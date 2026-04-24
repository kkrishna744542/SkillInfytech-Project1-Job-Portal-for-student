import path from "path";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "skillinfytech-portal.db");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'recruiter', 'candidate')),
      phone TEXT,
      skills TEXT,
      profile_photo TEXT,
      reset_token TEXT,
      reset_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      location TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      salary_range TEXT,
      description TEXT NOT NULL,
      requirements TEXT NOT NULL,
      posted_by INTEGER NOT NULL,
      is_open BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (posted_by) REFERENCES users(id)
    )
  `);

  // Add is_open column if it doesn't exist
  try {
    await run(`ALTER TABLE jobs ADD COLUMN is_open BOOLEAN DEFAULT 1`);
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  // Add reset_token and reset_token_expires columns if they don't exist
  try {
    await run(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
  } catch (error) {
    if (!error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  try {
    await run(`ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`);
  } catch (error) {
    if (!error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  await run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      cover_letter TEXT,
      resume_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(job_id, candidate_id),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES users(id)
    )
  `);

  const existingAdmin = await get(
    "SELECT id FROM users WHERE email = ?",
    ["admin@skillinfytech.com"]
  );

  if (!existingAdmin) {
    const adminPassword = await bcrypt.hash("Admin@123", 10);
    const recruiterPassword = await bcrypt.hash("Recruiter@123", 10);
    const candidatePassword = await bcrypt.hash("Student@123", 10);

    await run(
      `
        INSERT INTO users (full_name, email, password_hash, role, phone, skills)
        VALUES
          (?, ?, ?, 'admin', ?, ?),
          (?, ?, ?, 'recruiter', ?, ?),
          (?, ?, ?, 'candidate', ?, ?)
      `,
      [
        "Skillinfytech Admin",
        "admin@skillinfytech.com",
        adminPassword,
        "+91 9000000001",
        "Portal management",
        "Skillinfytech Recruiter",
        "recruiter@skillinfytech.com",
        recruiterPassword,
        "+91 9000000002",
        "Hiring, sourcing, communication",
        "Demo Student",
        "student@skillinfytech.com",
        candidatePassword,
        "+91 9000000003",
        "JavaScript, Node.js, SQL",
      ]
    );
  }

  const existingJob = await get("SELECT id FROM jobs LIMIT 1");

  if (!existingJob) {
    const recruiter = await get(
      "SELECT id FROM users WHERE email = ?",
      ["recruiter@skillinfytech.com"]
    );

    await run(
      `
        INSERT INTO jobs
          (title, company_name, location, employment_type, salary_range, description, requirements, posted_by)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "Frontend Developer Intern",
        "Skillinfytech",
        "Remote",
        "Internship",
        "Rs. 15,000 - Rs. 25,000 / month",
        "Build responsive UI screens, collaborate with mentors, and ship features for student products.",
        "HTML, CSS, JavaScript, React basics, communication skills.",
        recruiter.id,
        "Full Stack Developer",
        "Skillinfytech",
        "Hyderabad",
        "Full Time",
        "Rs. 4,00,000 - Rs. 6,00,000 / year",
        "Work across APIs, databases, and frontend dashboards for hiring products.",
        "Node.js, Express, SQL, REST APIs, problem solving.",
        recruiter.id,
      ]
    );
  }
}

export { run, get, all, initializeDatabase };