import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

let transporter: nodemailer.Transporter | null = null;

function createTransporter() {
  const mailer = (process.env.MAIL_MAILER ?? "smtp").toLowerCase();
  if (mailer !== "smtp") {
    throw new Error(`Unsupported MAIL_MAILER value: ${mailer}`);
  }

  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT ?? 587);
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_PASSWORD;
  const encryption = (process.env.MAIL_ENCRYPTION ?? "").toLowerCase();

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error("Missing SMTP configuration. Check MAIL_* environment variables.");
  }

  const secure = encryption === "ssl" || encryption === "smtps" || port === 465;
  const requireTLS = encryption === "tls";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: {
      user,
      pass,
    },
  });
}

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

export async function sendEmail(input: SendEmailInput) {
  const fromAddress = process.env.MAIL_FROM_ADDRESS ?? process.env.MAIL_USERNAME;
  const fromName = process.env.MAIL_FROM_NAME ?? "Shuttle Mate Team";

  if (!fromAddress) {
    throw new Error("MAIL_FROM_ADDRESS or MAIL_USERNAME must be set.");
  }

  return getTransporter().sendMail({
    from: `${fromName} <${fromAddress}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
