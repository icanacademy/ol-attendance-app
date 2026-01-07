const pool = require('../db/connection');
const axios = require('axios');

// Online Scheduler API URL
const SCHEDULER_API_URL = process.env.SCHEDULER_API_URL || 'http://localhost:4488/api';

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
  // Get all students from the online scheduler API with their primary teacher from database
  // Returns one row per student-subject combination (students with multiple subjects get multiple rows)
  // If year and month are provided, filters hidden rows based on hidden_from date
  static async getStudentsWithClasses(year = null, month = null) {
    try {
      // Fetch students from online scheduler API
      // Use /all-active endpoint to get ALL students including those with duplicate names
      const studentsResponse = await axios.get(`${SCHEDULER_API_URL}/students/all-active`);
      const students = studentsResponse.data;


      // Get all subjects for each student from database
      // This returns multiple rows per student if they have multiple subjects
      // Group by time slot to show different schedules separately
      const studentSubjectsQuery = `
        SELECT
          s.id as student_id,
          s.name as student_name,
          a.subject,
          t.name as teacher_name,
          TO_CHAR(ts.start_time, 'HH:MI AM') as start_time,
          TO_CHAR(ts.end_time, 'HH:MI AM') as end_time,
          ARRAY_AGG(DISTINCT EXTRACT(DOW FROM a.date)::int ORDER BY EXTRACT(DOW FROM a.date)::int) as days
        FROM assignment_students ast
        JOIN students s ON s.id = ast.student_id
        JOIN assignments a ON a.id = ast.assignment_id
        JOIN time_slots ts ON ts.id = a.time_slot_id
        LEFT JOIN assignment_teachers att ON att.assignment_id = a.id
        LEFT JOIN teachers t ON t.id = att.teacher_id
        WHERE a.is_active = true AND s.is_active = true
        GROUP BY s.id, s.name, a.subject, t.name, ts.start_time, ts.end_time
        ORDER BY s.name, a.subject, ts.start_time
      `;

      let studentSubjectsMap = {}; // { student_id: [{ subject, teacher, schedules }] }
      const dayNames = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];

      // Helper function to merge consecutive time slots with the same days
      // e.g., [7:00-7:30 MWF, 7:30-8:00 MWF] -> [7:00-8:00 MWF]
      const mergeConsecutiveSchedules = (schedules) => {
        if (!schedules || schedules.length === 0) return [];

        // Sort by days first, then by start time
        const sorted = [...schedules].sort((a, b) => {
          if (a.days !== b.days) return a.days.localeCompare(b.days);
          return a.startTime.localeCompare(b.startTime);
        });

        const merged = [];
        let current = { ...sorted[0] };

        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          // Check if same days and consecutive times (current end == next start)
          if (current.days === next.days && current.endTime === next.startTime) {
            // Merge: extend current end time
            current.endTime = next.endTime;
            current.time = `${current.startTime} - ${current.endTime}`;
          } else {
            // Not consecutive, push current and start new
            merged.push({ time: current.time, days: current.days });
            current = { ...next };
          }
        }
        // Push the last one
        merged.push({ time: current.time, days: current.days });

        return merged;
      };

      try {
        const result = await pool.query(studentSubjectsQuery);
        result.rows.forEach(row => {
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

          // Check if we already have this subject for this student
          const existingSubject = studentSubjectsMap[row.student_id].find(
            s => s.subject === row.subject
          );

          if (existingSubject) {
            // Add this schedule to existing subject entry
            if (scheduleEntry.time && scheduleEntry.days) {
              existingSubject.schedules.push(scheduleEntry);
            }
          } else {
            // Create new subject entry with schedules array
            studentSubjectsMap[row.student_id].push({
              subject: row.subject || null,
              teacher_name: row.teacher_name || null,
              schedules: scheduleEntry.time && scheduleEntry.days ? [scheduleEntry] : []
            });
          }
        });

        // Merge consecutive time slots for each student-subject
        Object.values(studentSubjectsMap).forEach(subjects => {
          subjects.forEach(subjectInfo => {
            if (subjectInfo.schedules && subjectInfo.schedules.length > 0) {
              subjectInfo.schedules = mergeConsecutiveSchedules(subjectInfo.schedules);
            }
          });
        });
      } catch (err) {
        console.log('Could not fetch student subjects from database:', err.message);
      }

      // Also check student_subject_tuition table for any additional subjects
      // (in case subjects were manually added there)
      try {
        const tuitionSubjectsResult = await pool.query(
          'SELECT DISTINCT student_id, subject FROM student_subject_tuition'
        );
        tuitionSubjectsResult.rows.forEach(row => {
          if (!studentSubjectsMap[row.student_id]) {
            studentSubjectsMap[row.student_id] = [];
          }
          // Add if not already present
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
      } catch (err) {
        console.log('Could not fetch tuition subjects:', err.message);
      }

      // Build result: one row per student-subject combination
      const result = [];

      students
        .filter(s => s.is_active)
        .forEach(student => {
          const subjects = studentSubjectsMap[student.id];

          if (subjects && subjects.length > 0) {
            // Student has subjects - create one row per subject
            subjects.forEach(subjectInfo => {
              // Format schedules array into display strings
              // Each schedule entry has { time, days }
              const schedules = subjectInfo.schedules || [];

              // Create formatted schedule strings for display
              // e.g., ["M 4:00 PM - 4:50 PM", "TTh 5:00 PM - 5:50 PM"]
              const formattedSchedules = schedules.map(s => ({
                time: s.time,
                days: s.days
              }));

              result.push({
                id: student.id,
                name: student.name,
                korean_name: student.korean_name || null,
                english_name: student.english_name,
                color_keyword: student.color_keyword,
                teacher_name: subjectInfo.teacher_name,
                // Keep backward compatibility with single schedule fields
                schedule_time: schedules.length > 0 ? schedules[0].time : null,
                schedule_days: schedules.length > 0 ? schedules[0].days : null,
                // New: array of all schedules for this student-subject
                schedules: formattedSchedules,
                subject: subjectInfo.subject,
                // Unique key for this student-subject row
                row_key: `${student.id}-${subjectInfo.subject || 'default'}`
              });
            });
          } else {
            // Student has no subjects - create a single row with no subject
            result.push({
              id: student.id,
              name: student.name,
              korean_name: student.korean_name || null,
              english_name: student.english_name,
              color_keyword: student.color_keyword,
              teacher_name: null,
              schedule_time: null,
              schedule_days: null,
              schedules: [],
              subject: null,
              row_key: `${student.id}-default`
            });
          }
        });

      // Get hidden rows to filter them out
      let hiddenRows = [];
      try {
        const hiddenResult = await pool.query('SELECT student_id, subject, hidden_from_year, hidden_from_month FROM hidden_attendance_rows');
        hiddenRows = hiddenResult.rows;
      } catch (err) {
        console.log('Could not fetch hidden rows (table may not exist yet):', err.message);
      }

      // Filter out hidden rows based on date
      // If year/month provided, only hide if hidden_from date <= current view date
      const filteredResult = result.filter(student => {
        const isHidden = hiddenRows.some(hidden => {
          // Check if this hidden row matches the student
          const matchesStudent = hidden.student_id === student.id &&
            (hidden.subject === student.subject || (hidden.subject === null && student.subject === null));

          if (!matchesStudent) return false;

          // If no year/month provided or no hidden_from date, use legacy behavior (always hidden)
          if (!year || !month || !hidden.hidden_from_year || !hidden.hidden_from_month) {
            return true;
          }

          // Compare dates: hide only if current view is >= hidden_from date
          const viewDate = year * 12 + month;
          const hiddenFromDate = hidden.hidden_from_year * 12 + hidden.hidden_from_month;
          return viewDate >= hiddenFromDate;
        });
        return !isHidden;
      });

      // Sort by name then subject
      return filteredResult.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.subject || '').localeCompare(b.subject || '');
      });
    } catch (error) {
      console.error('Error fetching students from online scheduler:', error.message);
      throw new Error('Failed to fetch students from online scheduler. Make sure the online scheduler is running on port 4488.');
    }
  }

  // Get attendance records for a specific month
  static async getByMonth(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const query = `
      SELECT
        a.id,
        a.student_id,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        a.status,
        a.notes,
        a.subject
      FROM attendance a
      WHERE a.date >= $1 AND a.date <= $2
      ORDER BY a.date, a.student_id, a.subject
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
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
      WHERE a.student_id = $1 AND a.date >= $2 AND a.date <= $3
      ORDER BY a.date
    `;
    const result = await pool.query(query, [studentId, startDate, endDate]);
    return result.rows;
  }

  // Set attendance (create or update) - now supports subject
  static async setAttendance(studentId, date, status, notes = null, subject = null) {
    const query = `
      INSERT INTO attendance (student_id, date, status, notes, subject, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, date, subject)
      DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;
    const result = await pool.query(query, [studentId, date, status, notes, subject]);
    return result.rows[0];
  }

  // Toggle attendance status (cycles: present -> absent -> ta -> noshow -> clear)
  static async toggleAttendance(studentId, date, subject = null) {
    // First check if record exists
    const checkQuery = `
      SELECT id, status FROM attendance
      WHERE student_id = $1 AND date = $2 AND (subject = $3 OR (subject IS NULL AND $3 IS NULL))
    `;
    const existing = await pool.query(checkQuery, [studentId, date, subject]);

    if (existing.rows.length === 0) {
      // No record exists, create as present
      return this.setAttendance(studentId, date, 'present', null, subject);
    } else {
      const currentStatus = existing.rows[0].status;
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

  // Delete attendance record - now supports subject
  static async delete(studentId, date, subject = null) {
    const query = `
      DELETE FROM attendance
      WHERE student_id = $1 AND date = $2 AND (subject = $3 OR (subject IS NULL AND $3 IS NULL))
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, date, subject]);
    return result.rows[0];
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
      WHERE student_id = $1 AND date >= $2 AND date <= $3
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
      WHERE a.date >= $1 AND a.date <= $2
      GROUP BY a.student_id, s.name, s.english_name
      ORDER BY s.name
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  // Get teacher assignments for students by month from online scheduler API
  // Returns which teacher(s) each student has on each date
  static async getTeacherAssignments(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();

    try {
      const response = await axios.get(`${SCHEDULER_API_URL}/assignments/date-range`, {
        params: { startDate, daysCount: lastDay }
      });

      const assignments = response.data;

      // Transform assignments to the format expected by the attendance app
      // Group by student_id and date, collecting teacher names
      const teacherMap = {};

      assignments.forEach(assignment => {
        if (!assignment.is_active) return;

        assignment.students.forEach(student => {
          const date = assignment.date.split('T')[0];
          const key = `${student.id}-${date}`;

          if (!teacherMap[key]) {
            teacherMap[key] = {
              student_id: student.id,
              date,
              teacherSet: new Set()
            };
          }

          assignment.teachers.forEach(teacher => {
            teacherMap[key].teacherSet.add(teacher.name);
          });
        });
      });

      // Convert to array and format teachers as comma-separated string
      return Object.values(teacherMap).map(item => ({
        student_id: item.student_id,
        date: item.date,
        teachers: Array.from(item.teacherSet).sort().join(', ')
      }));
    } catch (error) {
      console.error('Error fetching teacher assignments from online scheduler:', error.message);
      return []; // Return empty array if API fails
    }
  }

  // Get notes for all students for a specific month
  static async getNotesByMonth(year, month) {
    const query = `
      SELECT student_id, notes, subject
      FROM student_notes
      WHERE year = $1 AND month = $2
    `;
    const result = await pool.query(query, [year, month]);
    return result.rows;
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

  // Get all tuition fees (price per class)
  static async getAllTuition() {
    const query = `
      SELECT student_id, price_per_class
      FROM student_tuition
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get tuition fee for a specific student
  static async getTuition(studentId) {
    const query = `
      SELECT student_id, price_per_class
      FROM student_tuition
      WHERE student_id = $1
    `;
    const result = await pool.query(query, [studentId]);
    return result.rows[0] || { student_id: studentId, price_per_class: 0 };
  }

  // Set price per class for a student (with currency)
  static async setTuition(studentId, pricePerClass, currency = 'PHP') {
    const query = `
      INSERT INTO student_tuition (student_id, price_per_class, currency, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id)
      DO UPDATE SET
        price_per_class = EXCLUDED.price_per_class,
        currency = EXCLUDED.currency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, pricePerClass, currency]);
    return result.rows[0];
  }

  // Get all payments for a specific month
  static async getPaymentsByMonth(year, month) {
    const query = `
      SELECT student_id, year, month, paid,
             TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date,
             notes
      FROM tuition_payments
      WHERE year = $1 AND month = $2
    `;
    const result = await pool.query(query, [year, month]);
    return result.rows;
  }

  // Get payment status for a specific student and month
  static async getPayment(studentId, year, month) {
    const query = `
      SELECT student_id, year, month, paid,
             TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date,
             notes
      FROM tuition_payments
      WHERE student_id = $1 AND year = $2 AND month = $3
    `;
    const result = await pool.query(query, [studentId, year, month]);
    return result.rows[0] || { student_id: studentId, year, month, paid: false };
  }

  // Set payment status for a student
  static async setPayment(studentId, year, month, paid, paymentDate = null, notes = null) {
    const query = `
      INSERT INTO tuition_payments (student_id, year, month, paid, payment_date, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, year, month)
      DO UPDATE SET
        paid = EXCLUDED.paid,
        payment_date = EXCLUDED.payment_date,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date
    `;
    const result = await pool.query(query, [studentId, year, month, paid, paymentDate, notes]);
    return result.rows[0];
  }

  // Toggle payment status
  static async togglePayment(studentId, year, month) {
    const current = await this.getPayment(studentId, year, month);
    const newPaid = !current.paid;
    const paymentDate = newPaid ? new Date().toISOString().split('T')[0] : null;
    return this.setPayment(studentId, year, month, newPaid, paymentDate, current.notes);
  }

  // Get students with tuition and payment info for a month
  static async getStudentsWithTuition(year, month) {
    try {
      // Get students from online scheduler
      const students = await this.getStudentsWithClasses();

      // Get all price per class rates and currencies
      const tuitionResult = await pool.query('SELECT student_id, price_per_class, currency FROM student_tuition');
      const tuitionMap = {};
      tuitionResult.rows.forEach(row => {
        tuitionMap[row.student_id] = {
          price_per_class: parseFloat(row.price_per_class),
          currency: row.currency || 'PHP'
        };
      });

      // Get attendance counts for this month (only 'present' status)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const attendanceResult = await pool.query(
        `SELECT student_id, COUNT(*) as present_count
         FROM attendance
         WHERE date >= $1 AND date <= $2 AND status = 'present'
         GROUP BY student_id`,
        [startDate, endDate]
      );
      const attendanceMap = {};
      attendanceResult.rows.forEach(row => {
        attendanceMap[row.student_id] = parseInt(row.present_count);
      });

      // Get all payments for this month
      const paymentsResult = await pool.query(
        `SELECT student_id, paid, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date, notes
         FROM tuition_payments WHERE year = $1 AND month = $2`,
        [year, month]
      );
      const paymentsMap = {};
      paymentsResult.rows.forEach(row => {
        paymentsMap[row.student_id] = {
          paid: row.paid,
          payment_date: row.payment_date,
          notes: row.notes
        };
      });

      // Merge data and calculate total tuition
      return students.map(student => {
        const tuitionInfo = tuitionMap[student.id] || { price_per_class: 0, currency: 'PHP' };
        const pricePerClass = tuitionInfo.price_per_class;
        const currency = tuitionInfo.currency;
        const presentCount = attendanceMap[student.id] || 0;
        const totalTuition = pricePerClass * presentCount;

        return {
          ...student,
          price_per_class: pricePerClass,
          currency: currency,
          present_count: presentCount,
          total_tuition: totalTuition,
          paid: paymentsMap[student.id]?.paid || false,
          payment_date: paymentsMap[student.id]?.payment_date || null,
          payment_notes: paymentsMap[student.id]?.notes || null
        };
      });
    } catch (error) {
      console.error('Error fetching students with tuition:', error.message);
      throw error;
    }
  }

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
            AND status = 'present'
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
      // Get students from online scheduler
      const students = await this.getStudentsWithClasses();

      // Get all subject tuition rates
      const tuitionResult = await pool.query(
        'SELECT student_id, subject, price_per_class, currency FROM student_subject_tuition'
      );
      const tuitionMap = {};
      tuitionResult.rows.forEach(row => {
        const key = `${row.student_id}-${row.subject}`;
        tuitionMap[key] = {
          price_per_class: parseFloat(row.price_per_class),
          currency: row.currency || 'PHP'
        };
      });

      // Get attendance counts for this month (only 'present' status)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const attendanceResult = await pool.query(
        `SELECT student_id, COUNT(*) as present_count
         FROM attendance
         WHERE date >= $1 AND date <= $2 AND status = 'present'
         GROUP BY student_id`,
        [startDate, endDate]
      );
      const attendanceMap = {};
      attendanceResult.rows.forEach(row => {
        attendanceMap[row.student_id] = parseInt(row.present_count);
      });

      // Get all subject payments for this month
      const paymentsResult = await pool.query(
        `SELECT student_id, subject, paid, TO_CHAR(payment_date, 'YYYY-MM-DD') as payment_date, notes
         FROM subject_tuition_payments WHERE year = $1 AND month = $2`,
        [year, month]
      );
      const paymentsMap = {};
      paymentsResult.rows.forEach(row => {
        const key = `${row.student_id}-${row.subject}`;
        paymentsMap[key] = {
          paid: row.paid,
          payment_date: row.payment_date,
          notes: row.notes
        };
      });

      // Get all student-subject combinations from tuition table
      const studentSubjectsResult = await pool.query(
        'SELECT DISTINCT student_id, subject FROM student_subject_tuition ORDER BY student_id, subject'
      );
      const studentSubjects = {};
      studentSubjectsResult.rows.forEach(row => {
        if (!studentSubjects[row.student_id]) {
          studentSubjects[row.student_id] = [];
        }
        studentSubjects[row.student_id].push(row.subject);
      });

      // Build result: one row per student-subject
      const result = [];

      students.forEach(student => {
        // Get subjects for this student from tuition table
        let subjects = studentSubjects[student.id] ? [...studentSubjects[student.id]] : [];

        // Always include the student's default subject from scheduler if they have one
        // This ensures the default subject is shown even after adding other subjects
        if (student.subject && !subjects.includes(student.subject)) {
          subjects.unshift(student.subject); // Add at beginning so default shows first
        }

        // If still no subjects, create a default entry
        if (subjects.length === 0) {
          subjects = ['(No Subject)'];
        }

        const presentCount = attendanceMap[student.id] || 0;

        subjects.forEach(subject => {
          const key = `${student.id}-${subject}`;
          const tuitionInfo = tuitionMap[key] || { price_per_class: 0, currency: 'PHP' };
          const pricePerClass = tuitionInfo.price_per_class;
          const currency = tuitionInfo.currency;
          const totalTuition = pricePerClass * presentCount;

          result.push({
            id: key,
            student_id: student.id,
            name: student.name,
            korean_name: student.korean_name,
            english_name: student.english_name,
            teacher_name: student.teacher_name,
            subject: subject,
            price_per_class: pricePerClass,
            currency: currency,
            present_count: presentCount,
            total_tuition: totalTuition,
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
}

module.exports = Attendance;
