# Skillinfytech Job Portal

A student job portal built with Node.js, Express, EJS, and SQLite. This project supports role-based access for Admins, Recruiters, and Candidates, with profile management, job posting, resume upload, application tracking, and email notifications.

## Key Features

- Role-based authentication and authorization
- Candidate registration, login, and profile management
- Recruiter/Admin job posting and job management
- Resume upload for job applications
- Application tracking for candidates and recruiters
- Email notifications for registration, application submission, login alerts, password reset, and application status updates
- SQLite persistence with seeded demo users and jobs
- Session management using SQLite session store

## Roles

- `admin`: manage users, jobs, and applications
- `recruiter`: post jobs and review applicants
- `candidate`: browse jobs, apply with resume, and update profile

## Tech Stack

- Node.js
- Express
- EJS templates
- SQLite
- `express-session` + `connect-sqlite3`
- `multer` for file uploads
- `nodemailer` for email delivery
- `bcryptjs` for password hashing

## Project Structure

- `server.js` - application entrypoint and server setup
- `config/db.js` - SQLite database initialization and helpers
- `routes/pages.js` - main application routes
- `middleware/auth.js` - authentication and role middleware
- `middleware/upload.js` - file upload configuration
- `services/email.js` - email notification utilities
- `views/` - EJS templates
- `public/` - static assets
- `uploads/` - stored profile images and resumes

## Database and Storage

- Application data is stored in `skillinfytech-portal.db`
- Session data is stored in `sessions.db`
- Uploaded profile photos are saved in `uploads/profiles/`
- Uploaded resumes are saved in `uploads/resumes/`

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root and add the following variables:

```env
PORT=3000
SESSION_SECRET=your-secret-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email-user
SMTP_PASS=your-email-password
MAIL_FROM="Skillinfytech <noreply@example.com>"
BASE_URL=http://localhost:3000
```

> If email configuration is not set up, the app will still run, but email-dependent features may fail until valid SMTP settings are provided.

## Run the App

```bash
node server.js
```

Open the browser at:

```bash
http://localhost:3000
```

## Demo Credentials

- Admin: `admin@skillinfytech.com` / `Admin@123`
- Recruiter: `recruiter@skillinfytech.com` / `Recruiter@123`
- Candidate: `student@skillinfytech.com` / `Student@123`

## Notes

- The database tables are created automatically on startup.
- Seed data is inserted only once when the app initializes.
- Resume and profile photo uploads are stored locally in the `uploads/` folder.
- If SMTP settings are invalid, update `.env` with valid email credentials.
