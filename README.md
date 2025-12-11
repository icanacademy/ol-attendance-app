# Online Attendance Tracker

A simple attendance tracking application for ICAN Academy that integrates with the scheduling app database.

## Features

- **Monthly View**: Tabs for each month with year navigation
- **Student List**: Shows all active students from the scheduling database
- **Attendance Grid**: Days of the month as columns, students as rows
- **Click to Toggle**: Simply click a cell to toggle between Present/Absent
- **Summary Counts**: See present/absent totals per student and overall

## Prerequisites

- Node.js 18+
- The scheduling app's PostgreSQL database must be running (Docker)

## Setup

### 1. Start the Database

Make sure the scheduling app's database is running:

```bash
cd /Users/icanacademy/ol-scheduling-app
docker compose up -d
```

### 2. Install Dependencies

```bash
# Backend
cd ol-attendance-app/server
npm install

# Frontend
cd ../client
npm install
```

### 3. Run Database Migration

This adds the attendance table to the existing scheduling database:

```bash
cd server
npm run migrate
```

### 4. Start the Application

```bash
# Terminal 1 - Backend (port 5001)
cd server
npm run dev

# Terminal 2 - Frontend (port 5174)
cd client
npm run dev
```

### 5. Open in Browser

Navigate to: http://localhost:5174

## Usage

1. Select a month using the tabs at the top
2. Navigate years using the arrows
3. Click any cell in the grid to toggle attendance:
   - Gray (-) = Not marked
   - Green (P) = Present
   - Red (A) = Absent
4. View summary counts in the P/A columns and header

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/attendance/students | Get all active students |
| GET | /api/attendance/monthly?year=&month= | Get attendance for a month |
| POST | /api/attendance | Set attendance record |
| POST | /api/attendance/toggle | Toggle attendance status |
| DELETE | /api/attendance | Delete attendance record |
| GET | /api/attendance/summary | Get monthly summary |

## Tech Stack

- **Frontend**: React 19, Vite, TanStack React Query, Tailwind CSS
- **Backend**: Node.js, Express 5
- **Database**: PostgreSQL (shared with scheduling app)
