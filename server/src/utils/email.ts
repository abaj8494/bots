import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter object
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send a verification email to a user
 * @param to Email address to send to
 * @param token Verification token
 * @param userId User ID
 */
export const sendVerificationEmail = async (to: string, token: string, userId: number): Promise<void> => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verificationUrl = `${process.env.SERVER_URL || 'http://localhost:5002'}/api/auth/verify/${userId}/${token}`;
  
  const mailOptions = {
    from: `"BookBot" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Verify Your BookBot Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6cf7;">Welcome to BookBot!</h2>
        <p>Thank you for registering. Please verify your email address to complete your registration.</p>
        <div style="margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4a6cf7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a>
        </div>
        <p>If you did not create an account, you can safely ignore this email.</p>
        <p>This verification link will expire in 24 hours.</p>
        <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">BookBot - Chat with your favorite books using AI</p>
      </div>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Generate verification email
export const generateVerificationEmail = (email: string, username: string, userId: number, token: string) => {
  const clientUrl = process.env.CLIENT_URL;
  const verificationUrl = `${process.env.SERVER_URL}/api/auth/verify/${userId}/${token}`;
  
  // ... existing code ...
} 