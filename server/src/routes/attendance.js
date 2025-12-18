const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Get all students with classes
router.get('/students', attendanceController.getStudents);

// Get attendance for a month
router.get('/monthly', attendanceController.getMonthlyAttendance);

// Get monthly summary
router.get('/summary', attendanceController.getMonthlySummary);

// Get teacher assignments for a month
router.get('/teachers', attendanceController.getTeacherAssignments);

// Get student summary for a month
router.get('/summary/:studentId', attendanceController.getStudentSummary);

// Set attendance
router.post('/', attendanceController.setAttendance);

// Toggle attendance
router.post('/toggle', attendanceController.toggleAttendance);

// Delete attendance record
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
router.post('/holidays', attendanceController.addHoliday);

// Delete a holiday (admin only)
router.delete('/holidays/:id', attendanceController.deleteHoliday);

// Tuition routes (legacy - single subject per student)
router.get('/tuition', attendanceController.getStudentsWithTuition);
router.post('/tuition', attendanceController.setTuition);
router.post('/tuition/payment', attendanceController.setPayment);
router.post('/tuition/payment/toggle', attendanceController.togglePayment);

// Subject-based tuition routes (multiple subjects per student)
router.get('/subjects', attendanceController.getSubjects);
router.get('/tuition/subjects', attendanceController.getStudentsWithSubjectTuition);
router.post('/tuition/subjects', attendanceController.setSubjectTuition);
router.post('/tuition/subjects/payment/toggle', attendanceController.toggleSubjectPayment);
router.post('/tuition/subjects/add', attendanceController.addStudentSubject);
router.delete('/tuition/subjects', attendanceController.deleteStudentSubject);

// Teacher commission routes
router.get('/commission/teachers', attendanceController.getTeachers);
router.get('/commission', attendanceController.getTeachersWithCommission);
router.post('/commission', attendanceController.setTeacherCommission);
router.post('/commission/payment/toggle', attendanceController.toggleTeacherPayment);

// Hidden rows routes
router.get('/hidden', attendanceController.getHiddenRows);
router.post('/hidden', attendanceController.hideRow);
router.delete('/hidden', attendanceController.unhideRow);

module.exports = router;
