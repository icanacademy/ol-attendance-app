const Attendance = require('../models/Attendance');

// Get all students with classes
// Accepts optional year and month query params for date-aware hidden row filtering
exports.getStudents = async (req, res) => {
  try {
    const { year, month } = req.query;
    const students = await Attendance.getStudentsWithClasses(
      year ? parseInt(year) : null,
      month ? parseInt(month) : null
    );
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Get attendance for a specific month
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const attendance = await Attendance.getByMonth(
      parseInt(year),
      parseInt(month)
    );
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// Set attendance for a student on a specific date (with optional subject)
exports.setAttendance = async (req, res) => {
  try {
    const { studentId, date, status, notes, subject } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({
        error: 'studentId, date, and status are required'
      });
    }

    if (!['present', 'absent', 'ta', 'noshow'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be "present", "absent", "ta", or "noshow"'
      });
    }

    const record = await Attendance.setAttendance(studentId, date, status, notes, subject || null);
    res.json(record);
  } catch (error) {
    console.error('Error setting attendance:', error);
    res.status(500).json({ error: 'Failed to set attendance' });
  }
};

// Bulk set attendance for multiple students on a specific date
exports.bulkSetAttendance = async (req, res) => {
  try {
    const { entries, date, status } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0 || !date || !status) {
      return res.status(400).json({
        error: 'entries (non-empty array), date, and status are required'
      });
    }

    if (!['present', 'absent', 'ta', 'noshow'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be "present", "absent", "ta", or "noshow"'
      });
    }

    const count = await Attendance.bulkSetAttendance(entries, date, status);
    res.json({ count });
  } catch (error) {
    console.error('Error bulk setting attendance:', error);
    res.status(500).json({ error: 'Failed to bulk set attendance' });
  }
};

exports.bulkDeleteAttendance = async (req, res) => {
  try {
    const { entries, date } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0 || !date) {
      return res.status(400).json({ error: 'entries (non-empty array) and date are required' });
    }
    const count = await Attendance.bulkDeleteAttendance(entries, date);
    res.json({ count });
  } catch (error) {
    console.error('Error bulk deleting attendance:', error);
    res.status(500).json({ error: 'Failed to bulk delete attendance' });
  }
};

exports.bulkUndoDelete = async (req, res) => {
  try {
    const { entries, date } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0 || !date) {
      return res.status(400).json({ error: 'entries (non-empty array) and date are required' });
    }
    const count = await Attendance.bulkUndoDelete(entries, date);
    res.json({ count });
  } catch (error) {
    console.error('Error bulk undo delete:', error);
    res.status(500).json({ error: 'Failed to bulk undo delete' });
  }
};

// Toggle attendance status (with optional subject)
exports.toggleAttendance = async (req, res) => {
  try {
    const { studentId, date, subject } = req.body;

    if (!studentId || !date) {
      return res.status(400).json({
        error: 'studentId and date are required'
      });
    }

    const record = await Attendance.toggleAttendance(studentId, date, subject || null);
    res.json(record);
  } catch (error) {
    console.error('Error toggling attendance:', error);
    res.status(500).json({ error: 'Failed to toggle attendance' });
  }
};

// Undo a soft-deleted attendance record
exports.undoDelete = async (req, res) => {
  try {
    const { studentId, date, subject } = req.body;

    if (!studentId || !date) {
      return res.status(400).json({
        error: 'studentId and date are required'
      });
    }

    const record = await Attendance.undoDelete(parseInt(studentId), date, subject || null);

    if (!record) {
      return res.status(404).json({ error: 'No deleted record found to undo' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error undoing delete:', error);
    res.status(500).json({ error: 'Failed to undo delete' });
  }
};

// Get recently soft-deleted attendance records
exports.getRecentDeletes = async (req, res) => {
  try {
    const { minutes } = req.query;
    const records = await Attendance.getRecentDeletes(minutes ? parseInt(minutes) : 30);
    res.json(records);
  } catch (error) {
    console.error('Error fetching recent deletes:', error);
    res.status(500).json({ error: 'Failed to fetch recent deletes' });
  }
};

// Delete attendance record (with optional subject)
exports.deleteAttendance = async (req, res) => {
  try {
    const { studentId, date, subject } = req.query;

    if (!studentId || !date) {
      return res.status(400).json({
        error: 'studentId and date are required'
      });
    }

    const deleted = await Attendance.delete(parseInt(studentId), date, subject || null);

    if (!deleted) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance record deleted', record: deleted });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ error: 'Failed to delete attendance' });
  }
};

// Get class count for a date range
exports.getClassCountRange = async (req, res) => {
  try {
    const { startDate, endDate, statuses, teacherId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Parse statuses from comma-separated string
    const statusList = statuses ? statuses.split(',').filter(s => s.trim()) : ['present'];

    const result = await Attendance.getClassCountRange(
      startDate,
      endDate,
      statusList,
      teacherId ? parseInt(teacherId) : null
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching class count range:', error);
    res.status(500).json({ error: 'Failed to fetch class count range' });
  }
};

// Get monthly summary
exports.getMonthlySummary = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const summary = await Attendance.getMonthlySummary(
      parseInt(year),
      parseInt(month)
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
};

// Get student summary for a month
exports.getStudentSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const summary = await Attendance.getStudentSummary(
      parseInt(studentId),
      parseInt(year),
      parseInt(month)
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching student summary:', error);
    res.status(500).json({ error: 'Failed to fetch student summary' });
  }
};

// Get teacher assignments for a month
exports.getTeacherAssignments = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const assignments = await Attendance.getTeacherAssignments(
      parseInt(year),
      parseInt(month)
    );
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ error: 'Failed to fetch teacher assignments' });
  }
};

// Get notes for a month
exports.getNotes = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const notes = await Attendance.getNotesByMonth(
      parseInt(year),
      parseInt(month)
    );
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

// Set note for a student (with optional subject)
exports.setNote = async (req, res) => {
  try {
    const { studentId, year, month, notes, subject } = req.body;

    if (!studentId || !year || !month) {
      return res.status(400).json({
        error: 'studentId, year, and month are required'
      });
    }

    const result = await Attendance.setNote(studentId, year, month, notes || '', subject || null);
    res.json(result);
  } catch (error) {
    console.error('Error setting note:', error);
    res.status(500).json({ error: 'Failed to set note' });
  }
};

// Admin password for protected routes - loaded from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const { generateToken } = require('../middleware/auth');

if (!ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD environment variable is not set. Admin routes will be inaccessible.');
}

// Verify admin password and return JWT token
exports.verifyAdmin = async (req, res) => {
  try {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      const token = generateToken();
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Error verifying admin:', error);
    res.status(500).json({ error: 'Failed to verify' });
  }
};

// Get all holidays
exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Attendance.getHolidays();
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

// Get holidays for a specific month
exports.getHolidaysByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const holidays = await Attendance.getHolidaysByMonth(
      parseInt(year),
      parseInt(month)
    );
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

// Add a holiday (admin only)
exports.addHoliday = async (req, res) => {
  try {
    const { date, name, password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const holiday = await Attendance.addHoliday(date, name || '');
    res.json(holiday);
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
};

// Delete a holiday (admin only)
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Auth handled by requireAdmin middleware

    const deleted = await Attendance.deleteHoliday(parseInt(id));

    if (!deleted) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ message: 'Holiday deleted', holiday: deleted });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
};

// ==================== TEACHER COMMISSION ENDPOINTS ====================

// Get all teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Attendance.getTeachers();
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
};

// Get teachers with commission info for a month
exports.getTeachersWithCommission = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const teachers = await Attendance.getTeachersWithCommission(
      parseInt(year),
      parseInt(month)
    );
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers with commission:', error);
    res.status(500).json({ error: 'Failed to fetch teachers with commission' });
  }
};

// Set commission rate for a teacher-student combination (admin only)
exports.setTeacherCommission = async (req, res) => {
  try {
    const { teacherId, studentId, commissionPerClass, currency, password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!teacherId || !studentId || commissionPerClass === undefined) {
      return res.status(400).json({ error: 'teacherId, studentId, and commissionPerClass are required' });
    }

    // Validate currency
    const validCurrencies = ['PHP', 'KRW'];
    const currencyValue = currency && validCurrencies.includes(currency) ? currency : 'PHP';

    const result = await Attendance.setTeacherStudentCommission(
      parseInt(teacherId),
      parseInt(studentId),
      parseFloat(commissionPerClass),
      currencyValue
    );
    res.json(result);
  } catch (error) {
    console.error('Error setting teacher commission:', error);
    res.status(500).json({ error: 'Failed to set teacher commission' });
  }
};

// Toggle teacher-student payment status (admin only)
exports.toggleTeacherPayment = async (req, res) => {
  try {
    const { teacherId, studentId, year, month, password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!teacherId || !studentId || !year || !month) {
      return res.status(400).json({ error: 'teacherId, studentId, year, and month are required' });
    }

    const result = await Attendance.toggleTeacherStudentPayment(
      parseInt(teacherId),
      parseInt(studentId),
      parseInt(year),
      parseInt(month)
    );
    res.json(result);
  } catch (error) {
    console.error('Error toggling teacher payment:', error);
    res.status(500).json({ error: 'Failed to toggle teacher payment' });
  }
};

// ==================== SUBJECT-BASED TUITION ENDPOINTS ====================

// Get all subjects
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Attendance.getSubjects();
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
};

// Get students with subject-based tuition for a month
exports.getStudentsWithSubjectTuition = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const students = await Attendance.getStudentsWithSubjectTuition(
      parseInt(year),
      parseInt(month)
    );
    res.json(students);
  } catch (error) {
    console.error('Error fetching students with subject tuition:', error);
    res.status(500).json({ error: 'Failed to fetch students with subject tuition' });
  }
};

// Set subject tuition for a student (admin only - auth handled by requireAdmin middleware)
exports.setSubjectTuition = async (req, res) => {
  try {
    const { studentId, subject, pricePerClass, currency } = req.body;

    if (!studentId || !subject || pricePerClass === undefined) {
      return res.status(400).json({ error: 'studentId, subject, and pricePerClass are required' });
    }

    // Validate currency
    const validCurrencies = ['PHP', 'KRW'];
    const currencyValue = currency && validCurrencies.includes(currency) ? currency : 'PHP';

    const result = await Attendance.setSubjectTuition(
      parseInt(studentId),
      subject,
      parseFloat(pricePerClass),
      currencyValue
    );
    res.json(result);
  } catch (error) {
    console.error('Error setting subject tuition:', error);
    res.status(500).json({ error: 'Failed to set subject tuition' });
  }
};

// Toggle subject tuition payment status (admin only)
exports.toggleSubjectPayment = async (req, res) => {
  try {
    const { studentId, subject, year, month, password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!studentId || !subject || !year || !month) {
      return res.status(400).json({ error: 'studentId, subject, year, and month are required' });
    }

    const result = await Attendance.toggleSubjectPayment(
      parseInt(studentId),
      subject,
      parseInt(year),
      parseInt(month)
    );
    res.json(result);
  } catch (error) {
    console.error('Error toggling subject payment:', error);
    res.status(500).json({ error: 'Failed to toggle subject payment' });
  }
};

// Add a subject for a student (admin only)
exports.addStudentSubject = async (req, res) => {
  try {
    const { studentId, subject, password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!studentId || !subject) {
      return res.status(400).json({ error: 'studentId and subject are required' });
    }

    const result = await Attendance.addStudentSubject(parseInt(studentId), subject);
    res.json(result || { message: 'Subject already exists for this student' });
  } catch (error) {
    console.error('Error adding student subject:', error);
    res.status(500).json({ error: 'Failed to add student subject' });
  }
};

// Delete a subject for a student (admin only)
exports.deleteStudentSubject = async (req, res) => {
  try {
    const { studentId, subject } = req.query;
    const { password } = req.body;

    // Auth handled by requireAdmin middleware

    if (!studentId || !subject) {
      return res.status(400).json({ error: 'studentId and subject are required' });
    }

    const result = await Attendance.deleteStudentSubject(parseInt(studentId), subject);
    res.json(result || { message: 'Subject not found' });
  } catch (error) {
    console.error('Error deleting student subject:', error);
    res.status(500).json({ error: 'Failed to delete student subject' });
  }
};

// Export attendance as CSV
exports.exportCSV = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const { students, attendance, holidays } = await Attendance.exportMonthlyCSV(y, m);

    // Build attendance lookup map
    const attendanceMap = {};
    attendance.forEach(record => {
      const dateStr = record.date.split('T')[0];
      const key = `${record.student_id}-${record.subject || 'default'}-${dateStr}`;
      attendanceMap[key] = record.status;
    });

    // Build holidays lookup set
    const holidaySet = new Set(holidays.map(h => h.date));

    // Build CSV
    const daysInMonth = new Date(y, m, 0).getDate();
    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Escape CSV field (wrap in quotes if it contains comma, quote, or newline)
    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Header row
    const headerRow = ['Student Name', 'Korean Name', 'Subject', 'Teacher']
      .concat(dayHeaders)
      .map(escapeCSV)
      .join(',');

    // Data rows
    const dataRows = students.map(student => {
      const statusMap = { present: 'P', absent: 'A', ta: 'TA', noshow: 'N' };
      const dayCells = dayHeaders.map(day => {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (holidaySet.has(dateStr)) return 'H';
        const key = `${student.id}-${student.subject || 'default'}-${dateStr}`;
        const status = attendanceMap[key];
        return status ? (statusMap[status] || '') : '';
      });

      return [
        student.name,
        student.korean_name || '',
        student.subject || '',
        student.teacher_name || ''
      ].concat(dayCells).map(escapeCSV).join(',');
    });

    const csv = [headerRow, ...dataRows].join('\n');

    const filename = `attendance_${y}_${String(m).padStart(2, '0')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};

// ==================== TEACHER DASHBOARD ENDPOINTS ====================

// Get teacher schedule for a date
exports.getTeacherSchedule = async (req, res) => {
  try {
    const { teacher, date } = req.query;

    if (!teacher || !date) {
      return res.status(400).json({ error: 'teacher and date are required' });
    }

    const schedule = await Attendance.getTeacherSchedule(teacher, date);
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching teacher schedule:', error);
    res.status(500).json({ error: 'Failed to fetch teacher schedule' });
  }
};

// ==================== HIDDEN ROWS ENDPOINTS ====================

// Get all hidden rows
exports.getHiddenRows = async (req, res) => {
  try {
    const hiddenRows = await Attendance.getHiddenRows();
    res.json(hiddenRows);
  } catch (error) {
    console.error('Error fetching hidden rows:', error);
    res.status(500).json({ error: 'Failed to fetch hidden rows' });
  }
};

// Hide a student row (student-subject combination) from a specific month onwards
exports.hideRow = async (req, res) => {
  try {
    const { studentId, subject, year, month } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const result = await Attendance.hideRow(
      parseInt(studentId),
      subject || null,
      year ? parseInt(year) : null,
      month ? parseInt(month) : null
    );
    res.json(result || { message: 'Row hidden successfully' });
  } catch (error) {
    console.error('Error hiding row:', error);
    res.status(500).json({ error: 'Failed to hide row' });
  }
};

// Unhide a student row
exports.unhideRow = async (req, res) => {
  try {
    const { studentId, subject } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const result = await Attendance.unhideRow(parseInt(studentId), subject || null);
    res.json(result || { message: 'Row unhidden successfully' });
  } catch (error) {
    console.error('Error unhiding row:', error);
    res.status(500).json({ error: 'Failed to unhide row' });
  }
};
