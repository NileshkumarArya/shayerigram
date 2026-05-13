const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: process.env.EMAIL_FROM || 'ShayeriGram <noreply@shayerigram.com>',
    to, subject, text, html,
  });
};

module.exports = sendEmail;
