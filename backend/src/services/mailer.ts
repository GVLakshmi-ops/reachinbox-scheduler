import nodemailer from "nodemailer";
import { env } from "../config/env";

// Ethereal Email = fake SMTP for testing. Create a test account at
// https://ethereal.email and put the credentials in .env.
export const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: env.etherealUser,
    pass: env.etherealPass,
  },
});

export async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const info = await transporter.sendMail(opts);
  // Ethereal gives you a preview URL for every "sent" email - handy for the demo video.
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl };
}
