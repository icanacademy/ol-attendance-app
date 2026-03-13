import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
});

// Warm up the API to reduce cold start delays
export const warmupApi = () => {
  api.get('/health').catch(() => {});
};

// Get all students with classes
// Accepts optional year and month for date-aware hidden row filtering
export const getStudents = async (year = null, month = null) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  const response = await api.get('/attendance/students', { params });
  return response.data;
};

// Get attendance for a specific month
export const getMonthlyAttendance = async (year, month) => {
  const response = await api.get('/attendance/monthly', {
    params: { year, month }
  });
  return response.data;
};

// Set attendance for a student (with optional subject)
export const setAttendance = async (studentId, date, status, notes = null, subject = null) => {
  const response = await api.post('/attendance', {
    studentId,
    date,
    status,
    notes,
    subject
  });
  return response.data;
};

// Bulk set attendance for multiple students on a specific date
export const bulkSetAttendance = async (data) => {
  const response = await api.post('/attendance/bulk', data);
  return response.data;
};

// Toggle attendance status (with optional subject)
export const toggleAttendance = async (studentId, date, subject = null) => {
  const response = await api.post('/attendance/toggle', {
    studentId,
    date,
    subject
  });
  return response.data;
};

// Delete attendance record (with optional subject) - now soft deletes
export const deleteAttendance = async (studentId, date, subject = null) => {
  const response = await api.delete('/attendance', {
    params: { studentId, date, subject }
  });
  return response.data;
};

// Undo a soft-deleted attendance record
export const undoDeleteAttendance = async (studentId, date, subject = null) => {
  const response = await api.post('/attendance/undo', {
    studentId,
    date,
    subject
  });
  return response.data;
};

// Get recently soft-deleted attendance records
export const getRecentDeletes = async (minutes = 30) => {
  const response = await api.get('/attendance/recent-deletes', {
    params: { minutes }
  });
  return response.data;
};

// Get monthly summary
export const getMonthlySummary = async (year, month) => {
  const response = await api.get('/attendance/summary', {
    params: { year, month }
  });
  return response.data;
};

// Get student summary for a month
export const getStudentSummary = async (studentId, year, month) => {
  const response = await api.get(`/attendance/summary/${studentId}`, {
    params: { year, month }
  });
  return response.data;
};

// Get teacher assignments for a month
export const getTeacherAssignments = async (year, month) => {
  const response = await api.get('/attendance/teachers', {
    params: { year, month }
  });
  return response.data;
};

// Get notes for a month
export const getNotes = async (year, month) => {
  const response = await api.get('/attendance/notes', {
    params: { year, month }
  });
  return response.data;
};

// Set note for a student (with optional subject)
export const setNote = async (studentId, year, month, notes, subject = null) => {
  const response = await api.post('/attendance/notes', {
    studentId,
    year,
    month,
    notes,
    subject
  });
  return response.data;
};

// Verify admin password and get JWT token
export const verifyAdmin = async (password) => {
  const response = await api.post('/attendance/admin/verify', { password });
  if (response.data.token) {
    // Store token and set as default auth header
    localStorage.setItem('admin_token', response.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
  }
  return response.data;
};

// Restore token from localStorage on app load
export const restoreAdminToken = () => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  }
  return false;
};

// Clear admin token on logout
export const clearAdminToken = () => {
  localStorage.removeItem('admin_token');
  delete api.defaults.headers.common['Authorization'];
};

// Get all holidays
export const getHolidays = async () => {
  const response = await api.get('/attendance/holidays');
  return response.data;
};

// Get holidays for a month
export const getHolidaysByMonth = async (year, month) => {
  const response = await api.get('/attendance/holidays/monthly', {
    params: { year, month }
  });
  return response.data;
};

// Add a holiday (admin only)
export const addHoliday = async (date, name, password) => {
  const response = await api.post('/attendance/holidays', {
    date,
    name,
    password
  });
  return response.data;
};

// Delete a holiday (admin only)
export const deleteHoliday = async (id, password) => {
  const response = await api.delete(`/attendance/holidays/${id}`, {
    data: { password }
  });
  return response.data;
};

// Export attendance as CSV
export const exportAttendanceCSV = (year, month) =>
  api.get('/attendance/export', { params: { year, month }, responseType: 'blob' });

// ==================== SUBJECT-BASED TUITION API ====================

// Get all subjects
export const getSubjects = async () => {
  const response = await api.get('/attendance/subjects');
  return response.data;
};

// Get students with subject-based tuition for a month
export const getStudentsWithSubjectTuition = async (year, month) => {
  const response = await api.get('/attendance/tuition/subjects', {
    params: { year, month }
  });
  return response.data;
};

// Set subject tuition for a student (admin only)
export const setSubjectTuition = async (studentId, subject, pricePerClass, currency, password) => {
  const response = await api.post('/attendance/tuition/subjects', {
    studentId,
    subject,
    pricePerClass,
    currency,
    password
  });
  return response.data;
};

// Toggle subject payment status (admin only)
export const toggleSubjectPayment = async (studentId, subject, year, month, password) => {
  const response = await api.post('/attendance/tuition/subjects/payment/toggle', {
    studentId,
    subject,
    year,
    month,
    password
  });
  return response.data;
};

// Add a subject for a student (admin only)
export const addStudentSubject = async (studentId, subject, password) => {
  const response = await api.post('/attendance/tuition/subjects/add', {
    studentId,
    subject,
    password
  });
  return response.data;
};

// Delete a subject for a student (admin only)
export const deleteStudentSubject = async (studentId, subject, password) => {
  const response = await api.delete('/attendance/tuition/subjects', {
    params: { studentId, subject },
    data: { password }
  });
  return response.data;
};

// ==================== TEACHER COMMISSION API ====================

// Get all teachers
export const getTeachers = async () => {
  const response = await api.get('/attendance/commission/teachers');
  return response.data;
};

// Get teachers with commission info for a month
export const getTeachersWithCommission = async (year, month) => {
  const response = await api.get('/attendance/commission', {
    params: { year, month }
  });
  return response.data;
};

// Set commission rate for a teacher-student combination (admin only)
export const setTeacherCommission = async (teacherId, studentId, commissionPerClass, currency, password) => {
  const response = await api.post('/attendance/commission', {
    teacherId,
    studentId,
    commissionPerClass,
    currency,
    password
  });
  return response.data;
};

// Toggle teacher-student payment status (admin only)
export const toggleTeacherPayment = async (teacherId, studentId, year, month, password) => {
  const response = await api.post('/attendance/commission/payment/toggle', {
    teacherId,
    studentId,
    year,
    month,
    password
  });
  return response.data;
};

// ==================== CLASS COUNT RANGE API ====================

// Get class counts for a date range
export const getClassCountRange = async (startDate, endDate, statuses = [], teacherId = null) => {
  const response = await api.get('/attendance/count-range', {
    params: {
      startDate,
      endDate,
      statuses: statuses.join(','),
      teacherId
    }
  });
  return response.data;
};

// ==================== TEACHER DASHBOARD API ====================

// Get teacher schedule for a date
export const getTeacherSchedule = (teacherName, date) =>
  api.get('/attendance/teacher-schedule', { params: { teacher: teacherName, date } }).then(r => r.data);

// ==================== HIDDEN ROWS API ====================

// Get all hidden rows
export const getHiddenRows = async () => {
  const response = await api.get('/attendance/hidden');
  return response.data;
};

// Hide a student row (student-subject combination) from a specific month onwards
export const hideRow = async (studentId, subject = null, year = null, month = null) => {
  const response = await api.post('/attendance/hidden', {
    studentId,
    subject,
    year,
    month
  });
  return response.data;
};

// Unhide a student row
export const unhideRow = async (studentId, subject = null) => {
  const response = await api.delete('/attendance/hidden', {
    data: { studentId, subject }
  });
  return response.data;
};

export default api;
