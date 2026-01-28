import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClassCountRange } from '../services/api';

function ClassCountModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  selectedTeacher,
  onClearRange
}) {
  const [statuses, setStatuses] = useState({
    present: true,
    absent: false,
    ta: true,
    noshow: false
  });
  const [useTeacherFilter, setUseTeacherFilter] = useState(true);

  // Build statuses array from checkboxes
  const selectedStatuses = useMemo(() => {
    return Object.entries(statuses)
      .filter(([_, checked]) => checked)
      .map(([status]) => status);
  }, [statuses]);

  // Fetch data when modal is open and we have a valid range
  const { data, isLoading, error } = useQuery({
    queryKey: ['classCountRange', startDate, endDate, selectedStatuses, useTeacherFilter ? selectedTeacher : null],
    queryFn: () => getClassCountRange(
      startDate,
      endDate,
      selectedStatuses,
      useTeacherFilter ? selectedTeacher : null
    ),
    enabled: isOpen && !!startDate && !!endDate && selectedStatuses.length > 0
  });

  const toggleStatus = (status) => {
    setStatuses(prev => ({ ...prev, [status]: !prev[status] }));
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!isOpen) return null;

  // Calculate grand total
  const grandTotal = data?.teachers?.reduce((sum, teacher) => sum + teacher.totalClasses, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Class Count: {formatDate(startDate)} - {formatDate(endDate)}
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Count statuses:</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statuses.present}
                  onChange={() => toggleStatus('present')}
                  className="rounded text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-green-700">Present</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statuses.ta}
                  onChange={() => toggleStatus('ta')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-blue-700">TA</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statuses.absent}
                  onChange={() => toggleStatus('absent')}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-red-700">Absent</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statuses.noshow}
                  onChange={() => toggleStatus('noshow')}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-orange-700">No-show</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useTeacherFilter}
                onChange={() => setUseTeacherFilter(!useTeacherFilter)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
                disabled={!selectedTeacher}
              />
              <span className={`text-sm ${selectedTeacher ? 'text-gray-700' : 'text-gray-400'}`}>
                Use current teacher filter {selectedTeacher ? `(${selectedTeacher})` : '(none selected)'}
              </span>
            </label>
            <button
              onClick={() => {
                onClearRange();
                onClose();
              }}
              className="ml-auto text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Clear Range
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Failed to load data. Please try again.
            </div>
          ) : selectedStatuses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Please select at least one status to count.
            </div>
          ) : data?.teachers?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No classes found for the selected criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {data?.teachers?.map((teacher) => (
                <div key={teacher.teacherId || 'unknown'} className="border rounded-lg overflow-hidden">
                  {/* Teacher header */}
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-800">
                      {teacher.teacherName || 'Unknown Teacher'}
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                      Subtotal: {teacher.totalClasses} classes
                    </span>
                  </div>
                  {/* Students */}
                  <div className="divide-y">
                    {teacher.students?.map((student) => (
                      <div key={`${student.studentId}-${student.subject}`} className="px-4 py-2 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800">{student.studentName}</span>
                          {student.subject && (
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                              {student.subject}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                          {student.classCount} classes
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-gray-900">
              TOTAL: {grandTotal} classes
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassCountModal;
