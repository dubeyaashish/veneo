// src/layouts/MainLayout.js
import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: 'chart-bar', label: 'Dashboard' },
    { path: '/orders', icon: 'shopping-cart', label: 'Orders' },
    { path: '/profile', icon: 'user-circle', label: 'Profile' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div 
        className={`bg-white shadow-lg transform ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-0'
        } md:translate-x-0 md:w-64 transition-all duration-300 fixed inset-y-0 left-0 z-30`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-16 bg-blue-600">
          <h1 className="text-white font-bold text-xl">Sales Order System</h1>
        </div>
        
        {/* Nav Links */}
        <nav className="mt-5 px-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center px-2 py-3 text-base font-medium rounded-md ${
                location.pathname.startsWith(item.path)
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <i className={`fas fa-${item.icon} mr-3 h-5 w-5 ${
                location.pathname.startsWith(item.path)
                  ? 'text-blue-500'
                  : 'text-gray-500 group-hover:text-blue-500'
              }`}></i>
              {item.label}
            </Link>
          ))}
        </nav>
        
        {/* User Info */}
        <div className="absolute bottom-0 w-full">
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  {currentUser?.firstName?.charAt(0)}{currentUser?.lastName?.charAt(0)}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">
                  {currentUser?.firstName} {currentUser?.lastName}
                </p>
                <button
                  onClick={handleLogout}
                  className="text-xs font-medium text-gray-500 hover:text-blue-500"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-0'} flex flex-col overflow-hidden`}>
        {/* Top Navigation */}
        <header className="bg-white shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden text-gray-500 focus:outline-none"
            >
              <i className={`fas fa-${isSidebarOpen ? 'times' : 'bars'} h-6 w-6`}></i>
            </button>
            
            <div className="flex items-center">
              <div className="ml-3 relative">
                <h2 className="text-xl font-semibold text-gray-800">
                  {menuItems.find(item => location.pathname.startsWith(item.path))?.label || 'Dashboard'}
                </h2>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4">
          <div className="container mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;