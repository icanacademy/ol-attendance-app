-- Migration: Add soft delete support to attendance table
-- Allows undo of deleted attendance records within a time window

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_attendance_not_deleted ON attendance(student_id, date, subject) WHERE is_deleted = false;
