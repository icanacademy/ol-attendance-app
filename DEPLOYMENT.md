# Deployment Guide - Vercel + Neon

This guide walks you through deploying the Attendance Tracker and Online Scheduler to Vercel with Neon PostgreSQL.

## Prerequisites

1. GitHub account (already done - code is pushed)
2. Vercel account (https://vercel.com - sign up with GitHub)
3. Neon account (https://neon.tech - sign up free)

---

## Step 1: Create Neon Database

1. Go to **https://console.neon.tech**
2. Sign up / Log in
3. Click **Create Project**
   - Name: `ican-scheduling`
   - Region: Singapore (or closest)
4. Once created, go to **Dashboard**
5. Copy the **Connection String** (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

**Save this connection string - you'll need it for both apps!**

---

## Step 2: Initialize Database

Before deploying, you need to create the database tables. Run this locally:

```bash
# Set the DATABASE_URL temporarily
export DATABASE_URL="your-neon-connection-string-here"

# Run scheduler migrations
cd /Users/icanacademy/ol-scheduling-app/server
npm install
node src/db/seed.js

# Run attendance migrations
cd /Users/icanacademy/ol-attendance-app/server
npm install
npm run migrate
```

---

## Step 3: Deploy to Vercel

### 3.1 Install Vercel CLI (optional but easier)

```bash
npm install -g vercel
vercel login
```

### 3.2 Deploy Scheduler API

```bash
cd /Users/icanacademy/ol-scheduling-app/server
vercel
```

When prompted:
- Set up and deploy: **Y**
- Scope: Select your account
- Link to existing project: **N**
- Project name: `scheduler-api`
- Directory: `./`
- Override settings: **N**

After deploy, add environment variables on Vercel dashboard:
1. Go to https://vercel.com/icanacademy/scheduler-api/settings/environment-variables
2. Add:
   - `DATABASE_URL` = your Neon connection string
   - `NODE_ENV` = `production`
   - `ALLOWED_ORIGINS` = (leave empty for now, add after frontend deploy)

Copy the deployment URL (e.g., `https://scheduler-api-xxx.vercel.app`)

### 3.3 Deploy Scheduler Frontend

```bash
cd /Users/icanacademy/ol-scheduling-app/client
vercel
```

- Project name: `scheduler-frontend`

Add environment variable:
- `VITE_API_URL` = `https://scheduler-api-xxx.vercel.app`

Copy the frontend URL (e.g., `https://scheduler-frontend-xxx.vercel.app`)

### 3.4 Update Scheduler API CORS

Go back to scheduler-api settings and update:
- `ALLOWED_ORIGINS` = `https://scheduler-frontend-xxx.vercel.app,https://attendance-frontend-xxx.vercel.app`

Redeploy: `cd /Users/icanacademy/ol-scheduling-app/server && vercel --prod`

### 3.5 Deploy Attendance API

```bash
cd /Users/icanacademy/ol-attendance-app/server
vercel
```

- Project name: `attendance-api`

Add environment variables:
- `DATABASE_URL` = your Neon connection string (same as scheduler)
- `NODE_ENV` = `production`
- `SCHEDULER_API_URL` = `https://scheduler-api-xxx.vercel.app/api`
- `ADMIN_PASSWORD` = `your_secure_password`
- `ALLOWED_ORIGINS` = (add after frontend deploy)

### 3.6 Deploy Attendance Frontend

```bash
cd /Users/icanacademy/ol-attendance-app/client
vercel
```

- Project name: `attendance-frontend`

Add environment variable:
- `VITE_API_URL` = `https://attendance-api-xxx.vercel.app`

### 3.7 Update Attendance API CORS

Update `ALLOWED_ORIGINS` = `https://attendance-frontend-xxx.vercel.app`

Redeploy: `cd /Users/icanacademy/ol-attendance-app/server && vercel --prod`

---

## Alternative: Deploy via Vercel Dashboard

If you prefer the web interface:

1. Go to https://vercel.com/new
2. Import from GitHub
3. Select `icanacademy/ol-scheduling-app`
4. Configure:
   - **For API**: Root Directory = `server`
   - **For Frontend**: Root Directory = `client`
5. Add environment variables
6. Deploy

Repeat for `icanacademy/ol-attendance-app`

---

## Step 4: Verify Deployment

1. Open scheduler frontend URL - should see the scheduling app
2. Open attendance frontend URL - should see the attendance tracker
3. Test admin login with your password
4. Verify students load in the attendance grid

---

## URLs Summary

After deployment, you'll have 4 URLs:

| Service | URL |
|---------|-----|
| Scheduler Frontend | `https://scheduler-frontend-xxx.vercel.app` |
| Scheduler API | `https://scheduler-api-xxx.vercel.app` |
| Attendance Frontend | `https://attendance-frontend-xxx.vercel.app` |
| Attendance API | `https://attendance-api-xxx.vercel.app` |

---

## Updating the Apps

Vercel automatically redeploys when you push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push
```

Or manually trigger a redeploy from the Vercel dashboard.

---

## Troubleshooting

### "Database connection error"
- Verify DATABASE_URL is correct in Vercel settings
- Make sure to include `?sslmode=require` in the Neon URL

### "CORS error"
- Add your frontend URLs to ALLOWED_ORIGINS
- Redeploy the API after changing env vars

### "Students not loading"
- Check SCHEDULER_API_URL ends with `/api`
- Verify scheduler-api is deployed and running

### "Build failed"
- Check the Vercel build logs
- Make sure package.json has correct scripts
