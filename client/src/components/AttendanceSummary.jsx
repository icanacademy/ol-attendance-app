import React, { useMemo } from 'react';

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
    if (i + 1 < scheduleDays.length) {
      const twoChar = scheduleDays.substring(i, i + 2);
      if (scheduleDayMap[twoChar] !== undefined) {
        days.push(scheduleDayMap[twoChar]);
        i += 2;
        continue;
      }
    }
    const oneChar = scheduleDays[i];
    if (scheduleDayMap[oneChar] !== undefined) {
      days.push(scheduleDayMap[oneChar]);
    }
    i++;
  }
  return days;
};

// Get scheduled day numbers from a student's schedules array or schedule_days string
const getScheduledDayNumbers = (student) => {
  const dayNumbers = [];
  if (Array.isArray(student.schedules) && student.schedules.length > 0) {
    student.schedules.forEach(sched => {
      if (sched.days) {
        parseScheduleDays(sched.days).forEach(d => {
          if (!dayNumbers.includes(d)) dayNumbers.push(d);
        });
      }
    });
  } else if (student.schedule_days) {
    return parseScheduleDays(student.schedule_days);
  }
  return dayNumbers;
};

function AttendanceSummary({ students, attendance, holidays, year, month, isLoading }) {
  // Build attendance lookup map
  const attendanceMap = useMemo(() => {
    const map = {};
    attendance.forEach(record => {
      const dateStr = record.date.split('T')[0];
      const key = `${record.student_id}-${record.subject || 'default'}-${dateStr}`;
      map[key] = record.status;
    });
    return map;
  }, [attendance]);

  // Build holidays set
  const holidaySet = useMemo(() => {
    return new Set(holidays.map(h => h.date));
  }, [holidays]);

  // Generate days for the month
  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month - 1, i + 1);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return {
        day: i + 1,
        dayOfWeek: date.getDay(),
        dateStr
      };
    });
  }, [year, month]);

  // Compute per-student summary
  const summaryRows = useMemo(() => {
    return students.map(student => {
      const scheduledDayNumbers = getScheduledDayNumbers(student);
      const subject = student.subject || null;

      let totalScheduled = 0;
      let presentCount = 0;
      let absentCount = 0;
      let taCount = 0;
      let noshowCount = 0;

      days.forEach(day => {
        // Only count days in the student's schedule
        if (scheduledDayNumbers.length > 0 && !scheduledDayNumbers.includes(day.dayOfWeek)) return;
        // Skip weekends for students with no schedule info
        if (scheduledDayNumbers.length === 0 && (day.dayOfWeek === 0 || day.dayOfWeek === 6)) return;
        // Skip holidays
        if (holidaySet.has(day.dateStr)) return;

        totalScheduled++;

        const key = `${student.id}-${subject || 'default'}-${day.dateStr}`;
        const status = attendanceMap[key];

        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'ta') taCount++;
        else if (status === 'noshow') noshowCount++;
      });

      // attendance_percentage = present / (total - ta) * 100
      const effectiveTotal = totalScheduled - taCount;
      const percentage = effectiveTotal > 0
        ? Math.round((presentCount / effectiveTotal) * 100)
        : null;

      return {
        id: student.id,
        name: student.name,
        korean_name: student.korean_name,
        subject: subject,
        teacher_name: student.teacher_name,
        total_scheduled: totalScheduled,
        present_count: presentCount,
        absent_count: absentCount,
        ta_count: taCount,
        noshow_count: noshowCount,
        attendance_percentage: percentage
      };
    });
  }, [students, days, attendanceMap, holidaySet]);

  // Sort by attendance % ascending (lowest first to highlight problem students)
  const sortedRows = useMemo(() => {
    return [...summaryRows].sort((a, b) => {
      // Null percentages go to the top (no data = most concerning)
      if (a.attendance_percentage === null && b.attendance_percentage === null) return 0;
      if (a.attendance_percentage === null) return -1;
      if (b.attendance_percentage === null) return -1;
      return a.attendance_percentage - b.attendance_percentage;
    });
  }, [summaryRows]);

  // Compute totals row
  const totals = useMemo(() => {
    const t = {
      total_scheduled: 0,
      present_count: 0,
      absent_count: 0,
      ta_count: 0,
      noshow_count: 0
    };
    summaryRows.forEach(row => {
      t.total_scheduled += row.total_scheduled;
      t.present_count += row.present_count;
      t.absent_count += row.absent_count;
      t.ta_count += row.ta_count;
      t.noshow_count += row.noshow_count;
    });
    const effectiveTotal = t.total_scheduled - t.ta_count;
    t.attendance_percentage = effectiveTotal > 0
      ? Math.round((t.present_count / effectiveTotal) * 100)
      : null;
    return t;
  }, [summaryRows]);

  // Color class for the percentage column
  const getPercentageColor = (pct) => {
    if (pct === null) return 'text-gray-400';
    if (pct >= 90) return 'text-green-700 bg-green-50';
    if (pct >= 70) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  const getPercentageBadge = (pct) => {
    if (pct === null) return 'bg-gray-100 text-gray-400';
    if (pct >= 90) return 'bg-green-100 text-green-800';
    if (pct >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Loading summary...</div>
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">No students found for this month.</div>
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">
          Attendance Summary - {monthName}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {sortedRows.length} student{sortedRows.length !== 1 ? 's' : ''} - sorted by attendance % (lowest first)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">#</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Student</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Subject</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Teacher</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700">Scheduled</th>
              <th className="px-4 py-2.5 text-center font-semibold text-green-700">Present</th>
              <th className="px-4 py-2.5 text-center font-semibold text-red-700">Absent</th>
              <th className="px-4 py-2.5 text-center font-semibold text-blue-700">TA</th>
              <th className="px-4 py-2.5 text-center font-semibold text-orange-700">NoShow</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr
                key={`${row.id}-${row.subject || 'default'}`}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                }`}
              >
                <td className="px-4 py-2 text-gray-400 text-xs">{index + 1}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-gray-900">{row.name}</div>
                  {row.korean_name && (
                    <div className="text-xs text-gray-500">{row.korean_name}</div>
                  )}
                  <div className="text-[10px] text-gray-400">ID: {row.id}</div>
                </td>
                <td className="px-4 py-2 text-gray-600">{row.subject || '-'}</td>
                <td className="px-4 py-2 text-gray-600">{row.teacher_name || '-'}</td>
                <td className="px-4 py-2 text-center text-gray-700">{row.total_scheduled}</td>
                <td className="px-4 py-2 text-center">
                  <span className="text-green-700 font-medium">{row.present_count}</span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`font-medium ${row.absent_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {row.absent_count}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`font-medium ${row.ta_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {row.ta_count}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`font-medium ${row.noshow_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {row.noshow_count}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getPercentageBadge(row.attendance_percentage)}`}>
                    {row.attendance_percentage !== null ? `${row.attendance_percentage}%` : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
              <td className="px-4 py-2.5" colSpan={2}>
                <span className="text-gray-700">Totals / Average</span>
              </td>
              <td className="px-4 py-2.5" colSpan={2}></td>
              <td className="px-4 py-2.5 text-center text-gray-700">{totals.total_scheduled}</td>
              <td className="px-4 py-2.5 text-center text-green-700">{totals.present_count}</td>
              <td className="px-4 py-2.5 text-center text-red-700">{totals.absent_count}</td>
              <td className="px-4 py-2.5 text-center text-blue-700">{totals.ta_count}</td>
              <td className="px-4 py-2.5 text-center text-orange-700">{totals.noshow_count}</td>
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getPercentageBadge(totals.attendance_percentage)}`}>
                  {totals.attendance_percentage !== null ? `${totals.attendance_percentage}%` : '-'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default AttendanceSummary;
