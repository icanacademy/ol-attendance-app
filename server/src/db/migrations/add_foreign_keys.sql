-- Add foreign key constraints to attendance app tables
-- These reference the students table in the shared scheduling_db

-- attendance.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_attendance_student' AND table_name = 'attendance'
    ) THEN
        ALTER TABLE attendance ADD CONSTRAINT fk_attendance_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- student_notes.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_student_notes_student' AND table_name = 'student_notes'
    ) THEN
        ALTER TABLE student_notes ADD CONSTRAINT fk_student_notes_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- student_tuition.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_student_tuition_student' AND table_name = 'student_tuition'
    ) THEN
        ALTER TABLE student_tuition ADD CONSTRAINT fk_student_tuition_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- tuition_payments.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tuition_payments_student' AND table_name = 'tuition_payments'
    ) THEN
        ALTER TABLE tuition_payments ADD CONSTRAINT fk_tuition_payments_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_commission.teacher_id -> teachers.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_teacher_commission_teacher' AND table_name = 'teacher_commission'
    ) THEN
        ALTER TABLE teacher_commission ADD CONSTRAINT fk_teacher_commission_teacher
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_payments.teacher_id -> teachers.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_teacher_payments_teacher' AND table_name = 'teacher_payments'
    ) THEN
        ALTER TABLE teacher_payments ADD CONSTRAINT fk_teacher_payments_teacher
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_student_commission.teacher_id -> teachers.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tsc_teacher' AND table_name = 'teacher_student_commission'
    ) THEN
        ALTER TABLE teacher_student_commission ADD CONSTRAINT fk_tsc_teacher
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_student_commission.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tsc_student' AND table_name = 'teacher_student_commission'
    ) THEN
        ALTER TABLE teacher_student_commission ADD CONSTRAINT fk_tsc_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_student_payments.teacher_id -> teachers.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tsp_teacher' AND table_name = 'teacher_student_payments'
    ) THEN
        ALTER TABLE teacher_student_payments ADD CONSTRAINT fk_tsp_teacher
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- teacher_student_payments.student_id -> students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tsp_student' AND table_name = 'teacher_student_payments'
    ) THEN
        ALTER TABLE teacher_student_payments ADD CONSTRAINT fk_tsp_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;
