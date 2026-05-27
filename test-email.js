require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  console.log("SMTP_USER:", user);
  console.log("SMTP_PASS length:", pass ? pass.length : 0);
  
  if (!user || !pass) {
    console.log("No SMTP credentials in .env");
    return;
  }
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  
  try {
    const info = await transporter.sendMail({
      from: '"Test" <' + user + '>',
      to: user,
      subject: "Test Email from little-souls",
      text: "This is a test email."
    });
    console.log("Message sent: %s", info.messageId);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
