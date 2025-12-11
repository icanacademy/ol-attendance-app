import React from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function MonthTabs({ selectedMonth, selectedYear, onMonthChange, onYearChange }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="bg-white shadow-sm border-b">
      {/* Year selector */}
      <div className="flex items-center justify-center gap-4 py-3 border-b">
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xl font-semibold min-w-[80px] text-center">{selectedYear}</span>
        <button
          onClick={() => onYearChange(selectedYear + 1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Month tabs */}
      <div className="flex overflow-x-auto">
        {MONTHS.map((month, index) => {
          const monthNum = index + 1;
          const isSelected = monthNum === selectedMonth;

          return (
            <button
              key={month}
              onClick={() => onMonthChange(monthNum)}
              className={`
                flex-1 min-w-[80px] py-3 px-2 text-sm font-medium transition-colors
                ${isSelected
                  ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {month.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MonthTabs;
