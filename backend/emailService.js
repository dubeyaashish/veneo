// Create emailService.js file in your project root

const nodemailer = require('nodemailer');
const config = require('./config');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',  // Outlook SMTP server
  port: 587,
  secure: false,  // true for 465, false for other ports
  auth: {
    user: 'misteam@peerapat.com',
    pass: 'Poppy*1234'
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

// Function to send OTP email
async function sendOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: '"VERP System" <misteam@peerapat.com>',
      to: email,
      subject: 'Your OTP for VERP Registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4361ee; text-align: center;">VERP Registration</h2>
          <p style="margin-bottom: 20px;">Thank you for registering with VERP. To complete your registration, please use the following One-Time Password (OTP):</p>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; border-radius: 5px; margin-bottom: 20px;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this registration, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

module.exports = {
  sendOTPEmail
};