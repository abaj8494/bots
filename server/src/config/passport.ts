import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { getUserByEmail, createUser, updateUserVerificationStatus } from '../models/User';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Import Google credentials from the JSON file
const googleCredentialsPath = path.join(__dirname, '../../..', 'google-auth.json');
const googleCredentials = JSON.parse(fs.readFileSync(googleCredentialsPath, 'utf8')).web;

// Configure Passport strategies
export const configurePassport = () => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleCredentials.client_id,
        clientSecret: googleCredentials.client_secret,
        callbackURL: googleCredentials.redirect_uris[0],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract profile information
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Google profile'));
          }
          
          // Check if user already exists
          let user = await getUserByEmail(email);
          
          if (!user) {
            // Create new user
            user = await createUser({
              username: profile.displayName || email.split('@')[0],
              email,
              password: Math.random().toString(36).slice(-12), // Random password
              is_verified: true // OAuth users are automatically verified
            });
          } else if (!user.is_verified) {
            // If user exists but isn't verified, mark them as verified
            // This is a simplified approach - in a real app, you might want to merge accounts
            await updateUserVerificationStatus(user.id, true);
          }
          
          return done(null, {
            id: user.id,
            username: user.username,
            email: user.email
          });
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
  
  // GitHub OAuth Strategy
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        callbackURL: `${process.env.SERVER_URL}/api/auth/github/callback`,
        scope: ['user:email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract profile information
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in GitHub profile'));
          }
          
          // Check if user already exists
          let user = await getUserByEmail(email);
          
          if (!user) {
            // Create new user
            user = await createUser({
              username: profile.username || profile.displayName || email.split('@')[0],
              email,
              password: Math.random().toString(36).slice(-12), // Random password
              is_verified: true // OAuth users are automatically verified
            });
          } else if (!user.is_verified) {
            // If user exists but isn't verified, mark them as verified
            await updateUserVerificationStatus(user.id, true);
          }
          
          return done(null, {
            id: user.id,
            username: user.username,
            email: user.email
          });
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
  
  // Serialize user to the session
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  
  // Deserialize user from the session
  passport.deserializeUser((user, done) => {
    done(null, user as Express.User);
  });
}; 