// src/components/Navbar.js - Fixed version
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white fixed-top shadow-sm">
      <div className="container">
        <Link className="navbar-brand" to={currentUser ? '/' : '/login'}>
          <i className="bi bi-stack"></i> VERP
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {currentUser ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    <i className="bi bi-speedometer2"></i> Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/search">
                    <i className="bi bi-search"></i> ค้นหา
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/help">
                    <i className="bi bi-question-circle"></i> ช่วยเหลือ
                  </Link>
                </li>
              </>
            ) : (
              <li className="nav-item">
                <Link className="nav-link" to="/login">
                  <i className="bi bi-box-arrow-in-right"></i> เข้าสู่ระบบ
                </Link>
              </li>
            )}
          </ul>
          
          {currentUser && (
            <div className="ms-3 d-flex align-items-center">
              {currentUser.photo_url ? (
                <img 
                  src={currentUser.photo_url} 
                  alt={currentUser.first_name || 'User'} 
                  className="rounded-circle" 
                  style={{ width: '40px', height: '40px' }} 
                />
              ) : (
                <div className="avatar">
                  {/* Add null check for first_name */}
                  {currentUser.first_name ? currentUser.first_name.charAt(0) : 'U'}
                </div>
              )}
              <div className="dropdown">
                <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                  {currentUser.first_name || ''} {currentUser.last_name || ''}
                </a>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <span className="dropdown-item">
                      <i className="bi bi-person"></i> {currentUser.staff_code ? `Staff Code: ${currentUser.staff_code}` : 'No Staff Code'}
                    </span>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right"></i> ออกจากระบบ
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;