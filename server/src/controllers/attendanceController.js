const Attendance = require('../models/Attendance');

// Get all students with classes
exports.getStudents = async (req, res) => {
  try {
    const students = await Attendance.getStudentsWithClasses();
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

    if (!['present', 'absent', 'ta'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be "present", "absent", or "ta"'
      });
    }

    const record = await Attendance.setAttendance(studentId, date, status, notes, subject || null);
    res.json(record);
  } catch (error) {
    console.error('Error setting attendance:', error);
    res.status(500).json({ error: 'Failed to set attendance' });
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

if (!ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD environment variable is not set. Admin routes will be inaccessible.');
}

// Verify admin password
exports.verifyAdmin = async (req, res) => {
  try {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      res.json({ success: true });
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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

// ==================== TUITION ENDPOINTS ====================

// Get students with tuition and payment info for a month
exports.getStudentsWithTuition = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const students = await Attendance.getStudentsWithTuition(
      parseInt(year),
      parseInt(month)
    );
    res.json(students);
  } catch (error) {
    console.error('Error fetching students with tuition:', error);
    res.status(500).json({ error: 'Failed to fetch students with tuition' });
  }
};

// Set price per class for a student (admin only)
exports.setTuition = async (req, res) => {
  try {
    const { studentId, pricePerClass, currency, password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    if (!studentId || pricePerClass === undefined) {
      return res.status(400).json({ error: 'studentId and pricePerClass are required' });
    }

    // Validate currency
    const validCurrencies = ['PHP', 'KRW'];
    const currencyValue = currency && validCurrencies.includes(currency) ? currency : 'PHP';

    const result = await Attendance.setTuition(parseInt(studentId), parseFloat(pricePerClass), currencyValue);
    res.json(result);
  } catch (error) {
    console.error('Error setting tuition:', error);
    res.status(500).json({ error: 'Failed to set tuition' });
  }
};

// Toggle payment status (admin only)
exports.togglePayment = async (req, res) => {
  try {
    const { studentId, year, month, password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    if (!studentId || !year || !month) {
      return res.status(400).json({ error: 'studentId, year, and month are required' });
    }

    const result = await Attendance.togglePayment(
      parseInt(studentId),
      parseInt(year),
      parseInt(month)
    );
    res.json(result);
  } catch (error) {
    console.error('Error toggling payment:', error);
    res.status(500).json({ error: 'Failed to toggle payment' });
  }
};

// Set payment details (admin only)
exports.setPayment = async (req, res) => {
  try {
    const { studentId, year, month, paid, paymentDate, notes, password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    if (!studentId || !year || !month) {
      return res.status(400).json({ error: 'studentId, year, and month are required' });
    }

    const result = await Attendance.setPayment(
      parseInt(studentId),
      parseInt(year),
      parseInt(month),
      paid,
      paymentDate || null,
      notes || null
    );
    res.json(result);
  } catch (error) {
    console.error('Error setting payment:', error);
    res.status(500).json({ error: 'Failed to set payment' });
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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

// Set subject tuition for a student (admin only)
exports.setSubjectTuition = async (req, res) => {
  try {
    const { studentId, subject, pricePerClass, currency, password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

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
