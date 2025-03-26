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
console.log('Loading Google credentials from:', googleCredentialsPath);

let googleCredentials;

try {
  if (!fs.existsSync(googleCredentialsPath)) {
    console.error('ERROR: google-auth.json file not found at path:', googleCredentialsPath);
    throw new Error('Google auth file not found');
  }

  const fileContent = fs.readFileSync(googleCredentialsPath, 'utf8');
  const parsedContent = JSON.parse(fileContent);
  
  if (!parsedContent.web) {
    console.error('ERROR: Missing "web" property in google-auth.json');
    throw new Error('Invalid Google auth file format - missing web property');
  }
  
  googleCredentials = parsedContent.web;
  
  if (!googleCredentials.client_id) {
    console.error('ERROR: Missing client_id in google-auth.json');
    throw new Error('Missing client_id in Google auth file');
  }
  
  if (!googleCredentials.client_secret) {
    console.error('ERROR: Missing client_secret in google-auth.json');
    throw new Error('Missing client_secret in Google auth file');
  }
  
  console.log('Google credentials loaded successfully:', {
    client_id: googleCredentials.client_id.substring(0, 10) + '...',
    redirect_uris: googleCredentials.redirect_uris
  });
} catch (error) {
  console.error('Failed to load Google credentials:', error);
  googleCredentials = {
    client_id: '',
    client_secret: '',
    redirect_uris: ['']
  };
}

// Check GitHub credentials
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const hasGithubConfig = !!(githubClientId && githubClientSecret);

if (!hasGithubConfig) {
  console.warn('GitHub OAuth credentials not found in environment variables. GitHub login will be disabled.');
}

// Configure Passport strategies
export const configurePassport = () => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleCredentials.client_id,
        clientSecret: googleCredentials.client_secret,
        callbackURL: googleCredentials.redirect_uris ? googleCredentials.redirect_uris[0] : '',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('Google OAuth callback received for profile:', {
            id: profile.id,
            displayName: profile.displayName,
            emails: profile.emails?.map(e => e.value)
          });
          
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
          console.error('Error in Google OAuth callback:', error);
          return done(error as Error);
        }
      }
    )
  );
  
  // GitHub OAuth Strategy - Only configure if credentials are available
  if (hasGithubConfig) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: githubClientId as string,
          clientSecret: githubClientSecret as string,
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
  }
  
  // Serialize user to the session
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  
  // Deserialize user from the session
  passport.deserializeUser((user, done) => {
    done(null, user as Express.User);
  });
}; 