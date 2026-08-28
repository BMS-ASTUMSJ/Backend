const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"ASTU MSJ Bootcamp" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendEmail };
