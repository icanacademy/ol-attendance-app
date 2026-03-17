const pool = require('../db/connection');

// Helper function to extract Korean name from brackets in the name field
// e.g., "Kim Ji Hye [김지혜]" -> "김지혜"
// e.g., "Kim Bo Yeon (Sharon) [김보연]" -> "김보연"
const extractKoreanName = (name) => {
  if (!name) return null;
  const match = name.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
};

// Helper function to get clean display name (without Korean in brackets)
// e.g., "Kim Ji Hye [김지혜]" -> "Kim Ji Hye"
// e.g., "Kim Bo Yeon (Sharon) [김보연]" -> "Kim Bo Yeon (Sharon)"
const getCleanDisplayName = (name) => {
  if (!name) return name;
  return name.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
};

class Attendance {
  // Get all student IDs that belong to the same person as the given student ID
  // (grouped by notion_page_id or name+korean_name)
  static async _getAllIdsForStudent(studentId) {
    const result = await pool.query(`
      WITH target AS (
        SELECT COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')) as identity_key
        FROM students WHERE id = $1 LIMIT 1
      )
      SELECT s.id FROM students s, target t
      WHERE COALESCE(s.notion_page_id, LOWER(s.name) || '::' || COALESCE(s.korean_name, '')) = t.identity_key
    `, [studentId]);
    return result.rows.map(r => r.id);
  }

  // Build a map of old student IDs -> canonical (current) student IDs
  // Used to remap attendance/notes records when a student's ID changes due to schedule edits
  static async _getIdRemapTable() {
    const result = await pool.query(`
      WITH canonical AS (
        SELECT DISTINCT ON (
          COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, ''))
        ) id as canonical_id,
        COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')) as identity_key
        FROM students
        WHERE is_active = true
        ORDER BY COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')),
                 (CASE WHEN first_start_date IS NOT NULL THEN 0 ELSE 1 END),
                 id ASC
      ),
      all_ids AS (
        SELECT id,
          COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')) as identity_key
        FROM students
      )
      SELECT a.id as old_id, c.canonical_id
      FROM all_ids a
      JOIN canonical c ON a.identity_key = c.identity_key
      WHERE a.id != c.canonical_id
    `);
    const remap = {};
    result.rows.forEach(row => {
      remap[row.old_id] = row.canonical_id;
    });
    return remap;
  }
  // Get students with active assignments from the shared database
  // Only returns students that have at least one active assignment (class)
  // Returns one row per student-subject combination (students with multiple subjects get multiple rows)
  // If year and month are provided, filters hidden rows based on hidden_from date
  static async getStudentsWithClasses(year = null, month = null) {
    try {
      // Run 2 queries in parallel: student-subject-schedule combos, tuition subjects
      const [subjectsResult, tuitionSubjectsResult] = await Promise.all([
        // 1. Get students with active assignments (only students with classes)
        pool.query(
          `SELECT
            s.id as student_id,
            s.name as student_name,
            s.korean_name,
            s.english_name,
            s.color_keyword,
            a.subject,
            t.name as teacher_name,
            TO_CHAR(ts.start_time, 'HH:MI AM') as start_time,
            TO_CHAR(ts.end_time, 'HH:MI AM') as end_time,
            ARRAY_AGG(DISTINCT CASE a.date
              WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
              WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
              WHEN 'Saturday' THEN 6 END
              ORDER BY CASE a.date
              WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
              WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
              WHEN 'Saturday' THEN 6 END) as days
          FROM assignment_students ast
          JOIN students s ON s.id = ast.student_id
          JOIN assignments a ON a.id = ast.assignment_id
          JOIN time_slots ts ON ts.id = a.time_slot_id
          LEFT JOIN assignment_teachers att ON att.assignment_id = a.id
          LEFT JOIN teachers t ON t.id = att.teacher_id
          WHERE a.is_active = true AND s.is_active = true
          GROUP BY s.id, s.name, s.korean_name, s.english_name, s.color_keyword,
                   a.subject, t.name, ts.start_time, ts.end_time
          ORDER BY s.name, a.subject, ts.start_time`
        ),
        // 2. Get additional subjects from tuition table
        pool.query('SELECT DISTINCT student_id, subject FROM student_subject_tuition'),
      ]);

      const dayNames = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];

      // Helper function to merge consecutive time slots with the same days
      const mergeConsecutiveSchedules = (schedules) => {
        if (!schedules || schedules.length === 0) return [];
        const sorted = [...schedules].sort((a, b) => {
          if (a.days !== b.days) return a.days.localeCompare(b.days);
          return a.startTime.localeCompare(b.startTime);
        });
        const merged = [];
        let current = { ...sorted[0] };
        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          if (current.days === next.days && current.endTime === next.startTime) {
            current.endTime = next.endTime;
            current.time = `${current.startTime} - ${current.endTime}`;
          } else {
            merged.push({ time: current.time, days: current.days });
            current = { ...next };
          }
        }
        merged.push({ time: current.time, days: current.days });
        return merged;
      };

      // Build student info and subjects map from the assignment query
      const studentInfoMap = {};
      let studentSubjectsMap = {};

      subjectsResult.rows.forEach(row => {
        // Collect student info from the JOIN results
        if (!studentInfoMap[row.student_id]) {
          studentInfoMap[row.student_id] = {
            id: row.student_id,
            name: row.student_name,
            korean_name: row.korean_name || null,
            english_name: row.english_name,
            color_keyword: row.color_keyword,
          };
        }

        if (!studentSubjectsMap[row.student_id]) {
          studentSubjectsMap[row.student_id] = [];
        }
        const daysStr = row.days ? row.days.map(d => dayNames[d]).join('') : null;
        const scheduleEntry = {
          time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : null,
          startTime: row.start_time || null,
          endTime: row.end_time || null,
          days: daysStr
        };

        const existingSubject = studentSubjectsMap[row.student_id].find(
          s => s.subject === row.subject
        );
        if (existingSubject) {
          if (scheduleEntry.time && scheduleEntry.days) {
            existingSubject.schedules.push(scheduleEntry);
          }
        } else {
          studentSubjectsMap[row.student_id].push({
            subject: row.subject || null,
            teacher_name: row.teacher_name || null,
            schedules: scheduleEntry.time && scheduleEntry.days ? [scheduleEntry] : []
          });
        }
      });

      // Merge consecutive time slots
      Object.values(studentSubjectsMap).forEach(subjects => {
        subjects.forEach(subjectInfo => {
          if (subjectInfo.schedules && subjectInfo.schedules.length > 0) {
            subjectInfo.schedules = mergeConsecutiveSchedules(subjectInfo.schedules);
          }
        });
      });

      // Add tuition-only subjects (only for students who already have assignments)
      tuitionSubjectsResult.rows.forEach(row => {
        if (!studentSubjectsMap[row.student_id]) return; // skip students without assignments
        const existingSubject = studentSubjectsMap[row.student_id].find(
          s => s.subject === row.subject
        );
        if (!existingSubject) {
          studentSubjectsMap[row.student_id].push({
            subject: row.subject,
            teacher_name: null,
            schedule_time: null,
            schedule_days: null
          });
        }
      });

      // Build result: one row per student-subject combination
      const result = [];
      Object.values(studentInfoMap).forEach(student => {
        const subjects = studentSubjectsMap[student.id];
        if (subjects && subjects.length > 0) {
          subjects.forEach(subjectInfo => {
            const schedules = subjectInfo.schedules || [];
            const formattedSchedules = schedules.map(s => ({ time: s.time, days: s.days }));
            result.push({
              id: student.id,
              name: student.name,
              korean_name: student.korean_name,
              english_name: student.english_name,
              color_keyword: student.color_keyword,
              teacher_name: subjectInfo.teacher_name,
              schedule_time: schedules.length > 0 ? schedules[0].time : null,
              schedule_days: schedules.length > 0 ? schedules[0].days : null,
              schedules: formattedSchedules,
              subject: subjectInfo.subject,
              row_key: `${student.id}-${subjectInfo.subject || 'default'}`
            });
          });
        }
      });

      // Filter hidden rows in SQL when year/month provided, otherwise fetch all
      let hiddenRows = [];
      try {
        if (year && month) {
          const viewDate = year * 12 + month;
          const hiddenResult = await pool.query(
            `SELECT student_id, subject FROM hidden_attendance_rows
             WHERE (hidden_from_year IS NULL AND hidden_from_month IS NULL)
                OR (hidden_from_year * 12 + hidden_from_month) <= $1`,
            [viewDate]
          );
          hiddenRows = hiddenResult.rows;
        } else {
          const hiddenResult = await pool.query('SELECT student_id, subject FROM hidden_attendance_rows');
          hiddenRows = hiddenResult.rows;
        }
      } catch (err) {
        console.log('Could not fetch hidden rows (table may not exist yet):', err.message);
      }

      // Build a Set for O(1) hidden row lookups
      const hiddenSet = new Set(
        hiddenRows.map(h => `${h.student_id}-${h.subject}`)
      );

      const filteredResult = result.filter(student => {
        return !hiddenSet.has(`${student.id}-${student.subject}`);
      });

      // Sort by name then subject
      return filteredResult.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.subject || '').localeCompare(b.subject || '');
      });
    } catch (error) {
      console.error('Error fetching students:', error.message);
      throw new Error('Failed to fetch students from database.');
    }
  }

  // Get attendance records for a specific month
  // Remaps student_ids so attendance records follow the student even if their ID changes
  // (e.g., when schedule is edited and a new student record is created)
  static async getByMonth(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Run attendance query and student ID remap in parallel
    const [attendanceResult, idRemap] = await Promise.all([
      pool.query(`
        SELECT
          a.id,
          a.student_id,
          TO_CHAR(a.date, 'YYYY-MM-DD') as date,
          a.status,
          a.notes,
          a.subject
        FROM attendance a
        WHERE a.date >= $1 AND a.date <= $2 AND a.is_deleted = false
        ORDER BY a.date, a.student_id, a.subject
      `, [startDate, endDate]),
      this._getIdRemapTable()
    ]);

    // Remap student_ids in attendance records
    return attendanceResult.rows.map(row => ({
      ...row,
      student_id: idRemap[row.student_id] || row.student_id
    }));
  }

  // Get class count for a date range grouped by teacher, student, and subject
  static async getClassCountRange(startDate, endDate, statuses = ['present'], teacherId = null) {
    try {
      // Run student info + teacher mappings + attendance counts in parallel
      const statusPlaceholders = statuses.map((_, i) => `$${i + 3}`).join(', ');

      const [studentInfoResult, teacherResult, attendanceResult] = await Promise.all([
        // 1. Get student info directly from shared DB
        pool.query(
          `SELECT DISTINCT ON (
             COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, ''))
           ) id, name, korean_name, english_name
           FROM students WHERE is_active = true
           ORDER BY COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')),
                    (CASE WHEN first_start_date IS NOT NULL THEN 0 ELSE 1 END), id ASC`
        ),
        // 2. Get student-teacher mappings
        pool.query(
          `SELECT DISTINCT ON (s.id)
            s.id as student_id, t.id as teacher_id, t.name as teacher_name
          FROM assignment_students ast
          JOIN students s ON s.id = ast.student_id
          JOIN assignments a ON a.id = ast.assignment_id
          LEFT JOIN assignment_teachers att ON att.assignment_id = a.id
          LEFT JOIN teachers t ON t.id = att.teacher_id
          WHERE a.is_active = true AND s.is_active = true
          ORDER BY s.id, COUNT(*) OVER (PARTITION BY s.id, t.id) DESC`
        ),
        // 3. Get attendance counts
        pool.query(
          `SELECT student_id, subject, COUNT(*) as class_count
           FROM attendance
           WHERE date >= $1 AND date <= $2 AND status IN (${statusPlaceholders}) AND is_deleted = false
           GROUP BY student_id, subject
           ORDER BY student_id, subject`,
          [startDate, endDate, ...statuses]
        ),
      ]);

      // Build maps
      const studentInfoMap = {};
      studentInfoResult.rows.forEach(s => {
        studentInfoMap[s.id] = { name: s.name, korean_name: s.korean_name, english_name: s.english_name };
      });

      const studentTeacherMap = {};
      teacherResult.rows.forEach(row => {
        if (!studentTeacherMap[row.student_id]) {
          studentTeacherMap[row.student_id] = { teacherId: row.teacher_id, teacherName: row.teacher_name };
        }
      });

      // Group results by teacher
      const teacherGroups = {};
      attendanceResult.rows.forEach(row => {
        const studentId = row.student_id;
        const teacherInfo = studentTeacherMap[studentId] || { teacherId: null, teacherName: 'Unknown Teacher' };
        const studentInfo = studentInfoMap[studentId] || { name: `Student ${studentId}` };

        if (teacherId && teacherInfo.teacherId !== teacherId) return;

        const teacherKey = teacherInfo.teacherId || 'unknown';
        if (!teacherGroups[teacherKey]) {
          teacherGroups[teacherKey] = {
            teacherId: teacherInfo.teacherId,
            teacherName: teacherInfo.teacherName,
            students: [],
            totalClasses: 0
          };
        }

        const classCount = parseInt(row.class_count);
        teacherGroups[teacherKey].students.push({
          studentId, studentName: getCleanDisplayName(studentInfo.name),
          koreanName: studentInfo.korean_name, subject: row.subject, classCount
        });
        teacherGroups[teacherKey].totalClasses += classCount;
      });

      const teachers = Object.values(teacherGroups).sort((a, b) => {
        if (!a.teacherName) return 1;
        if (!b.teacherName) return -1;
        return a.teacherName.localeCompare(b.teacherName);
      });

      teachers.forEach(teacher => {
        teacher.students.sort((a, b) => a.studentName.localeCompare(b.studentName));
      });

      return { teachers };
    } catch (error) {
      console.error('Error in getClassCountRange:', error);
      throw error;
    }
  }

  // Get attendance for a specific student in a month
  static async getByStudentAndMonth(studentId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const query = `
      SELECT
        a.id,
        a.student_id,
        a.date,
        a.status,
        a.notes
      FROM attendance a
      WHERE a.student_id = $1 AND a.date >= $2 AND a.date <= $3 AND a.is_deleted = false
      ORDER BY a.date
    `;
    const result = await pool.query(query, [studentId, startDate, endDate]);
    return result.rows;
  }

  // Set attendance (create or update) - now supports subject
  // Also revives soft-deleted rows for the same (student_id, date, subject) combo
  static async setAttendance(studentId, date, status, notes = null, subject = null) {
    const query = `
      INSERT INTO attendance (student_id, date, status, notes, subject, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, date, subject)
      DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        is_deleted = false,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;
    const result = await pool.query(query, [studentId, date, status, notes, subject]);
    return result.rows[0];
  }

  // Toggle attendance status (cycles: present -> absent -> ta -> noshow -> clear)
  // Checks all IDs for the same student in case their ID changed due to schedule edits
  static async toggleAttendance(studentId, date, subject = null) {
    // Get all IDs for this student (handles ID changes from schedule edits)
    const allIds = await this._getAllIdsForStudent(studentId);

    // Check if record exists under any of the student's IDs (exclude soft-deleted)
    const checkQuery = `
      SELECT id, student_id, status FROM attendance
      WHERE student_id = ANY($1) AND date = $2 AND (subject = $3 OR (subject IS NULL AND $3 IS NULL)) AND is_deleted = false
      LIMIT 1
    `;
    const existing = await pool.query(checkQuery, [allIds.length > 0 ? allIds : [studentId], date, subject]);

    if (existing.rows.length === 0) {
      // No record exists, create as present
      return this.setAttendance(studentId, date, 'present', null, subject);
    } else {
      const existingRecord = existing.rows[0];
      const currentStatus = existingRecord.status;
      const recordStudentId = existingRecord.student_id;

      // If the record is under an old ID, migrate it to the current ID
      if (recordStudentId !== studentId) {
        await pool.query('UPDATE attendance SET student_id = $1 WHERE id = $2', [studentId, existingRecord.id]);
      }

      // Cycle: present -> absent -> ta -> noshow -> delete (clear)
      if (currentStatus === 'present') {
        return this.setAttendance(studentId, date, 'absent', null, subject);
      } else if (currentStatus === 'absent') {
        return this.setAttendance(studentId, date, 'ta', null, subject);
      } else if (currentStatus === 'ta') {
        return this.setAttendance(studentId, date, 'noshow', null, subject);
      } else {
        // noshow -> delete the record
        await this.delete(studentId, date, subject);
        return { student_id: studentId, date, status: null, subject };
      }
    }
  }

  // Soft delete attendance record - now supports subject
  // Checks all IDs for the same student in case their ID changed
  static async delete(studentId, date, subject = null) {
    const allIds = await this._getAllIdsForStudent(studentId);
    const query = `
      UPDATE attendance SET is_deleted = true, deleted_at = NOW()
      WHERE student_id = ANY($1) AND date = $2 AND (subject = $3 OR (subject IS NULL AND $3 IS NULL)) AND is_deleted = false
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;
    const result = await pool.query(query, [allIds.length > 0 ? allIds : [studentId], date, subject]);
    return result.rows[0];
  }

  // Undo a soft delete - restore a recently deleted attendance record
  static async undoDelete(studentId, date, subject = null) {
    const allIds = await this._getAllIdsForStudent(studentId);
    const query = `
      UPDATE attendance SET is_deleted = false, deleted_at = NULL
      WHERE student_id = ANY($1) AND date = $2 AND (subject = $3 OR (subject IS NULL AND $3 IS NULL)) AND is_deleted = true
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;
    const result = await pool.query(query, [allIds.length > 0 ? allIds : [studentId], date, subject]);
    return result.rows[0];
  }

  // Get recently soft-deleted records (for undo UI)
  static async getRecentDeletes(minutes = 30) {
    const query = `
      SELECT a.id, a.student_id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, a.status, a.subject, a.deleted_at,
             s.name as student_name, s.korean_name
      FROM attendance a
      LEFT JOIN students s ON s.id = a.student_id
      WHERE a.is_deleted = true AND a.deleted_at >= NOW() - INTERVAL '1 minute' * $1
      ORDER BY a.deleted_at DESC
    `;
    const result = await pool.query(query, [minutes]);
    return result.rows;
  }

  // Get attendance summary for a student
  static async getStudentSummary(studentId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) as total_records
      FROM attendance
      WHERE student_id = $1 AND date >= $2 AND date <= $3 AND is_deleted = false
    `;
    const result = await pool.query(query, [studentId, startDate, endDate]);
    return result.rows[0];
  }

  // Get monthly summary for all students
  static async getMonthlySummary(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const query = `
      SELECT
        a.student_id,
        s.name,
        s.english_name,
        COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
        COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE a.date >= $1 AND a.date <= $2 AND a.is_deleted = false
      GROUP BY a.student_id, s.name, s.english_name
      ORDER BY s.name
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  // Get teacher assignments for students by month directly from shared database
  // Returns which teacher(s) each student has on each date
  static async getTeacherAssignments(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const result = await pool.query(
        `SELECT
          ast.student_id,
          TO_CHAR(a.date, 'YYYY-MM-DD') as date,
          STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) as teachers
        FROM assignments a
        JOIN assignment_students ast ON a.id = ast.assignment_id
        JOIN assignment_teachers att ON a.id = att.assignment_id
        JOIN teachers t ON att.teacher_id = t.id
        WHERE a.is_active = true
          AND a.date >= $1 AND a.date <= $2
        GROUP BY ast.student_id, a.date
        ORDER BY a.date, ast.student_id`,
        [startDate, endDate]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching teacher assignments:', error.message);
      return [];
    }
  }

  // Get notes for all students for a specific month
  // Remaps student_ids to canonical IDs (same as getByMonth)
  static async getNotesByMonth(year, month) {
    const [notesResult, idRemap] = await Promise.all([
      pool.query(`
        SELECT student_id, notes, subject
        FROM student_notes
        WHERE year = $1 AND month = $2
      `, [year, month]),
      this._getIdRemapTable()
    ]);

    return notesResult.rows.map(row => ({
      ...row,
      student_id: idRemap[row.student_id] || row.student_id
    }));
  }

  // Set note for a student (create or update) - now supports subject
  static async setNote(studentId, year, month, notes, subject = null) {
    const query = `
      INSERT INTO student_notes (student_id, year, month, notes, subject, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, year, month, subject)
      DO UPDATE SET
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, year, month, notes, subject]);
    return result.rows[0];
  }

  // Get all holidays
  static async getHolidays() {
    const query = `
      SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, name, created_at
      FROM holidays
      ORDER BY date
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get holidays for a specific month
  static async getHolidaysByMonth(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const query = `
      SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, name
      FROM holidays
      WHERE date >= $1 AND date <= $2
      ORDER BY date
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  // Add a holiday
  static async addHoliday(date, name) {
    const query = `
      INSERT INTO holidays (date, name)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') as date, name, created_at
    `;
    const result = await pool.query(query, [date, name]);
    return result.rows[0];
  }

  // Delete a holiday
  static async deleteHoliday(id) {
    const query = `
      DELETE FROM holidays
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Check if a date is a holiday
  static async isHoliday(date) {
    const query = `
      SELECT id FROM holidays WHERE date = $1
    `;
    const result = await pool.query(query, [date]);
    return result.rows.length > 0;
  }

  // ==================== TUITION METHODS ====================
  // Legacy single-subject tuition (student_tuition / tuition_payments) has been removed.
  // Use subject-based tuition methods below (student_subject_tuition / subject_tuition_payments).

  // ==================== TEACHER COMMISSION METHODS ====================

  // Get all unique teachers from the scheduler database (grouped by name)
  static async getTeachers() {
    try {
      const query = `
        SELECT MIN(id) as id, name
        FROM teachers
        WHERE is_active = true
        GROUP BY name
        ORDER BY name
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching teachers:', error.message);
      throw error;
    }
  }

  // Get teacher commission rate
  static async getTeacherCommission(teacherId) {
    const query = `
      SELECT teacher_id, commission_per_class, currency
      FROM teacher_commission
      WHERE teacher_id = $1
    `;
    const result = await pool.query(query, [teacherId]);
    return result.rows[0] || { teacher_id: teacherId, commission_per_class: 0, currency: 'PHP' };
  }

  // Set commission rate for a teacher
  static async setTeacherCommission(teacherId, commissionPerClass, currency = 'PHP') {
    const query = `
      INSERT INTO teacher_commission (teacher_id, commission_per_class, currency, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (teacher_id)
      DO UPDATE SET
        commission_per_class = EXCLUDED.commission_per_class,
        currency = EXCLUDED.currency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [teacherId, commissionPerClass, currency]);
    return result.rows[0];
  }

  // Get teacher payment status for a month
  static async getTeacherPayment(teacherId, year, month) {
    const query = `
      SELECT teacher_id, year, month, paid,
             TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date,
             notes
      FROM teacher_payments
      WHERE teacher_id = $1 AND year = $2 AND month = $3
    `;
    const result = await pool.query(query, [teacherId, year, month]);
    return result.rows[0] || { teacher_id: teacherId, year, month, paid: false };
  }

  // Set teacher payment status
  static async setTeacherPayment(teacherId, year, month, paid, paymentDate = null, notes = null) {
    const query = `
      INSERT INTO teacher_payments (teacher_id, year, month, paid, payment_date, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (teacher_id, year, month)
      DO UPDATE SET
        paid = EXCLUDED.paid,
        payment_date = EXCLUDED.payment_date,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date
    `;
    const result = await pool.query(query, [teacherId, year, month, paid, paymentDate, notes]);
    return result.rows[0];
  }

  // Toggle teacher payment status
  static async toggleTeacherPayment(teacherId, year, month) {
    const current = await this.getTeacherPayment(teacherId, year, month);
    const newPaid = !current.paid;
    const paymentDate = newPaid ? new Date().toISOString().split('T')[0] : null;
    return this.setTeacherPayment(teacherId, year, month, newPaid, paymentDate, current.notes);
  }

  // Get all teacher-student combinations with their commission info for a month
  // Each row is a student with their assigned teacher and class count
  static async getTeachersWithCommission(year, month) {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Get each student with their assigned teacher and class count
      const query = `
        WITH student_teachers AS (
          -- Get each student's primary teacher (the one with most assignments)
          SELECT DISTINCT ON (s.id)
            s.id as student_id,
            s.name as student_name,
            s.korean_name,
            s.english_name,
            t.id as teacher_id,
            t.name as teacher_name
          FROM assignment_students ast
          JOIN assignments a ON a.id = ast.assignment_id
          JOIN assignment_teachers att ON att.assignment_id = a.id
          JOIN students s ON s.id = ast.student_id
          JOIN teachers t ON t.id = att.teacher_id
          WHERE a.is_active = true AND s.is_active = true
          GROUP BY s.id, s.name, s.korean_name, s.english_name, t.id, t.name
          ORDER BY s.id, COUNT(*) DESC
        ),
        class_counts AS (
          -- Count present attendance for each student
          SELECT
            student_id,
            COUNT(*) as class_count
          FROM attendance
          WHERE date >= $3 AND date <= $4
            AND status = 'present' AND is_deleted = false
          GROUP BY student_id
        )
        SELECT
          st.student_id,
          st.student_name,
          st.korean_name,
          st.english_name,
          st.teacher_id,
          st.teacher_name,
          COALESCE(tc.commission_per_class, 0) as commission_per_class,
          COALESCE(tc.currency, 'PHP') as currency,
          COALESCE(cc.class_count, 0) as class_count,
          tp.paid,
          TO_CHAR(tp.payment_date, 'YYYY-MM-DD') as payment_date,
          tp.notes as payment_notes
        FROM student_teachers st
        LEFT JOIN teacher_student_commission tc ON tc.teacher_id = st.teacher_id AND tc.student_id = st.student_id
        LEFT JOIN teacher_student_payments tp ON tp.teacher_id = st.teacher_id AND tp.student_id = st.student_id AND tp.year = $1 AND tp.month = $2
        LEFT JOIN class_counts cc ON cc.student_id = st.student_id
        ORDER BY st.teacher_name, st.student_name
      `;

      const result = await pool.query(query, [year, month, startDate, endDate]);

      // Calculate total commission for each student-teacher row
      return result.rows.map(row => ({
        id: `${row.teacher_id}-${row.student_id}`, // Composite ID
        student_id: row.student_id,
        student_name: row.student_name,
        korean_name: row.korean_name,
        english_name: row.english_name,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        commission_per_class: parseFloat(row.commission_per_class) || 0,
        currency: row.currency || 'PHP',
        class_count: parseInt(row.class_count) || 0,
        total_commission: (parseFloat(row.commission_per_class) || 0) * (parseInt(row.class_count) || 0),
        paid: row.paid || false,
        payment_date: row.payment_date || null,
        payment_notes: row.payment_notes || null
      }));
    } catch (error) {
      console.error('Error fetching teachers with commission:', error.message);
      throw error;
    }
  }

  // Set commission rate for a teacher-student combination
  static async setTeacherStudentCommission(teacherId, studentId, commissionPerClass, currency = 'PHP') {
    const query = `
      INSERT INTO teacher_student_commission (teacher_id, student_id, commission_per_class, currency, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (teacher_id, student_id)
      DO UPDATE SET
        commission_per_class = EXCLUDED.commission_per_class,
        currency = EXCLUDED.currency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [teacherId, studentId, commissionPerClass, currency]);
    return result.rows[0];
  }

  // Toggle teacher-student payment status
  static async toggleTeacherStudentPayment(teacherId, studentId, year, month) {
    // Check current status
    const checkQuery = `
      SELECT paid FROM teacher_student_payments
      WHERE teacher_id = $1 AND student_id = $2 AND year = $3 AND month = $4
    `;
    const current = await pool.query(checkQuery, [teacherId, studentId, year, month]);
    const newPaid = !(current.rows[0]?.paid || false);
    const paymentDate = newPaid ? new Date().toISOString().split('T')[0] : null;

    const query = `
      INSERT INTO teacher_student_payments (teacher_id, student_id, year, month, paid, payment_date, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (teacher_id, student_id, year, month)
      DO UPDATE SET
        paid = EXCLUDED.paid,
        payment_date = EXCLUDED.payment_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date
    `;
    const result = await pool.query(query, [teacherId, studentId, year, month, newPaid, paymentDate]);
    return result.rows[0];
  }

  // ==================== SUBJECT-BASED TUITION METHODS ====================

  // Get all unique subjects from assignments
  static async getSubjects() {
    const query = `
      SELECT DISTINCT subject
      FROM assignments
      WHERE subject IS NOT NULL AND subject != ''
      ORDER BY subject
    `;
    const result = await pool.query(query);
    return result.rows.map(r => r.subject);
  }

  // Set tuition for a student-subject combination
  static async setSubjectTuition(studentId, subject, pricePerClass, currency = 'PHP') {
    const query = `
      INSERT INTO student_subject_tuition (student_id, subject, price_per_class, currency, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, subject)
      DO UPDATE SET
        price_per_class = EXCLUDED.price_per_class,
        currency = EXCLUDED.currency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, subject, pricePerClass, currency]);
    return result.rows[0];
  }

  // Toggle subject tuition payment status
  static async toggleSubjectPayment(studentId, subject, year, month) {
    // Check current status
    const checkQuery = `
      SELECT paid FROM subject_tuition_payments
      WHERE student_id = $1 AND subject = $2 AND year = $3 AND month = $4
    `;
    const current = await pool.query(checkQuery, [studentId, subject, year, month]);
    const newPaid = !(current.rows[0]?.paid || false);
    const paymentDate = newPaid ? new Date().toISOString().split('T')[0] : null;

    const query = `
      INSERT INTO subject_tuition_payments (student_id, subject, year, month, paid, payment_date, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, subject, year, month)
      DO UPDATE SET
        paid = EXCLUDED.paid,
        payment_date = EXCLUDED.payment_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date
    `;
    const result = await pool.query(query, [studentId, subject, year, month, newPaid, paymentDate]);
    return result.rows[0];
  }

  // Add a new subject row for a student
  static async addStudentSubject(studentId, subject) {
    const query = `
      INSERT INTO student_subject_tuition (student_id, subject, price_per_class, currency)
      VALUES ($1, $2, 0, 'PHP')
      ON CONFLICT (student_id, subject) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, subject]);
    return result.rows[0];
  }

  // Delete a subject row for a student
  static async deleteStudentSubject(studentId, subject) {
    const query = `
      DELETE FROM student_subject_tuition
      WHERE student_id = $1 AND subject = $2
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, subject]);

    // Also delete any payment records for this student-subject
    await pool.query(
      `DELETE FROM subject_tuition_payments WHERE student_id = $1 AND subject = $2`,
      [studentId, subject]
    );

    return result.rows[0];
  }

  // Get students with subject-based tuition for a month
  // Returns one row per student-subject combination
  static async getStudentsWithSubjectTuition(year, month) {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Run students + all supporting queries in parallel
      const [students, tuitionResult, attendanceResult, paymentsResult] = await Promise.all([
        this.getStudentsWithClasses(),
        // Tuition rates already include student-subject combos, no need for separate query
        pool.query('SELECT student_id, subject, price_per_class, currency FROM student_subject_tuition'),
        pool.query(
          `SELECT student_id, COUNT(*) as present_count
           FROM attendance WHERE date >= $1 AND date <= $2 AND status = 'present' AND is_deleted = false
           GROUP BY student_id`,
          [startDate, endDate]
        ),
        pool.query(
          `SELECT student_id, subject, paid, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date, notes
           FROM subject_tuition_payments WHERE year = $1 AND month = $2`,
          [year, month]
        ),
      ]);

      const tuitionMap = {};
      const studentSubjects = {};
      tuitionResult.rows.forEach(row => {
        const key = `${row.student_id}-${row.subject}`;
        tuitionMap[key] = { price_per_class: parseFloat(row.price_per_class), currency: row.currency || 'PHP' };
        if (!studentSubjects[row.student_id]) studentSubjects[row.student_id] = [];
        studentSubjects[row.student_id].push(row.subject);
      });

      const attendanceMap = {};
      attendanceResult.rows.forEach(row => { attendanceMap[row.student_id] = parseInt(row.present_count); });

      const paymentsMap = {};
      paymentsResult.rows.forEach(row => {
        paymentsMap[`${row.student_id}-${row.subject}`] = { paid: row.paid, payment_date: row.payment_date, notes: row.notes };
      });

      const result = [];
      students.forEach(student => {
        let subjects = studentSubjects[student.id] ? [...studentSubjects[student.id]] : [];
        if (student.subject && !subjects.includes(student.subject)) {
          subjects.unshift(student.subject);
        }
        if (subjects.length === 0) subjects = ['(No Subject)'];

        const presentCount = attendanceMap[student.id] || 0;

        subjects.forEach(subject => {
          const key = `${student.id}-${subject}`;
          const tuitionInfo = tuitionMap[key] || { price_per_class: 0, currency: 'PHP' };
          result.push({
            id: key,
            student_id: student.id,
            name: student.name,
            korean_name: student.korean_name,
            english_name: student.english_name,
            teacher_name: student.teacher_name,
            subject,
            price_per_class: tuitionInfo.price_per_class,
            currency: tuitionInfo.currency,
            present_count: presentCount,
            total_tuition: tuitionInfo.price_per_class * presentCount,
            paid: paymentsMap[key]?.paid || false,
            payment_date: paymentsMap[key]?.payment_date || null,
            payment_notes: paymentsMap[key]?.notes || null
          });
        });
      });

      return result;
    } catch (error) {
      console.error('Error fetching students with subject tuition:', error.message);
      throw error;
    }
  }

  // ==================== HIDDEN ROWS METHODS ====================

  // Get all hidden rows with student names
  static async getHiddenRows() {
    const query = `
      SELECT
        h.id,
        h.student_id,
        s.name as student_name,
        s.korean_name,
        s.english_name,
        h.subject,
        h.hidden_at,
        h.hidden_from_year,
        h.hidden_from_month
      FROM hidden_attendance_rows h
      LEFT JOIN students s ON s.id = h.student_id
      ORDER BY h.hidden_from_year DESC, h.hidden_from_month DESC, h.hidden_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Hide a student row (student-subject combination) from a specific month onwards
  static async hideRow(studentId, subject = null, year = null, month = null) {
    // If year/month not provided, use current date
    const now = new Date();
    const hiddenFromYear = year || now.getFullYear();
    const hiddenFromMonth = month || (now.getMonth() + 1);

    const query = `
      INSERT INTO hidden_attendance_rows (student_id, subject, hidden_from_year, hidden_from_month)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, subject)
      DO UPDATE SET
        hidden_from_year = EXCLUDED.hidden_from_year,
        hidden_from_month = EXCLUDED.hidden_from_month,
        hidden_at = CURRENT_TIMESTAMP
      RETURNING *, hidden_from_year, hidden_from_month
    `;
    const result = await pool.query(query, [studentId, subject, hiddenFromYear, hiddenFromMonth]);
    return result.rows[0];
  }

  // Unhide a student row
  static async unhideRow(studentId, subject = null) {
    const query = `
      DELETE FROM hidden_attendance_rows
      WHERE student_id = $1 AND (subject = $2 OR (subject IS NULL AND $2 IS NULL))
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, subject]);
    return result.rows[0];
  }

  // Check if a row is hidden
  static async isRowHidden(studentId, subject = null) {
    const query = `
      SELECT id FROM hidden_attendance_rows
      WHERE student_id = $1 AND (subject = $2 OR (subject IS NULL AND $2 IS NULL))
    `;
    const result = await pool.query(query, [studentId, subject]);
    return result.rows.length > 0;
  }
  // Bulk set attendance for multiple student-subject entries on a given date
  // studentEntries: array of { studentId, subject }
  // Returns the count of records affected
  static async bulkSetAttendance(studentEntries, date, status) {
    if (!studentEntries || studentEntries.length === 0) return 0;

    // Build batch VALUES clause: ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ...
    const values = [];
    const params = [];
    studentEntries.forEach((entry, i) => {
      const offset = i * 4;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, CURRENT_TIMESTAMP)`);
      params.push(entry.studentId, date, status, entry.subject || null);
    });

    const query = `
      INSERT INTO attendance (student_id, date, status, subject, updated_at)
      VALUES ${values.join(', ')}
      ON CONFLICT (student_id, date, subject)
      DO UPDATE SET
        status = EXCLUDED.status,
        is_deleted = false,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `;
    const result = await pool.query(query, params);
    return result.rowCount;
  }

  // Bulk soft-delete attendance for multiple student-subject entries on a given date
  static async bulkDeleteAttendance(studentEntries, date) {
    if (!studentEntries || studentEntries.length === 0) return 0;

    const conditions = [];
    const params = [date];
    studentEntries.forEach((entry, i) => {
      const sidIdx = i * 2 + 2;
      const subIdx = i * 2 + 3;
      conditions.push(`(student_id = $${sidIdx} AND subject IS NOT DISTINCT FROM $${subIdx})`);
      params.push(entry.studentId, entry.subject || null);
    });

    const query = `
      UPDATE attendance
      SET is_deleted = true, deleted_at = NOW()
      WHERE date = $1
        AND is_deleted = false
        AND (${conditions.join(' OR ')})
    `;
    const result = await pool.query(query, params);
    return result.rowCount;
  }

  // Bulk undo soft-delete for multiple student-subject entries on a given date
  static async bulkUndoDelete(studentEntries, date) {
    if (!studentEntries || studentEntries.length === 0) return 0;

    const conditions = [];
    const params = [date];
    studentEntries.forEach((entry, i) => {
      const sidIdx = i * 2 + 2;
      const subIdx = i * 2 + 3;
      conditions.push(`(student_id = $${sidIdx} AND subject IS NOT DISTINCT FROM $${subIdx})`);
      params.push(entry.studentId, entry.subject || null);
    });

    const query = `
      UPDATE attendance
      SET is_deleted = false, deleted_at = NULL
      WHERE date = $1
        AND is_deleted = true
        AND (${conditions.join(' OR ')})
    `;
    const result = await pool.query(query, params);
    return result.rowCount;
  }

  // Export data for monthly CSV
  // Returns students, attendance records, and holidays for the given month
  static async exportMonthlyCSV(year, month) {
    const [students, attendance, holidays] = await Promise.all([
      this.getStudentsWithClasses(year, month),
      this.getByMonth(year, month),
      this.getHolidaysByMonth(year, month)
    ]);

    return { students, attendance, holidays };
  }

  // Get a teacher's schedule for a given date (students, subjects, time slots, attendance)
  static async getTeacherSchedule(teacherName, date) {
    try {
      // Derive the day name from the date for matching assignments.date (which stores day names like 'Monday')
      const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

      const query = `
        SELECT s.name, s.korean_name, a.subject,
               TO_CHAR(ts.start_time, 'HH:MI AM') as start_time,
               TO_CHAR(ts.end_time, 'HH:MI AM') as end_time,
               att.status as attendance_status
        FROM assignment_students ast
        JOIN students s ON s.id = ast.student_id
        JOIN assignments a ON a.id = ast.assignment_id
        JOIN time_slots ts ON ts.id = a.time_slot_id
        JOIN assignment_teachers ateach ON ateach.assignment_id = a.id
        JOIN teachers t ON t.id = ateach.teacher_id
        LEFT JOIN attendance att ON att.student_id = s.id
          AND att.date = $2 AND att.subject = a.subject AND att.is_deleted = false
        WHERE t.name = $1 AND a.date = $3 AND a.is_active = true
        ORDER BY ts.start_time, s.name
      `;

      const result = await pool.query(query, [teacherName, date, dayName]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching teacher schedule:', error.message);
      throw error;
    }
  }
}

module.exports = Attendance;
