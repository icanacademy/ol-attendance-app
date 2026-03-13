import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeachers, getTeacherSchedule } from '../services/api';

const statusConfig = {
  present: { label: 'Present', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  absent: { label: 'Absent', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  ta: { label: 'TA', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  noshow: { label: 'No Show', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
};

function TeacherDashboard() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Fetch teacher list
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: getTeachers,
  });

  // Fetch schedule when teacher and date are selected
  const { data: schedule = [], isLoading: scheduleLoading, error: scheduleError } = useQuery({
    queryKey: ['teacher-schedule', selectedTeacher, selectedDate],
    queryFn: () => getTeacherSchedule(selectedTeacher, selectedDate),
    enabled: !!selectedTeacher && !!selectedDate,
  });

  // Group schedule entries by time slot
  const groupedSchedule = useMemo(() => {
    const groups = {};
    schedule.forEach(entry => {
      const key = `${entry.start_time} - ${entry.end_time}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return groups;
  }, [schedule]);

  const timeSlots = Object.keys(groupedSchedule);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { total: schedule.length, present: 0, absent: 0, ta: 0, noshow: 0, unmarked: 0 };
    schedule.forEach(entry => {
      if (entry.attendance_status && counts[entry.attendance_status] !== undefined) {
        counts[entry.attendance_status]++;
      } else {
        counts.unmarked++;
      }
    });
    return counts;
  }, [schedule]);

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Teacher Select */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a teacher...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Today button */}
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200 text-sm font-medium"
            >
              Today
            </button>
          )}
        </div>

        {/* Date display */}
        {selectedDate && (
          <div className="mt-3 text-sm text-gray-500">
            {formatDisplayDate(selectedDate)}
          </div>
        )}
      </div>

      {/* Loading state */}
      {teachersLoading && (
        <div className="text-center py-8 text-gray-500">Loading teachers...</div>
      )}

      {/* No teacher selected */}
      {!selectedTeacher && !teachersLoading && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-gray-400 text-lg mb-2">Select a teacher to view their schedule</div>
          <div className="text-gray-300 text-sm">Choose a teacher from the dropdown above</div>
        </div>
      )}

      {/* Schedule loading */}
      {selectedTeacher && scheduleLoading && (
        <div className="text-center py-8 text-gray-500">Loading schedule...</div>
      )}

      {/* Error state */}
      {scheduleError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load schedule. Please try again.
        </div>
      )}

      {/* Schedule content */}
      {selectedTeacher && !scheduleLoading && !scheduleError && (
        <>
          {/* Summary bar */}
          {schedule.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-gray-700">{summary.total} student{summary.total !== 1 ? 's' : ''}</span>
              <span className="text-gray-300">|</span>
              {summary.present > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">{summary.present} present</span>
                </span>
              )}
              {summary.absent > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-gray-600">{summary.absent} absent</span>
                </span>
              )}
              {summary.ta > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-gray-600">{summary.ta} TA</span>
                </span>
              )}
              {summary.noshow > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="text-gray-600">{summary.noshow} no show</span>
                </span>
              )}
              {summary.unmarked > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span>
                  <span className="text-gray-600">{summary.unmarked} unmarked</span>
                </span>
              )}
            </div>
          )}

          {/* Empty state */}
          {schedule.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">No classes scheduled</div>
              <div className="text-gray-300 text-sm">
                {selectedTeacher} has no classes on {formatDisplayDate(selectedDate)}
              </div>
            </div>
          )}

          {/* Time slot groups */}
          {timeSlots.map(slot => (
            <div key={slot} className="mb-6">
              {/* Time slot header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm font-medium">
                  {slot}
                </div>
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="text-xs text-gray-400">
                  {groupedSchedule[slot].length} student{groupedSchedule[slot].length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Student cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {groupedSchedule[slot].map((entry, idx) => {
                  const status = entry.attendance_status ? statusConfig[entry.attendance_status] : null;
                  return (
                    <div
                      key={`${entry.name}-${entry.subject}-${idx}`}
                      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{entry.name}</div>
                        {entry.korean_name && (
                          <div className="text-sm text-gray-500">{entry.korean_name}</div>
                        )}
                        <div className="text-sm text-gray-400 mt-1">{entry.subject}</div>
                      </div>
                      <div>
                        {status ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}>
                            {status.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">
                            Not marked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default TeacherDashboard;
