import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import MonthTabs from './components/MonthTabs';
import AttendanceGrid from './components/AttendanceGrid';
import AdminPanel from './components/AdminPanel';
import ClassCountModal from './components/ClassCountModal';
import { getStudents, getMonthlyAttendance, getNotes, getHolidaysByMonth, verifyAdmin, warmupApi } from './services/api';

function App() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  // Warm up the API on app load to reduce cold start delays
  useEffect(() => {
    warmupApi();
  }, []);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'admin'
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminPassword, setAdminPassword] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(''); // Teacher filter

  // Date range selection for class count
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState(null);
  const [rangeEndDate, setRangeEndDate] = useState(null);
  const [showClassCountModal, setShowClassCountModal] = useState(false);

  // Fetch students (with year/month for date-aware hidden row filtering)
  const {
    data: students = [],
    isLoading: studentsLoading,
    error: studentsError
  } = useQuery({
    queryKey: ['students', selectedYear, selectedMonth],
    queryFn: () => getStudents(selectedYear, selectedMonth)
  });

  // Fetch attendance for selected month
  const {
    data: attendance = [],
    isLoading: attendanceLoading
  } = useQuery({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn: () => getMonthlyAttendance(selectedYear, selectedMonth)
  });

  // Fetch notes for selected month
  const {
    data: notes = [],
    isLoading: notesLoading
  } = useQuery({
    queryKey: ['notes', selectedYear, selectedMonth],
    queryFn: () => getNotes(selectedYear, selectedMonth)
  });

  // Fetch holidays for selected month
  const {
    data: holidays = [],
    isLoading: holidaysLoading
  } = useQuery({
    queryKey: ['holidays', selectedYear, selectedMonth],
    queryFn: () => getHolidaysByMonth(selectedYear, selectedMonth)
  });

  const isLoading = studentsLoading || attendanceLoading || notesLoading || holidaysLoading;

  // Get unique teachers for the filter dropdown
  const teachers = React.useMemo(() => {
    const teacherSet = new Set();
    students.forEach(s => {
      if (s.teacher_name) teacherSet.add(s.teacher_name);
    });
    return Array.from(teacherSet).sort();
  }, [students]);

  // Filter students by selected teacher
  const filteredStudents = React.useMemo(() => {
    if (!selectedTeacher) return students;
    return students.filter(s => s.teacher_name === selectedTeacher);
  }, [students, selectedTeacher]);

  // Calculate total summary
  const totalSummary = React.useMemo(() => {
    const summary = { present: 0, absent: 0, ta: 0 };
    attendance.forEach(record => {
      if (record.status === 'present') summary.present++;
      else if (record.status === 'absent') summary.absent++;
      else if (record.status === 'ta') summary.ta++;
    });
    return summary;
  }, [attendance]);

  const handleAdminTabClick = () => {
    if (adminPassword) {
      setActiveTab('admin');
    } else {
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    try {
      await verifyAdmin(passwordInput);
      setAdminPassword(passwordInput);
      setShowPasswordModal(false);
      setPasswordInput('');
      setActiveTab('admin');
    } catch (error) {
      setPasswordError('Invalid password');
    }
  };

  const handleAdminLogout = () => {
    setAdminPassword(null);
    setActiveTab('attendance');
  };

  // Date range selection handlers
  const handleDateRangeSelect = (dateStr) => {
    if (!rangeStartDate) {
      // First click - set start date
      setRangeStartDate(dateStr);
    } else if (!rangeEndDate) {
      // Second click - set end date and show modal
      // Ensure start is before end
      if (dateStr < rangeStartDate) {
        setRangeEndDate(rangeStartDate);
        setRangeStartDate(dateStr);
      } else {
        setRangeEndDate(dateStr);
      }
      setIsSelectingRange(false);
      setShowClassCountModal(true);
    }
  };

  const handleClearRange = () => {
    setRangeStartDate(null);
    setRangeEndDate(null);
    setIsSelectingRange(false);
  };

  const toggleRangeSelection = () => {
    if (isSelectingRange) {
      // Cancel selection
      handleClearRange();
    } else {
      // Start selection
      setRangeStartDate(null);
      setRangeEndDate(null);
      setIsSelectingRange(true);
    }
  };

  if (studentsError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="text-red-500 text-xl mb-4">Failed to load students</div>
          <p className="text-gray-600 mb-4">
            Make sure the online scheduler is running on port 4488.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Attendance Tracker
              </h1>
              {/* Tab Navigation */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'attendance'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Attendance
                </button>
                <button
                  onClick={handleAdminTabClick}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'admin'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
            {activeTab === 'attendance' && (
              <div className="flex items-center gap-6 text-sm">
                {/* Today's Date */}
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md border border-blue-200">
                  <span className="text-blue-600 font-medium">Today:</span>
                  <span className="text-blue-800 font-semibold">
                    {today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <span className="text-gray-300">|</span>
                {/* Teacher Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-gray-600">Teacher:</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Teachers</option>
                    {teachers.map(teacher => (
                      <option key={teacher} value={teacher}>{teacher}</option>
                    ))}
                  </select>
                  {selectedTeacher && (
                    <button
                      onClick={() => setSelectedTeacher('')}
                      className="text-gray-400 hover:text-gray-600"
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="text-gray-300">|</span>
                {/* Date Range Selection Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleRangeSelection}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isSelectingRange
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {isSelectingRange
                      ? rangeStartDate
                        ? 'Click end date...'
                        : 'Click start date...'
                      : 'Count Classes'}
                  </button>
                  {(rangeStartDate || rangeEndDate) && !isSelectingRange && (
                    <button
                      onClick={() => setShowClassCountModal(true)}
                      className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                    >
                      View
                    </button>
                  )}
                  {isSelectingRange && (
                    <button
                      onClick={handleClearRange}
                      className="text-gray-400 hover:text-gray-600"
                      title="Cancel selection"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">Present: {totalSummary.present}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-gray-600">Absent: {totalSummary.absent}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-gray-600">TA: {totalSummary.ta}</span>
                </div>
                <div className="text-gray-500">
                  {filteredStudents.length}{selectedTeacher ? ` of ${students.length}` : ''} students
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeTab === 'attendance' ? (
        <>
          {/* Month Tabs */}
          <MonthTabs
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />

          {/* Main Content */}
          <main className="p-4 overflow-x-auto">
            <AttendanceGrid
              students={filteredStudents}
              attendance={attendance}
              notes={notes}
              holidays={holidays}
              year={selectedYear}
              month={selectedMonth}
              isLoading={isLoading}
              isSelectingRange={isSelectingRange}
              rangeStartDate={rangeStartDate}
              rangeEndDate={rangeEndDate}
              onDateRangeSelect={handleDateRangeSelect}
            />

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">P</div>
                <span>Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">A</div>
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">TA</div>
                <span>Teacher's Absence</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">-</div>
                <span>Not marked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-orange-500 text-xs">H</div>
                <span>Holiday</span>
              </div>
              <span className="text-gray-400">|</span>
              <span>Click a cell to select status</span>
            </div>
          </main>
        </>
      ) : (
        <AdminPanel adminPassword={adminPassword} onLogout={handleAdminLogout} />
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Access</h3>
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-1 text-sm text-red-600">{passwordError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput('');
                    setPasswordError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Count Modal */}
      <ClassCountModal
        isOpen={showClassCountModal}
        onClose={() => setShowClassCountModal(false)}
        startDate={rangeStartDate}
        endDate={rangeEndDate}
        selectedTeacher={selectedTeacher}
        onClearRange={handleClearRange}
      />
    </div>
  );
}

export default App;
