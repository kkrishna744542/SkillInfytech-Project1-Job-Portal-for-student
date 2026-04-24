import nodemailer from "nodemailer";

async function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendLoginNotificationEmail(userEmail, userName) {
  const transporter = await createTransporter();

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "Skillinfytech Login Alert",
    text: `Hello ${userName}, you have signed in successfully to Skillinfytech.`,
    html: `
      <h2>Skillinfytech Login Alert</h2>
      <p>Hello ${userName},</p>
      <p>You have signed in successfully to the Skillinfytech job portal.</p>
    `,
  });
}

async function sendRegistrationConfirmationEmail(userEmail, userName) {
  const transporter = await createTransporter();

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "Welcome to Skillinfytech Job Portal",
    text: `Hello ${userName}, welcome to Skillinfytech Job Portal. Your account has been created successfully.`,
    html: `
      <h2>Welcome to Skillinfytech Job Portal</h2>
      <p>Hello ${userName},</p>
      <p>Your account has been created successfully. You can now log in and start applying for jobs.</p>
    `,
  });
}

async function sendApplicationConfirmationEmail(userEmail, userName, jobTitle) {
  const transporter = await createTransporter();

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "Application Submitted Successfully",
    text: `Hello ${userName}, your application for ${jobTitle} has been submitted successfully.`,
    html: `
      <h2>Application Submitted</h2>
      <p>Hello ${userName},</p>
      <p>Your application for <strong>${jobTitle}</strong> has been submitted successfully. We will review your application and get back to you soon.</p>
    `,
  });
}

async function sendApplicationStatusUpdateEmail(userEmail, userName, jobTitle, status, employmentType) {
  const transporter = await createTransporter();

  let subject, message;
  if (status === 'success') {
    subject = "Congratulations! Your Application is Approved";
    message = `Congratulations ${userName}! Your profile has been selected for the ${employmentType} position at ${jobTitle}.`;
  } else if (status === 'reject') {
    subject = "Application Update";
    message = `Hello ${userName}, unfortunately your application for ${jobTitle} has been rejected.`;
  } else {
    subject = "Application Status Update";
    message = `Hello ${userName}, your application status for ${jobTitle} has been updated to ${status}.`;
  }

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: subject,
    text: message,
    html: `
      <h2>Application Status Update</h2>
      <p>${message}</p>
    `,
  });
}

async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  const transporter = await createTransporter();
  
  // BASE_URL 
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "Password Reset Request - Skillinfytech Job Portal",
    text: `Reset link: ${resetUrl}`,
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
}

export {
  sendLoginNotificationEmail,
  sendRegistrationConfirmationEmail,
  sendApplicationConfirmationEmail,
  sendApplicationStatusUpdateEmail,
  sendPasswordResetEmail,
};
