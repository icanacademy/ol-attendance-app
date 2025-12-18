-- Add hidden_from_year and hidden_from_month columns to hidden_attendance_rows
-- This allows hiding students from a specific month onwards instead of globally

-- Add the new columns
ALTER TABLE hidden_attendance_rows
ADD COLUMN IF NOT EXISTS hidden_from_year INTEGER,
ADD COLUMN IF NOT EXISTS hidden_from_month INTEGER CHECK (hidden_from_month >= 1 AND hidden_from_month <= 12);

-- Create index for faster date-based filtering
CREATE INDEX IF NOT EXISTS idx_hidden_rows_from_date ON hidden_attendance_rows(hidden_from_year, hidden_from_month);

-- Update existing rows to use the month they were hidden (based on hidden_at timestamp)
-- This ensures backward compatibility - existing hidden rows remain hidden from their original date
UPDATE hidden_attendance_rows
SET hidden_from_year = EXTRACT(YEAR FROM hidden_at)::INTEGER,
    hidden_from_month = EXTRACT(MONTH FROM hidden_at)::INTEGER
WHERE hidden_from_year IS NULL;
