-- Migration: Add subject column to attendance table for per-subject attendance tracking
-- This allows students with multiple classes (e.g., Math and English) to have separate attendance rows

-- Add subject column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'attendance' AND column_name = 'subject') THEN
        ALTER TABLE attendance ADD COLUMN subject VARCHAR(100);
    END IF;
END $$;

-- Drop the old unique constraint (student_id, date)
DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'attendance_student_id_date_key'
               AND table_name = 'attendance') THEN
        ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_date_key;
    END IF;
END $$;

-- Create new unique constraint including subject (student_id, date, subject)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'attendance_student_id_date_subject_key'
                   AND table_name = 'attendance') THEN
        ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_date_subject_key
            UNIQUE(student_id, date, subject);
    END IF;
END $$;

-- Create index on subject for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance(subject);

-- Add subject to student_notes table if the table exists and column doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_notes') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'student_notes' AND column_name = 'subject') THEN
            ALTER TABLE student_notes ADD COLUMN subject VARCHAR(100);
        END IF;
    END IF;
END $$;

-- Drop the old unique constraint on student_notes if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'student_notes_student_id_year_month_key'
               AND table_name = 'student_notes') THEN
        ALTER TABLE student_notes DROP CONSTRAINT student_notes_student_id_year_month_key;
    END IF;
END $$;

-- Create new unique constraint including subject (only if table exists and constraint doesn't)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_notes') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'student_notes_student_id_year_month_subject_key'
                       AND table_name = 'student_notes') THEN
            ALTER TABLE student_notes ADD CONSTRAINT student_notes_student_id_year_month_subject_key
                UNIQUE(student_id, year, month, subject);
        END IF;
    END IF;
END $$;
