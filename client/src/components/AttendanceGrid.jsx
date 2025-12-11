import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAttendance, deleteAttendance, setNote } from '../services/api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AttendanceGrid({ students, attendance, notes, holidays = [], year, month, isLoading }) {
  const queryClient = useQueryClient();
  const [dropdown, setDropdown] = useState(null); // { studentId, dateStr, subject, x, y }
  const [editingNote, setEditingNote] = useState({}); // { rowKey: noteText }
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get today's date string for highlighting
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Generate days for the month
  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month - 1, i + 1);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return {
        day: i + 1,
        dayName: DAY_NAMES[date.getDay()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        dateStr,
        isToday: dateStr === todayStr
      };
    });
  }, [year, month, todayStr]);

  // Create attendance lookup map (now includes subject)
  const attendanceMap = useMemo(() => {
    const map = {};
    attendance.forEach(record => {
      const dateStr = record.date.split('T')[0];
      // Key includes subject for students with multiple subjects
      const key = `${record.student_id}-${record.subject || 'default'}-${dateStr}`;
      map[key] = record.status;
    });
    return map;
  }, [attendance]);

  // Create notes lookup map (now includes subject)
  const notesMap = useMemo(() => {
    const map = {};
    notes.forEach(note => {
      // Key includes subject for students with multiple subjects
      const key = `${note.student_id}-${note.subject || 'default'}`;
      map[key] = note.notes;
    });
    return map;
  }, [notes]);

  // Create holidays lookup set
  const holidaysSet = useMemo(() => {
    const set = new Set();
    holidays.forEach(holiday => {
      set.add(holiday.date);
    });
    return set;
  }, [holidays]);

  const isHoliday = (dateStr) => holidaysSet.has(dateStr);

  // Map schedule day abbreviations to day of week numbers (0=Sun, 1=Mon, etc.)
  const scheduleDayMap = {
    'Su': 0, 'M': 1, 'T': 2, 'W': 3, 'Th': 4, 'F': 5, 'Sa': 6
  };

  // Parse schedule_days string like "MWF" or "MTWThF" into array of day numbers
  const parseScheduleDays = (scheduleDays) => {
    if (!scheduleDays) return [];
    const days = [];
    let i = 0;
    while (i < scheduleDays.length) {
      // Check for two-character abbreviations first
      if (i + 1 < scheduleDays.length) {
        const twoChar = scheduleDays.substring(i, i + 2);
        if (scheduleDayMap[twoChar] !== undefined) {
          days.push(scheduleDayMap[twoChar]);
          i += 2;
          continue;
        }
      }
      // Single character
      const oneChar = scheduleDays[i];
      if (scheduleDayMap[oneChar] !== undefined) {
        days.push(scheduleDayMap[oneChar]);
      }
      i++;
    }
    return days;
  };

  // Calculate attendance percentage based on schedule
  // Only counts days that have attendance marked (present, absent, or ta)
  const getAttendancePercentage = (studentId, subject, scheduleDays) => {
    const scheduledDayNumbers = parseScheduleDays(scheduleDays);
    if (scheduledDayNumbers.length === 0) return null;

    let markedCount = 0;
    let presentCount = 0;
    let taCount = 0;

    days.forEach(day => {
      const date = new Date(year, month - 1, day.day);
      const dayOfWeek = date.getDay();

      // Only count if this day is in the student's schedule
      if (!scheduledDayNumbers.includes(dayOfWeek)) return;

      // Skip holidays
      if (isHoliday(day.dateStr)) return;

      const status = getAttendanceStatus(studentId, subject, day.dateStr);

      // Only count days that have attendance marked
      if (!status) return;

      markedCount++;
      if (status === 'present') presentCount++;
      if (status === 'ta') taCount++;
    });

    // Exclude TA days from the total (teacher absence shouldn't count against student)
    const effectiveMarked = markedCount - taCount;
    if (effectiveMarked <= 0) return null;

    return Math.round((presentCount / effectiveMarked) * 100);
  };

  // Set attendance mutation with optimistic update (now includes subject)
  const setMutation = useMutation({
    mutationFn: ({ studentId, date, status, subject }) => setAttendance(studentId, date, status, null, subject),
    onMutate: async ({ studentId, date, status, subject }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['attendance', year, month]);

      // Snapshot the previous value
      const previousAttendance = queryClient.getQueryData(['attendance', year, month]);

      // Optimistically update the cache
      queryClient.setQueryData(['attendance', year, month], (old = []) => {
        const existingIndex = old.findIndex(
          r => r.student_id === studentId && r.date.split('T')[0] === date && (r.subject || null) === (subject || null)
        );
        if (existingIndex >= 0) {
          // Update existing record
          const newData = [...old];
          newData[existingIndex] = { ...newData[existingIndex], status };
          return newData;
        } else {
          // Add new record
          return [...old, { student_id: studentId, date, status, subject }];
        }
      });

      // Return context with previous value for rollback
      return { previousAttendance };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAttendance) {
        queryClient.setQueryData(['attendance', year, month], context.previousAttendance);
      }
    }
  });

  // Delete attendance mutation with optimistic update (now includes subject)
  const deleteMutation = useMutation({
    mutationFn: ({ studentId, date, subject }) => deleteAttendance(studentId, date, subject),
    onMutate: async ({ studentId, date, subject }) => {
      await queryClient.cancelQueries(['attendance', year, month]);

      const previousAttendance = queryClient.getQueryData(['attendance', year, month]);

      // Optimistically remove from cache
      queryClient.setQueryData(['attendance', year, month], (old = []) => {
        return old.filter(
          r => !(r.student_id === studentId && r.date.split('T')[0] === date && (r.subject || null) === (subject || null))
        );
      });

      return { previousAttendance };
    },
    onError: (err, variables, context) => {
      if (context?.previousAttendance) {
        queryClient.setQueryData(['attendance', year, month], context.previousAttendance);
      }
    }
  });

  // Set note mutation (now includes subject)
  const noteMutation = useMutation({
    mutationFn: ({ studentId, noteText, subject }) => setNote(studentId, year, month, noteText, subject),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes', year, month]);
    }
  });

  // Note handlers now use rowKey (studentId-subject combination)
  const handleNoteChange = (rowKey, value) => {
    setEditingNote(prev => ({ ...prev, [rowKey]: value }));
  };

  const handleNoteBlur = (studentId, subject, rowKey) => {
    const noteText = editingNote[rowKey];
    const notesKey = `${studentId}-${subject || 'default'}`;
    if (noteText !== undefined && noteText !== notesMap[notesKey]) {
      noteMutation.mutate({ studentId, noteText, subject });
    }
  };

  const getNoteValue = (studentId, subject, rowKey) => {
    if (editingNote[rowKey] !== undefined) {
      return editingNote[rowKey];
    }
    const notesKey = `${studentId}-${subject || 'default'}`;
    return notesMap[notesKey] || '';
  };

  const handleCellClick = (e, studentId, dateStr, subject) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdown({
      studentId,
      dateStr,
      subject,
      x: rect.left,
      y: rect.bottom + 4
    });
  };

  const handleSelectStatus = (status) => {
    if (!dropdown) return;

    if (status === null) {
      deleteMutation.mutate({ studentId: dropdown.studentId, date: dropdown.dateStr, subject: dropdown.subject });
    } else {
      setMutation.mutate({ studentId: dropdown.studentId, date: dropdown.dateStr, status, subject: dropdown.subject });
    }
    setDropdown(null);
  };

  // Get attendance status now includes subject
  const getAttendanceStatus = (studentId, subject, dateStr) => {
    const key = `${studentId}-${subject || 'default'}-${dateStr}`;
    return attendanceMap[key] || null;
  };

  // Calculate summary for each student-subject row
  const getStudentSummary = (studentId, subject) => {
    let present = 0;
    let absent = 0;
    let ta = 0;
    days.forEach(day => {
      const status = getAttendanceStatus(studentId, subject, day.dateStr);
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'ta') ta++;
    });
    return { present, absent, ta };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No students found. Add students in the scheduling app first.
      </div>
    );
  }

  return (
    <div className="overflow-x-scroll bg-white rounded-lg shadow">
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-100">
            {/* Student name header */}
            <th className="sticky left-0 z-20 bg-gray-100 px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b min-w-[150px]">
              Student
            </th>
            {/* Teacher header */}
            <th className="bg-gray-100 px-3 py-3 text-left text-sm font-semibold text-gray-700 border-b min-w-[100px]">
              Teacher
            </th>
            {/* Subject header */}
            <th className="bg-indigo-50 px-3 py-3 text-left text-sm font-semibold text-indigo-700 border-b min-w-[80px]">
              Subject
            </th>
            {/* Schedule header */}
            <th className="bg-purple-50 px-3 py-3 text-left text-sm font-semibold text-purple-700 border-b min-w-[140px]">
              Schedule
            </th>
            {/* Attendance % header */}
            <th className="bg-emerald-50 px-2 py-3 text-center text-sm font-semibold text-emerald-700 border-b min-w-[50px]">
              %
            </th>
            {/* Notes header */}
            <th className="bg-yellow-50 px-3 py-3 text-left text-sm font-semibold text-yellow-700 border-b border-r min-w-[150px]">
              Notes
            </th>
            {/* Summary columns */}
            <th className="bg-green-50 px-2 py-3 text-center text-xs font-semibold text-green-700 border-b min-w-[40px]">
              P
            </th>
            <th className="bg-red-50 px-2 py-3 text-center text-xs font-semibold text-red-700 border-b min-w-[40px]">
              A
            </th>
            <th className="bg-blue-50 px-2 py-3 text-center text-xs font-semibold text-blue-700 border-b border-r min-w-[40px]">
              TA
            </th>
            {/* Day headers */}
            {days.map(day => {
              const holiday = isHoliday(day.dateStr);
              return (
                <th
                  key={day.day}
                  className={`px-1 py-2 text-center text-xs border-b min-w-[36px] ${
                    day.isToday
                      ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-500'
                      : holiday
                      ? 'bg-orange-100 text-orange-700'
                      : day.isWeekend
                      ? 'bg-gray-200 text-gray-500'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="font-semibold">{day.day}</div>
                  <div className={`text-[10px] ${day.isToday ? 'text-amber-800' : ''}`}>{holiday ? 'H' : day.dayName}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => {
            const rowKey = student.row_key || `${student.id}-default`;
            const summary = getStudentSummary(student.id, student.subject);
            return (
              <tr
                key={rowKey}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {/* Student name */}
                <td className="sticky left-0 z-10 px-4 py-2 text-sm border-b bg-inherit">
                  <div className="font-medium text-gray-900">{student.name}</div>
                  {student.english_name && (
                    <div className="text-xs text-gray-500">{student.english_name}</div>
                  )}
                </td>
                {/* Teacher */}
                <td className="px-3 py-2 text-sm border-b text-gray-700">
                  {student.teacher_name || '-'}
                </td>
                {/* Subject */}
                <td className="px-3 py-2 text-sm border-b bg-indigo-50 text-indigo-700">
                  {student.subject || '-'}
                </td>
                {/* Schedule */}
                <td className="px-3 py-2 text-sm border-b bg-purple-50">
                  {student.schedule_time ? (
                    <div>
                      <div className="text-purple-700 font-medium text-xs">{student.schedule_time}</div>
                      <div className="text-purple-500 text-xs">{student.schedule_days}</div>
                    </div>
                  ) : '-'}
                </td>
                {/* Attendance % */}
                <td className="px-2 py-2 text-center text-sm font-medium border-b bg-emerald-50">
                  {(() => {
                    const pct = getAttendancePercentage(student.id, student.subject, student.schedule_days);
                    if (pct === null) return <span className="text-gray-400">-</span>;
                    return (
                      <span className={
                        pct >= 90 ? 'text-emerald-600' :
                        pct >= 75 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {pct}%
                      </span>
                    );
                  })()}
                </td>
                {/* Notes cell */}
                <td className="px-2 py-1 border-b border-r bg-yellow-50">
                  <input
                    type="text"
                    value={getNoteValue(student.id, student.subject, rowKey)}
                    onChange={(e) => handleNoteChange(rowKey, e.target.value)}
                    onBlur={() => handleNoteBlur(student.id, student.subject, rowKey)}
                    placeholder="Add note..."
                    className="w-full px-2 py-1 text-sm bg-transparent border border-transparent rounded hover:border-yellow-300 focus:border-yellow-400 focus:outline-none focus:bg-white"
                  />
                </td>
                {/* Summary cells */}
                <td className="px-2 py-2 text-center text-sm font-medium text-green-600 border-b bg-green-50">
                  {summary.present}
                </td>
                <td className="px-2 py-2 text-center text-sm font-medium text-red-600 border-b bg-red-50">
                  {summary.absent}
                </td>
                <td className="px-2 py-2 text-center text-sm font-medium text-blue-600 border-b border-r bg-blue-50">
                  {summary.ta}
                </td>
                {/* Day cells */}
                {days.map(day => {
                  const status = getAttendanceStatus(student.id, student.subject, day.dateStr);
                  const holiday = isHoliday(day.dateStr);
                  return (
                    <td
                      key={day.day}
                      className={`px-1 py-2 text-center border-b transition-colors ${
                        day.isToday
                          ? 'bg-amber-100 cursor-pointer'
                          : holiday
                          ? 'bg-orange-50 cursor-not-allowed'
                          : day.isWeekend
                          ? 'bg-gray-100 cursor-pointer'
                          : 'cursor-pointer'
                      }`}
                      onClick={holiday ? undefined : (e) => handleCellClick(e, student.id, day.dateStr, student.subject)}
                    >
                      {holiday ? (
                        <div className="w-7 h-7 mx-auto rounded bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-xs font-medium text-orange-500">
                          H
                        </div>
                      ) : (
                        <div
                          className={`
                            w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-medium
                            transition-all hover:scale-110
                            ${status === 'present'
                              ? 'bg-green-500 text-white'
                              : status === 'absent'
                              ? 'bg-red-500 text-white'
                              : status === 'ta'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                            }
                          `}
                        >
                          {status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'ta' ? 'TA' : '-'}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Dropdown Menu */}
      {dropdown && (
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-lg border z-50 py-1 min-w-[140px]"
          style={{ left: dropdown.x, top: dropdown.y }}
        >
          <button
            onClick={() => handleSelectStatus('present')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
          >
            <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">P</span>
            <span>Present</span>
          </button>
          <button
            onClick={() => handleSelectStatus('absent')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
          >
            <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">A</span>
            <span>Absent</span>
          </button>
          <button
            onClick={() => handleSelectStatus('ta')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
          >
            <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">TA</span>
            <span>Teacher's Abs.</span>
          </button>
          <div className="border-t my-1"></div>
          <button
            onClick={() => handleSelectStatus(null)}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-gray-500"
          >
            <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">-</span>
            <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default AttendanceGrid;
