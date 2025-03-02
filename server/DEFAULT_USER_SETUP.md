# Default User Setup

This project includes a default user creation feature that allows you to sign in to the frontend without going through the registration process.

## Default User Credentials

The default user credentials are:
- Email: `root@abaj.ai` 
- Password: `toor`

These values can be customized in the `.env` file by modifying the `DEFAULT_USER` and `DEFAULT_PASSWORD` variables.

## How to Create the Default User

There are two ways to create the default user:

### Option 1: Run the dedicated script

```bash
cd server
npm run create-default-user
```

### Option 2: Start the application with the setup script

```bash
cd server
npm run setup-and-start
```

This will:
1. Import books from the txt directory
2. Create the default user
3. Start the server

## Notes

- The default user will be created with the username "admin" and will be marked as verified
- If a user with the email already exists, the script will not create a duplicate
- You can modify the default values in the `.env` file 