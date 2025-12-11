# Deployment Guide - Attendance Tracker

This guide walks you through deploying the Attendance Tracker and its dependency (Online Scheduler) to Render.com.

## Prerequisites

1. A GitHub account (for hosting your code)
2. A Render.com account (free tier works)

---

## Step 1: Push Code to GitHub

### Create GitHub Repositories

1. Go to https://github.com/new
2. Create **two repositories**:
   - `ol-scheduling-app` (public or private)
   - `ol-attendance-app` (public or private)

### Push Scheduler App

```bash
cd /Users/icanacademy/ol-scheduling-app

# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for deployment"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ol-scheduling-app.git

# Push
git push -u origin main
```

### Push Attendance App

```bash
cd /Users/icanacademy/ol-attendance-app

# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for deployment"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ol-attendance-app.git

# Push
git push -u origin main
```

---

## Step 2: Deploy Scheduler App on Render

### 2.1 Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **New** → **PostgreSQL**
3. Configure:
   - **Name**: `scheduling-db`
   - **Database**: `scheduling_db`
   - **User**: `scheduler_user`
   - **Region**: Singapore (or closest to you)
   - **Plan**: Free
4. Click **Create Database**
5. Wait for it to be ready, then copy the **Internal Database URL**

### 2.2 Deploy Scheduler Backend

1. Click **New** → **Web Service**
2. Connect your GitHub repository `ol-scheduling-app`
3. Configure:
   - **Name**: `scheduler-api`
   - **Region**: Singapore
   - **Branch**: main
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | (paste Internal Database URL from step 2.1) |
   | `ALLOWED_ORIGINS` | (leave blank for now, will update later) |

5. Click **Create Web Service**
6. Wait for deployment to complete
7. Copy the service URL (e.g., `https://scheduler-api-xxxx.onrender.com`)

### 2.3 Deploy Scheduler Frontend

1. Click **New** → **Static Site**
2. Connect your GitHub repository `ol-scheduling-app`
3. Configure:
   - **Name**: `scheduler-frontend`
   - **Branch**: main
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://scheduler-api-xxxx.onrender.com` (your API URL from 2.2) |

5. Click **Create Static Site**
6. Wait for deployment
7. Copy the frontend URL (e.g., `https://scheduler-frontend-xxxx.onrender.com`)

### 2.4 Update CORS

Go back to your `scheduler-api` service → Environment → Edit `ALLOWED_ORIGINS`:
```
https://scheduler-frontend-xxxx.onrender.com,https://attendance-frontend-xxxx.onrender.com
```

---

## Step 3: Deploy Attendance App on Render

### 3.1 Deploy Attendance Backend

1. Click **New** → **Web Service**
2. Connect your GitHub repository `ol-attendance-app`
3. Configure:
   - **Name**: `attendance-api`
   - **Region**: Singapore
   - **Branch**: main
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run migrate`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | (same Internal Database URL from step 2.1 - shared DB) |
   | `SCHEDULER_API_URL` | `https://scheduler-api-xxxx.onrender.com/api` |
   | `ADMIN_PASSWORD` | `your_secure_password_here` |
   | `ALLOWED_ORIGINS` | (leave blank for now) |

5. Click **Create Web Service**
6. Copy the URL (e.g., `https://attendance-api-xxxx.onrender.com`)

### 3.2 Deploy Attendance Frontend

1. Click **New** → **Static Site**
2. Connect your GitHub repository `ol-attendance-app`
3. Configure:
   - **Name**: `attendance-frontend`
   - **Branch**: main
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://attendance-api-xxxx.onrender.com` |

5. Click **Create Static Site**
6. Copy the URL (e.g., `https://attendance-frontend-xxxx.onrender.com`)

### 3.3 Update CORS

Go back to your `attendance-api` service → Environment → Edit `ALLOWED_ORIGINS`:
```
https://attendance-frontend-xxxx.onrender.com
```

---

## Step 4: Initialize Database

After both apps are deployed, you need to seed the scheduler database:

1. Go to your `scheduler-api` service on Render
2. Click **Shell** tab
3. Run:
```bash
npm run seed
```

---

## Step 5: Verify Deployment

1. Open your scheduler frontend URL - you should see the scheduling app
2. Open your attendance frontend URL - you should see the attendance tracker
3. Try logging in with your admin password
4. Verify students show up in the attendance grid

---

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Make sure database is in same region as services

### "CORS error"
- Update ALLOWED_ORIGINS to include your frontend URLs
- Redeploy after changing environment variables

### "Students not loading"
- Check SCHEDULER_API_URL is correct (include `/api` at the end)
- Verify scheduler-api is running

### Services sleeping (free tier)
- Free tier services sleep after 15 mins of inactivity
- First request after sleep takes ~30 seconds to wake up
- Consider upgrading to paid plan for always-on

---

## URLs Summary

After deployment, you'll have:

| Service | URL |
|---------|-----|
| Scheduler Frontend | `https://scheduler-frontend-xxxx.onrender.com` |
| Scheduler API | `https://scheduler-api-xxxx.onrender.com` |
| Attendance Frontend | `https://attendance-frontend-xxxx.onrender.com` |
| Attendance API | `https://attendance-api-xxxx.onrender.com` |

---

## Updating the Apps

When you make changes:

1. Commit and push to GitHub
2. Render will automatically redeploy

```bash
git add .
git commit -m "Your changes"
git push
```
