import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHolidays, addHoliday, deleteHoliday, getStudentsWithSubjectTuition, setSubjectTuition, toggleSubjectPayment, addStudentSubject, deleteStudentSubject, getSubjects, getStudents, getTeachersWithCommission, setTeacherCommission, toggleTeacherPayment, getHiddenRows, unhideRow } from '../services/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CURRENCIES = {
  PHP: { symbol: '₱', name: 'Philippine Peso' },
  KRW: { symbol: '₩', name: 'Korean Won' }
};

function AdminPanel({ adminPassword, onLogout }) {
  const queryClient = useQueryClient();
  const today = new Date();
  const [activeTab, setActiveTab] = useState('tuition'); // 'tuition', 'commissions', or 'holidays'

  // Format currency with specific currency code
  const formatCurrency = (amount, currencyCode = 'PHP') => {
    if (!amount) return '-';
    return `${CURRENCIES[currencyCode]?.symbol || '₱'}${amount.toLocaleString()}`;
  };

  // Holiday state
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  // Tuition state
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [editingTuition, setEditingTuition] = useState({}); // { id: { price: value, currency: 'PHP' } }
  const [showAddSubject, setShowAddSubject] = useState(null); // studentId or null
  const [newSubject, setNewSubject] = useState('');

  // Commission state
  const [commissionYear, setCommissionYear] = useState(today.getFullYear());
  const [commissionMonth, setCommissionMonth] = useState(today.getMonth() + 1);
  const [selectedTeacher, setSelectedTeacher] = useState('all'); // 'all' or teacher id
  const [editingCommission, setEditingCommission] = useState({}); // { teacherId: { rate: value } }

  // Fetch all holidays
  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: getHolidays
  });

  // Fetch students with subject-based tuition for selected month (only when on tuition tab)
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['tuition-subjects', selectedYear, selectedMonth],
    queryFn: () => getStudentsWithSubjectTuition(selectedYear, selectedMonth),
    enabled: activeTab === 'tuition'
  });

  // Fetch all subjects for dropdown
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: getSubjects,
    enabled: activeTab === 'tuition'
  });

  // Fetch all students for add subject dropdown
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students'],
    queryFn: getStudents,
    enabled: activeTab === 'tuition'
  });

  // Add holiday mutation
  const addMutation = useMutation({
    mutationFn: ({ date, name }) => addHoliday(date, name, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['holidays']);
      setNewDate('');
      setNewName('');
    }
  });

  // Delete holiday mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteHoliday(id, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['holidays']);
    }
  });

  // Set subject tuition mutation
  const tuitionMutation = useMutation({
    mutationFn: ({ studentId, subject, pricePerClass, currency }) => setSubjectTuition(studentId, subject, pricePerClass, currency, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['tuition-subjects', selectedYear, selectedMonth]);
    }
  });

  // Toggle subject payment mutation
  const paymentMutation = useMutation({
    mutationFn: ({ studentId, subject }) => toggleSubjectPayment(studentId, subject, selectedYear, selectedMonth, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['tuition-subjects', selectedYear, selectedMonth]);
    }
  });

  // Add student subject mutation
  const addSubjectMutation = useMutation({
    mutationFn: ({ studentId, subject }) => addStudentSubject(studentId, subject, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['tuition-subjects', selectedYear, selectedMonth]);
      setShowAddSubject(null);
      setNewSubject('');
    }
  });

  // Delete student subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: ({ studentId, subject }) => deleteStudentSubject(studentId, subject, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['tuition-subjects', selectedYear, selectedMonth]);
    }
  });

  // Fetch teachers with commission for selected month
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['commission', commissionYear, commissionMonth],
    queryFn: () => getTeachersWithCommission(commissionYear, commissionMonth),
    enabled: activeTab === 'commissions'
  });

  // Fetch hidden rows
  const { data: hiddenRows = [], isLoading: hiddenLoading } = useQuery({
    queryKey: ['hiddenRows'],
    queryFn: getHiddenRows,
    enabled: activeTab === 'hidden'
  });

  // Unhide row mutation
  const unhideMutation = useMutation({
    mutationFn: ({ studentId, subject }) => unhideRow(studentId, subject),
    onSuccess: () => {
      queryClient.invalidateQueries(['hiddenRows']);
      queryClient.invalidateQueries(['students']);
    }
  });

  // Set commission mutation (per teacher-student)
  const commissionMutation = useMutation({
    mutationFn: ({ teacherId, studentId, commissionPerClass, currency }) => setTeacherCommission(teacherId, studentId, commissionPerClass, currency, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['commission', commissionYear, commissionMonth]);
    }
  });

  // Toggle teacher-student payment mutation
  const teacherPaymentMutation = useMutation({
    mutationFn: ({ teacherId, studentId }) => toggleTeacherPayment(teacherId, studentId, commissionYear, commissionMonth, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(['commission', commissionYear, commissionMonth]);
    }
  });

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (!newDate) return;
    addMutation.mutate({ date: newDate, name: newName });
  };

  const handleDeleteHoliday = (id) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleTuitionChange = (id, value) => {
    setEditingTuition(prev => ({
      ...prev,
      [id]: { ...prev[id], price: value }
    }));
  };

  const handleCurrencyChange = (row, currency, currentPrice) => {
    // Immediately save when currency changes
    const priceToSave = editingTuition[row.id]?.price !== undefined
      ? parseFloat(editingTuition[row.id].price) || 0
      : currentPrice || 0;
    tuitionMutation.mutate({ studentId: row.student_id, subject: row.subject, pricePerClass: priceToSave, currency });
  };

  const handleTuitionBlur = (row, currentPrice, currentCurrency) => {
    const editData = editingTuition[row.id];
    const newPrice = editData?.price;
    if (newPrice !== undefined && parseFloat(newPrice) !== currentPrice) {
      tuitionMutation.mutate({
        studentId: row.student_id,
        subject: row.subject,
        pricePerClass: parseFloat(newPrice) || 0,
        currency: currentCurrency || 'PHP'
      });
    }
    setEditingTuition(prev => {
      const updated = { ...prev };
      delete updated[row.id];
      return updated;
    });
  };

  const getTuitionValue = (id, currentPrice) => {
    if (editingTuition[id]?.price !== undefined) {
      return editingTuition[id].price;
    }
    return currentPrice || '';
  };

  const handleTogglePayment = (row) => {
    paymentMutation.mutate({ studentId: row.student_id, subject: row.subject });
  };

  const handleAddSubject = (studentId) => {
    if (!newSubject) return;
    addSubjectMutation.mutate({ studentId, subject: newSubject });
  };

  const handleDeleteSubject = (row) => {
    if (confirm(`Delete "${row.subject}" for ${row.name}? This will also remove any payment records for this subject.`)) {
      deleteSubjectMutation.mutate({ studentId: row.student_id, subject: row.subject });
    }
  };

  // Check if a subject was manually added (exists in student_subject_tuition table)
  // We can tell by checking if it's different from the student's default subject
  const isAddedSubject = (row, allRows) => {
    // Find all rows for this student
    const studentRows = allRows.filter(r => r.student_id === row.student_id);
    // If student has only one row, it's their default - can't delete
    if (studentRows.length <= 1) return false;
    // Otherwise, any row can be deleted
    return true;
  };

  // Get unique students from the tuition data for the "Add Subject" feature
  const uniqueStudentsInTuition = [...new Map(students.map(s => [s.student_id, { id: s.student_id, name: s.name }])).values()];

  // Commission handlers (using composite key: id = "teacherId-studentId")
  const handleCommissionChange = (id, value) => {
    setEditingCommission(prev => ({
      ...prev,
      [id]: { ...prev[id], rate: value }
    }));
  };

  const handleCommissionCurrencyChange = (row, currency, currentRate) => {
    const rateToSave = editingCommission[row.id]?.rate !== undefined
      ? parseFloat(editingCommission[row.id].rate) || 0
      : currentRate || 0;
    commissionMutation.mutate({
      teacherId: row.teacher_id,
      studentId: row.student_id,
      commissionPerClass: rateToSave,
      currency
    });
  };

  const handleCommissionBlur = (row, currentRate, currentCurrency) => {
    const editData = editingCommission[row.id];
    const newRate = editData?.rate;
    if (newRate !== undefined && parseFloat(newRate) !== currentRate) {
      commissionMutation.mutate({
        teacherId: row.teacher_id,
        studentId: row.student_id,
        commissionPerClass: parseFloat(newRate) || 0,
        currency: currentCurrency || 'PHP'
      });
    }
    setEditingCommission(prev => {
      const updated = { ...prev };
      delete updated[row.id];
      return updated;
    });
  };

  const getCommissionValue = (id, currentRate) => {
    if (editingCommission[id]?.rate !== undefined) {
      return editingCommission[id].rate;
    }
    return currentRate || '';
  };

  const handleToggleTeacherPayment = (row) => {
    teacherPaymentMutation.mutate({ teacherId: row.teacher_id, studentId: row.student_id });
  };

  // Filter rows based on selected teacher
  const filteredTeachers = selectedTeacher === 'all'
    ? teachers
    : teachers.filter(t => t.teacher_name === selectedTeacher);

  // Get unique teacher names for dropdown
  const uniqueTeacherNames = [...new Set(teachers.map(t => t.teacher_name))].sort();

  // Calculate commission summary grouped by currency
  const commissionSummary = teachers.reduce((acc, row) => {
    const curr = row.currency || 'PHP';
    acc.totalRows++;
    acc.totalClasses += row.class_count || 0;

    if (!acc.byCurrency[curr]) {
      acc.byCurrency[curr] = { total: 0, paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 };
    }

    acc.byCurrency[curr].total += row.total_commission || 0;

    if (row.paid) {
      acc.paidCount++;
      acc.byCurrency[curr].paid += row.total_commission || 0;
      acc.byCurrency[curr].paidCount++;
    } else if (row.total_commission > 0) {
      acc.unpaidCount++;
      acc.byCurrency[curr].unpaid += row.total_commission || 0;
      acc.byCurrency[curr].unpaidCount++;
    }
    return acc;
  }, { totalRows: 0, totalClasses: 0, paidCount: 0, unpaidCount: 0, byCurrency: {} });

  // Group holidays by year
  const holidaysByYear = holidays.reduce((acc, holiday) => {
    const year = holiday.date.split('-')[0];
    if (!acc[year]) acc[year] = [];
    acc[year].push(holiday);
    return acc;
  }, {});

  // Calculate summary grouped by currency
  const summary = students.reduce((acc, student) => {
    const curr = student.currency || 'PHP';
    acc.totalStudents++;
    acc.totalPresent += student.present_count || 0;

    // Initialize currency-specific totals if not exists
    if (!acc.byCurrency[curr]) {
      acc.byCurrency[curr] = { total: 0, paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 };
    }

    acc.byCurrency[curr].total += student.total_tuition || 0;

    if (student.paid) {
      acc.paidCount++;
      acc.byCurrency[curr].paid += student.total_tuition || 0;
      acc.byCurrency[curr].paidCount++;
    } else if (student.total_tuition > 0) {
      acc.unpaidCount++;
      acc.byCurrency[curr].unpaid += student.total_tuition || 0;
      acc.byCurrency[curr].unpaidCount++;
    }
    return acc;
  }, { totalStudents: 0, totalPresent: 0, paidCount: 0, unpaidCount: 0, byCurrency: {} });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
        <button
          onClick={onLogout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
        >
          Logout
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab('tuition')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'tuition'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tuition
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'commissions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Commissions
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'holidays'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Holidays
        </button>
        <button
          onClick={() => setActiveTab('hidden')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'hidden'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Hidden Students
        </button>
      </div>

      {activeTab === 'tuition' && (
        <>
          {/* Year Selector */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Month Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b overflow-x-auto">
              {MONTH_NAMES.map((name, index) => {
                const monthNum = index + 1;
                const isSelected = selectedMonth === monthNum;
                const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() + 1 === monthNum;
                return (
                  <button
                    key={monthNum}
                    onClick={() => setSelectedMonth(monthNum)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                      isSelected
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {SHORT_MONTH_NAMES[index]}
                    {isCurrentMonth && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Students</div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalStudents}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Classes</div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalPresent}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Paid / Unpaid</div>
              <div className="text-2xl font-bold text-gray-900">
                <span className="text-green-600">{summary.paidCount}</span>
                <span className="text-gray-400"> / </span>
                <span className="text-red-600">{summary.unpaidCount}</span>
              </div>
            </div>
          </div>

          {/* Currency-specific Summary */}
          {Object.keys(summary.byCurrency).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {Object.entries(summary.byCurrency).map(([curr, data]) => (
                <div key={curr} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold text-gray-800">{CURRENCIES[curr]?.symbol} {curr}</span>
                    <span className="text-sm text-gray-500">{CURRENCIES[curr]?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500">Expected</div>
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(data.total, curr)}</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs text-green-600">Paid ({data.paidCount})</div>
                      <div className="text-sm font-bold text-green-700">{formatCurrency(data.paid, curr)}</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-xs text-red-600">Unpaid ({data.unpaidCount})</div>
                      <div className="text-sm font-bold text-red-700">{formatCurrency(data.unpaid, curr)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Subject for Student */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Subject for Student</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select
                  value={showAddSubject || ''}
                  onChange={(e) => setShowAddSubject(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a student...</option>
                  {allStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!showAddSubject}
                >
                  <option value="">Select a subject...</option>
                  {allSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleAddSubject(showAddSubject)}
                disabled={!showAddSubject || !newSubject || addSubjectMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {addSubjectMutation.isPending ? 'Adding...' : 'Add Subject'}
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Tuition Payments - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Each row represents a student-subject combination</p>
            </div>

            {studentsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No students found.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price/Class
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Tuition
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((row) => (
                    <tr key={row.id} className={row.paid ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{row.name}</div>
                        {row.korean_name && (
                          <div className="text-xs text-blue-600 font-medium">{row.korean_name}</div>
                        )}
                        {row.english_name && (
                          <div className="text-sm text-gray-500">{row.english_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {row.teacher_name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-600 font-medium">
                        {row.subject || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <select
                          value={row.currency || 'PHP'}
                          onChange={(e) => handleCurrencyChange(row, e.target.value, row.price_per_class)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                            <option key={code} value={code}>{symbol} {code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          value={getTuitionValue(row.id, row.price_per_class)}
                          onChange={(e) => handleTuitionChange(row.id, e.target.value)}
                          onBlur={() => handleTuitionBlur(row, row.price_per_class, row.currency)}
                          placeholder="0"
                          className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          row.present_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {row.present_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${
                          row.total_tuition > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {formatCurrency(row.total_tuition, row.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleTogglePayment(row)}
                          disabled={paymentMutation.isPending}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            row.paid
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {row.paid ? 'Paid' : 'Unpaid'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                        {row.payment_date ? new Date(row.payment_date + 'T00:00:00').toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {isAddedSubject(row, students) && (
                          <button
                            onClick={() => handleDeleteSubject(row)}
                            disabled={deleteSubjectMutation.isPending}
                            className="text-red-500 hover:text-red-700 text-sm font-bold"
                            title="Delete this subject"
                          >
                            X
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Each row represents a student-subject combination. You can add multiple subjects per student using the form above.
              Total tuition = Price/Class x Present Count. The present count is shared across all subjects for the same student.
            </p>
          </div>
        </>
      )}

      {activeTab === 'commissions' && (
        <>
          {/* Year Selector and Teacher Filter */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <select
                value={commissionYear}
                onChange={(e) => setCommissionYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Teacher:</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Teachers</option>
                {uniqueTeacherNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Month Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b overflow-x-auto">
              {MONTH_NAMES.map((name, index) => {
                const monthNum = index + 1;
                const isSelected = commissionMonth === monthNum;
                const isCurrentMonth = today.getFullYear() === commissionYear && today.getMonth() + 1 === monthNum;
                return (
                  <button
                    key={monthNum}
                    onClick={() => setCommissionMonth(monthNum)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                      isSelected
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {SHORT_MONTH_NAMES[index]}
                    {isCurrentMonth && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Students</div>
              <div className="text-2xl font-bold text-gray-900">{commissionSummary.totalRows}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Classes</div>
              <div className="text-2xl font-bold text-gray-900">{commissionSummary.totalClasses}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Paid / Unpaid</div>
              <div className="text-2xl font-bold text-gray-900">
                <span className="text-green-600">{commissionSummary.paidCount}</span>
                <span className="text-gray-400"> / </span>
                <span className="text-red-600">{commissionSummary.unpaidCount}</span>
              </div>
            </div>
          </div>

          {/* Currency-specific Summary */}
          {Object.keys(commissionSummary.byCurrency).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {Object.entries(commissionSummary.byCurrency).map(([curr, data]) => (
                <div key={curr} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold text-gray-800">{CURRENCIES[curr]?.symbol} {curr}</span>
                    <span className="text-sm text-gray-500">{CURRENCIES[curr]?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500">Total Due</div>
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(data.total, curr)}</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs text-green-600">Paid ({data.paidCount})</div>
                      <div className="text-sm font-bold text-green-700">{formatCurrency(data.paid, curr)}</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-xs text-red-600">Unpaid ({data.unpaidCount})</div>
                      <div className="text-sm font-bold text-red-700">{formatCurrency(data.unpaid, curr)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Teachers Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Teacher Commissions - {MONTH_NAMES[commissionMonth - 1]} {commissionYear}
              </h3>
            </div>

            {teachersLoading ? (
              <div className="text-center py-8 text-gray-500">Loading teachers...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No teachers found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Commission
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeachers.map((row) => (
                    <tr key={row.id} className={row.paid ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {row.teacher_name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{row.student_name}</div>
                        {row.korean_name && (
                          <div className="text-xs text-blue-600 font-medium">{row.korean_name}</div>
                        )}
                        {row.english_name && (
                          <div className="text-sm text-gray-500">{row.english_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <select
                          value={row.currency || 'PHP'}
                          onChange={(e) => handleCommissionCurrencyChange(row, e.target.value, row.commission_per_class)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                            <option key={code} value={code}>{symbol} {code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          value={getCommissionValue(row.id, row.commission_per_class)}
                          onChange={(e) => handleCommissionChange(row.id, e.target.value)}
                          onBlur={() => handleCommissionBlur(row, row.commission_per_class, row.currency)}
                          placeholder="0"
                          className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          row.class_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {row.class_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${
                          row.total_commission > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {formatCurrency(row.total_commission, row.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleTeacherPayment(row)}
                          disabled={teacherPaymentMutation.isPending}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            row.paid
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {row.paid ? 'Paid' : 'Unpaid'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                        {row.payment_date ? new Date(row.payment_date + 'T00:00:00').toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Each row represents a student and their assigned teacher.
              Total commission is automatically calculated as Commission/Class x Classes (present attendance count).
            </p>
          </div>
        </>
      )}

      {activeTab === 'holidays' && (
        <>
          {/* Add Holiday Form */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Holiday</h3>
            <form onSubmit={handleAddHoliday} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name (optional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Christmas"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={addMutation.isPending || !newDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Holiday'}
              </button>
            </form>
            {addMutation.isError && (
              <p className="mt-2 text-red-600 text-sm">Failed to add holiday. Please try again.</p>
            )}
          </div>

          {/* Holidays List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Holidays ({holidays.length})
            </h3>

            {holidaysLoading ? (
              <div className="text-center py-8 text-gray-500">Loading holidays...</div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No holidays set. Add a holiday above.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(holidaysByYear).sort((a, b) => b[0] - a[0]).map(([year, yearHolidays]) => (
                  <div key={year}>
                    <h4 className="text-md font-medium text-gray-600 mb-2">{year}</h4>
                    <div className="space-y-2">
                      {yearHolidays.map((holiday) => {
                        const dateObj = new Date(holiday.date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        });

                        return (
                          <div
                            key={holiday.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-gray-900 font-medium">{formattedDate}</span>
                              {holiday.name && (
                                <span className="text-gray-600">- {holiday.name}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> Dates marked as holidays will be blocked from attendance marking.
              Teachers will not be able to check attendance on these dates.
            </p>
          </div>
        </>
      )}

      {activeTab === 'hidden' && (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Hidden Students ({hiddenRows.length})
            </h3>

            {hiddenLoading ? (
              <div className="text-center py-8 text-gray-500">Loading hidden students...</div>
            ) : hiddenRows.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hidden students. Students hidden from the attendance view will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hidden From
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hidden At
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hiddenRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{row.student_name || `ID: ${row.student_id}`}</div>
                          {row.korean_name && (
                            <div className="text-xs text-blue-600 font-medium">{row.korean_name}</div>
                          )}
                          {row.english_name && (
                            <div className="text-sm text-gray-500">{row.english_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-600 font-medium">
                          {row.subject || '(No subject)'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {row.hidden_from_year && row.hidden_from_month
                            ? `${MONTH_NAMES[row.hidden_from_month - 1]} ${row.hidden_from_year}`
                            : '(All months)'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {row.hidden_at ? new Date(row.hidden_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => {
                              if (window.confirm(`Unhide "${row.student_name || row.student_id}"${row.subject ? ` (${row.subject})` : ''}?`)) {
                                unhideMutation.mutate({ studentId: row.student_id, subject: row.subject });
                              }
                            }}
                            disabled={unhideMutation.isPending}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-gray-400"
                          >
                            Unhide
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Hidden students are removed from the attendance view starting from the "Hidden From" month.
              They will still appear in months before that date. Click "Unhide" to restore them to the attendance view.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminPanel;
