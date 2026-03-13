const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAdmin } = require('../middleware/auth');

// Get all students with classes
router.get('/students', attendanceController.getStudents);

// Export attendance as CSV
router.get('/export', attendanceController.exportCSV);

// Get attendance for a month
router.get('/monthly', attendanceController.getMonthlyAttendance);

// Get class count for a date range
router.get('/count-range', attendanceController.getClassCountRange);

// Get monthly summary
router.get('/summary', attendanceController.getMonthlySummary);

// Get teacher assignments for a month
router.get('/teachers', attendanceController.getTeacherAssignments);

// Get student summary for a month
router.get('/summary/:studentId', attendanceController.getStudentSummary);

// Bulk set attendance
router.post('/bulk', attendanceController.bulkSetAttendance);

// Set attendance
router.post('/', attendanceController.setAttendance);

// Toggle attendance
router.post('/toggle', attendanceController.toggleAttendance);

// Undo soft-deleted attendance record
router.post('/undo', attendanceController.undoDelete);

// Get recently soft-deleted attendance records
router.get('/recent-deletes', attendanceController.getRecentDeletes);

// Delete attendance record (soft delete)
router.delete('/', attendanceController.deleteAttendance);

// Get notes for a month
router.get('/notes', attendanceController.getNotes);

// Set note for a student
router.post('/notes', attendanceController.setNote);

// Admin verify password
router.post('/admin/verify', attendanceController.verifyAdmin);

// Get all holidays
router.get('/holidays', attendanceController.getHolidays);

// Get holidays for a specific month
router.get('/holidays/monthly', attendanceController.getHolidaysByMonth);

// Add a holiday (admin only)
router.post('/holidays', requireAdmin, attendanceController.addHoliday);

// Delete a holiday (admin only)
router.delete('/holidays/:id', requireAdmin, attendanceController.deleteHoliday);

// Subject-based tuition routes
router.get('/subjects', attendanceController.getSubjects);
router.get('/tuition/subjects', attendanceController.getStudentsWithSubjectTuition);
router.post('/tuition/subjects', requireAdmin, attendanceController.setSubjectTuition);
router.post('/tuition/subjects/payment/toggle', requireAdmin, attendanceController.toggleSubjectPayment);
router.post('/tuition/subjects/add', requireAdmin, attendanceController.addStudentSubject);
router.delete('/tuition/subjects', requireAdmin, attendanceController.deleteStudentSubject);

// Teacher commission routes
router.get('/commission/teachers', attendanceController.getTeachers);
router.get('/commission', attendanceController.getTeachersWithCommission);
router.post('/commission', requireAdmin, attendanceController.setTeacherCommission);
router.post('/commission/payment/toggle', requireAdmin, attendanceController.toggleTeacherPayment);

// Teacher dashboard routes
router.get('/teacher-schedule', attendanceController.getTeacherSchedule);

// Hidden rows routes
router.get('/hidden', attendanceController.getHiddenRows);
router.post('/hidden', requireAdmin, attendanceController.hideRow);
router.delete('/hidden', requireAdmin, attendanceController.unhideRow);

module.exports = router;
