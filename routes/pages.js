import express from "express";
import bcrypt from "bcryptjs";
import { all, get, run } from "../config/db.js";
import { ensureAuthenticated, ensureRole } from "../middleware/auth.js";
import { imageUpload, resumeUpload } from "../middleware/upload.js";
import { sendRegistrationConfirmationEmail, sendApplicationConfirmationEmail, sendApplicationStatusUpdateEmail, sendLoginNotificationEmail, sendPasswordResetEmail } from "../services/email.js";

const router = express.Router();

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

router.get("/", async (req, res) => {
  const jobs = await all(
    `
      SELECT jobs.*, users.full_name AS recruiter_name
      FROM jobs
      JOIN users ON users.id = jobs.posted_by
      ORDER BY jobs.created_at DESC
      LIMIT 6
    `
  );

  res.render("home", { jobs, title: "Skillinfytech Job Portal" });
});

router.get("/register", (req, res) => {
  res.render("register", { title: "Register" });
});

router.post(
  "/register",
  imageUpload.single("profilePhoto"),
  async (req, res, next) => {
    try {
      const { fullName, email, password, phone, skills } = req.body;
      const existingUser = await get("SELECT id FROM users WHERE email = ?", [email]);

      if (existingUser) {
        setFlash(req, "error", "An account already exists with that email.");
        res.redirect("/register");
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await run(
        `
          INSERT INTO users (full_name, email, password_hash, role, phone, skills, profile_photo)
          VALUES (?, ?, ?, 'candidate', ?, ?, ?)
        `,
        [
          fullName,
          email,
          passwordHash,
          phone,
          skills,
          req.file ? `/uploads/profiles/${req.file.filename}` : null,
        ]
      );

      await sendRegistrationConfirmationEmail(email, fullName);

      setFlash(req, "success", "Registration successful! A confirmation email has been sent. Please log in.");
      res.redirect("/login");
    } catch (error) {
      next(error);
    }
  }
);

router.get("/login", (req, res) => {
  res.render("login", { title: "Login" });
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      setFlash(req, "error", "Invalid email or password.");
      res.redirect("/login");
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      setFlash(req, "error", "Invalid email or password.");
      res.redirect("/login");
      return;
    }

    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      profilePhoto: user.profile_photo,
    };

    setFlash(req, "success", `Welcome back, ${user.full_name}.`);
    res.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

router.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { title: "Forgot Password" });
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      setFlash(req, "error", "No account found with that email address.");
      res.redirect("/forgot-password");
      return;
    }

    // Generate reset token
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    await run(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [resetToken, resetTokenExpires.toISOString(), user.id]
    );

    // Send reset email
    await sendPasswordResetEmail(user.email, user.full_name, resetToken);

    setFlash(req, "success", "Password reset link has been sent to your email.");
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
});

router.get("/reset-password/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await get(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?",
      [token, new Date().toISOString()]
    );

    if (!user) {
      setFlash(req, "error", "Invalid or expired reset token.");
      res.redirect("/login");
      return;
    }

    res.render("reset-password", { token, title: "Reset Password" });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      setFlash(req, "error", "Passwords do not match.");
      res.redirect(`/reset-password/${token}`);
      return;
    }

    if (password.length < 6) {
      setFlash(req, "error", "Password must be at least 6 characters long.");
      res.redirect(`/reset-password/${token}`);
      return;
    }

    const user = await get(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?",
      [token, new Date().toISOString()]
    );

    if (!user) {
      setFlash(req, "error", "Invalid or expired reset token.");
      res.redirect("/login");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await run(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [passwordHash, user.id]
    );

    setFlash(req, "success", "Password has been reset successfully. Please log in with your new password.");
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
});

router.get("/profile", ensureAuthenticated, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
  res.render("profile-update", { user, title: "Update Profile" });
});

router.post(
  "/profile",
  ensureAuthenticated,
  imageUpload.single("profilePhoto"),
  async (req, res, next) => {
    try {
      const { phone, skills } = req.body;
      const updates = [];
      const params = [];

      if (phone) {
        updates.push("phone = ?");
        params.push(phone);
      }

      if (skills) {
        updates.push("skills = ?");
        params.push(skills);
      }

      if (req.file) {
        updates.push("profile_photo = ?");
        params.push(`/uploads/profiles/${req.file.filename}`);
      }

      if (updates.length === 0) {
        setFlash(req, "error", "No changes to update.");
        res.redirect("/profile");
        return;
      }

      params.push(req.session.user.id);
      const updateQuery = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
      await run(updateQuery, params);

      const updatedUser = await get("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
      req.session.user.phone = updatedUser.phone;
      req.session.user.skills = updatedUser.skills;
      if (req.file) {
        req.session.user.profilePhoto = updatedUser.profile_photo;
      }

      setFlash(req, "success", "Profile updated successfully!");
      res.redirect("/profile");
    } catch (error) {
      next(error);
    }
  }
);

router.get("/jobs", async (req, res) => {
  const jobs = await all(
    `
      SELECT jobs.*, users.full_name AS recruiter_name
      FROM jobs
      JOIN users ON users.id = jobs.posted_by
      WHERE jobs.is_open = 1
      ORDER BY jobs.created_at DESC
    `
  );

  res.render("jobs", { jobs, title: "Browse Jobs" });
});

router.get("/jobs/new", ensureRole("admin", "recruiter"), (req, res) => {
  res.render("job-form", { title: "Post a Job" });
});

router.post("/jobs/new", ensureRole("admin", "recruiter"), async (req, res, next) => {
  try {
    const {
      title,
      companyName,
      location,
      employmentType,
      salaryRange,
      description,
      requirements,
    } = req.body;
    const isOpen = req.body.isOpen ? 1 : 0;

    await run(
      `
        INSERT INTO jobs
          (title, company_name, location, employment_type, salary_range, description, requirements, posted_by, is_open)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        title,
        companyName,
        location,
        employmentType,
        salaryRange,
        description,
        requirements,
        req.session.user.id,
        isOpen,
      ]
    );

    setFlash(req, "success", "Job details uploaded successfully.");
    res.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});

router.get("/jobs/:id", async (req, res) => {
  const job = await get(
    `
      SELECT jobs.*, users.full_name AS recruiter_name
      FROM jobs
      JOIN users ON users.id = jobs.posted_by
      WHERE jobs.id = ? AND jobs.is_open = 1
    `,
    [req.params.id]
  );

  if (!job) {
    setFlash(req, "error", "Job not found or applications closed.");
    res.redirect("/jobs");
    return;
  }

  let hasApplied = false;

  if (req.session.user?.role === "candidate") {
    const application = await get(
      "SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?",
      [req.params.id, req.session.user.id]
    );
    hasApplied = Boolean(application);
  }

  res.render("job-details", { job, hasApplied, title: job.title });
});

router.post(
  "/jobs/:id/apply",
  ensureRole("candidate"),
  resumeUpload.single("resume"),
  async (req, res, next) => {
    try {
      const job = await get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);

      if (!job) {
        setFlash(req, "error", "Job not found.");
        res.redirect("/jobs");
        return;
      }

      if (!req.file) {
        setFlash(req, "error", "Please upload your resume before applying.");
        res.redirect(`/jobs/${req.params.id}`);
        return;
      }

      const existingApplication = await get(
        "SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?",
        [req.params.id, req.session.user.id]
      );

      if (existingApplication) {
        setFlash(req, "error", "You have already applied for this job.");
        res.redirect(`/jobs/${req.params.id}`);
        return;
      }

      await run(
        `
          INSERT INTO applications (job_id, candidate_id, cover_letter, resume_path)
          VALUES (?, ?, ?, ?)
        `,
        [
          req.params.id,
          req.session.user.id,
          req.body.coverLetter,
          `/uploads/resumes/${req.file.filename}`,
        ]
      );

      await sendApplicationConfirmationEmail(
        req.session.user.email,
        req.session.user.fullName,
        job.title
      );

      setFlash(
        req,
        "success",
        "Application submitted successfully! You will receive a confirmation email soon."
      );
      res.redirect("/dashboard");
    } catch (error) {
      next(error);
    }
  }
);

router.get("/dashboard", ensureAuthenticated, async (req, res) => {
  const { role, id } = req.session.user;

  if (role === "candidate") {
    const applications = await all(
      `
        SELECT applications.*, jobs.title, jobs.company_name, jobs.location
        FROM applications
        JOIN jobs ON jobs.id = applications.job_id
        WHERE applications.candidate_id = ?
        ORDER BY applications.created_at DESC
      `,
      [id]
    );

    const recommendedJobs = await all(
      "SELECT * FROM jobs ORDER BY created_at DESC LIMIT 4"
    );

    res.render("dashboard-candidate", {
      applications,
      recommendedJobs,
      title: "Candidate Dashboard",
    });
    return;
  }

  if (role === "recruiter") {
    const recruiterJobs = await all(
      `
        SELECT jobs.*,
          (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.id) AS application_count,
          (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.id AND status = 'pending') AS pending_count,
          (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.id AND status = 'success') AS selected_count,
          (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.id AND status = 'reject') AS rejected_count
        FROM jobs
        WHERE posted_by = ?
        ORDER BY created_at DESC
      `,
      [id]
    );

    const applicants = await all(
      `
        SELECT applications.id, applications.created_at, applications.status, users.full_name, users.email, users.skills, jobs.title
        FROM applications
        JOIN users ON users.id = applications.candidate_id
        JOIN jobs ON jobs.id = applications.job_id
        WHERE jobs.posted_by = ?
        ORDER BY applications.created_at DESC
        LIMIT 8
      `,
      [id]
    );

    res.render("dashboard-recruiter", {
      applicants,
      recruiterJobs,
      title: "Recruiter Dashboard",
    });
    return;
  }

  const users = await all(
    "SELECT id, full_name, email, role, phone, created_at FROM users ORDER BY created_at DESC"
  );
  const jobs = await all(
    `
      SELECT jobs.*, users.full_name AS recruiter_name
      FROM jobs
      JOIN users ON users.id = jobs.posted_by
      ORDER BY jobs.created_at DESC
    `
  );
  const recentApplications = await all(
    `
      SELECT applications.id, applications.created_at, applications.status, users.full_name, users.email, jobs.title
      FROM applications
      JOIN users ON users.id = applications.candidate_id
      JOIN jobs ON jobs.id = applications.job_id
      ORDER BY applications.created_at DESC
      LIMIT 10
    `
  );

  res.render("dashboard-admin", {
    jobs,
    recentApplications,
    title: "Admin Dashboard",
    users,
  });
});

router.post("/admin/users/:id/role", ensureRole("admin"), async (req, res, next) => {
  try {
    const { role } = req.body;

    await run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);

    if (Number(req.params.id) === req.session.user.id) {
      req.session.user.role = role;
    }

    setFlash(req, "success", "User role updated successfully.");
    res.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});

router.post("/applications/:id/status", ensureRole("admin", "recruiter"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const applicationId = req.params.id;

    const application = await get(`
      SELECT applications.*, users.email, users.full_name, jobs.title, jobs.employment_type
      FROM applications
      JOIN users ON users.id = applications.candidate_id
      JOIN jobs ON jobs.id = applications.job_id
      WHERE applications.id = ?
    `, [applicationId]);

    if (!application) {
      setFlash(req, "error", "Application not found.");
      res.redirect("/dashboard");
      return;
    }

    // Check if recruiter owns the job
    if (req.session.user.role === "recruiter") {
      const job = await get("SELECT posted_by FROM jobs WHERE id = ?", [application.job_id]);
      if (job.posted_by !== req.session.user.id) {
        setFlash(req, "error", "You can only update applications for your own jobs.");
        res.redirect("/dashboard");
        return;
      }
    }

    await run("UPDATE applications SET status = ? WHERE id = ?", [status, applicationId]);

    // Send email
    await sendApplicationStatusUpdateEmail(
      application.email,
      application.full_name,
      application.title,
      status,
      application.employment_type
    );

    setFlash(req, "success", "Application status updated successfully.");
    res.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});

export default router;
