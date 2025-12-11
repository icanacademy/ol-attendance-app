-- Migration: Add subject-based tuition tables
-- This allows multiple tuition entries per student (one per subject)

-- Student-subject tuition rates table (price per class for each subject)
CREATE TABLE IF NOT EXISTS student_subject_tuition (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject VARCHAR(100) NOT NULL,
    price_per_class DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'KRW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject)
);

-- Subject tuition payments table (payment per student-subject per month)
CREATE TABLE IF NOT EXISTS subject_tuition_payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject, year, month)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_subject_tuition_student ON student_subject_tuition(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subject_tuition_subject ON student_subject_tuition(subject);
CREATE INDEX IF NOT EXISTS idx_subject_tuition_payments_student ON subject_tuition_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_tuition_payments_month ON subject_tuition_payments(year, month);
