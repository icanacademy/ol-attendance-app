-- Hidden attendance rows table
-- Tracks which student-subject combinations should be hidden from the attendance view

CREATE TABLE IF NOT EXISTS hidden_attendance_rows (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject VARCHAR(100),
    hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each student-subject can only be hidden once
    UNIQUE(student_id, subject)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hidden_rows_student ON hidden_attendance_rows(student_id);
