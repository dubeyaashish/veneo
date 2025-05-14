// src/components/StatCard.js
import React from 'react';

const StatCard = ({ title, value, icon, color, isCurrency = false, loading = false }) => {
  // Color classes
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500',
      light: 'bg-blue-100 text-blue-800',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-500',
      light: 'bg-green-100 text-green-800',
      text: 'text-green-600'
    },
    yellow: {
      bg: 'bg-yellow-500',
      light: 'bg-yellow-100 text-yellow-800',
      text: 'text-yellow-600'
    },
    red: {
      bg: 'bg-red-500',
      light: 'bg-red-100 text-red-800',
      text: 'text-red-600'
    },
    indigo: {
      bg: 'bg-indigo-500',
      light: 'bg-indigo-100 text-indigo-800',
      text: 'text-indigo-600'
    }
  };
  
  const classes = colorClasses[color] || colorClasses.blue;
  
  // Format value
  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB' }).format(value)
    : new Intl.NumberFormat().format(value);

  return (
    <div className="bg-white shadow rounded-lg p-5">
      <div className="flex items-center">
        <div className={`flex-shrink-0 rounded-md p-3 ${classes.light}`}>
          <i className={`fas fa-${icon} h-6 w-6`}></i>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd>
              {loading ? (
                <div className="h-8 animate-pulse bg-gray-200 rounded w-16 mt-1"></div>
              ) : (
                <div className={`text-lg font-semibold ${classes.text}`}>
                  {formattedValue}
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default StatCard;