-- Attendance Tracker Schema
-- This table will be added to the existing scheduling_db

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'ta')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each student can only have one attendance record per day
    UNIQUE(student_id, date)
);

-- Index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- Index for faster queries by student
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- Student notes table (per student per month)
CREATE TABLE IF NOT EXISTS student_notes (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    notes TEXT,
    subject VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each student-subject can only have one note per month
    UNIQUE(student_id, year, month, subject)
);

-- Index for faster note lookups
CREATE INDEX IF NOT EXISTS idx_student_notes_lookup ON student_notes(student_id, year, month);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster holiday lookups
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Student tuition fees table (price per class)
CREATE TABLE IF NOT EXISTS student_tuition (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    price_per_class DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'KRW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tuition payments table
CREATE TABLE IF NOT EXISTS tuition_payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each student can only have one payment record per month
    UNIQUE(student_id, year, month)
);

-- Index for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_tuition_payments_student ON tuition_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_month ON tuition_payments(year, month);

-- Migration: Rename amount to price_per_class if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'student_tuition' AND column_name = 'amount') THEN
        ALTER TABLE student_tuition RENAME COLUMN amount TO price_per_class;
    END IF;
END $$;

-- Migration: Add currency column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'student_tuition' AND column_name = 'currency') THEN
        ALTER TABLE student_tuition ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'PHP';
        ALTER TABLE student_tuition ADD CONSTRAINT student_tuition_currency_check CHECK (currency IN ('PHP', 'KRW'));
    END IF;
END $$;

-- ==================== TEACHER COMMISSIONS ====================

-- Teacher commission rates table (commission per class)
CREATE TABLE IF NOT EXISTS teacher_commission (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL UNIQUE,
    commission_per_class DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'KRW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher commission payments table
CREATE TABLE IF NOT EXISTS teacher_payments (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each teacher can only have one payment record per month
    UNIQUE(teacher_id, year, month)
);

-- Index for faster commission lookups
CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher ON teacher_payments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payments_month ON teacher_payments(year, month);

-- ==================== TEACHER-STUDENT COMMISSIONS (per student) ====================

-- Teacher-student commission rates table (commission per class for each student)
CREATE TABLE IF NOT EXISTS teacher_student_commission (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    commission_per_class DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'KRW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, student_id)
);

-- Teacher-student payments table (payment per student per month)
CREATE TABLE IF NOT EXISTS teacher_student_payments (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, student_id, year, month)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_student_commission_teacher ON teacher_student_commission(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_commission_student ON teacher_student_commission(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_payments_month ON teacher_student_payments(year, month);

