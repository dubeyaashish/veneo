// src/components/Navbar.js
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
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
            <div className="ms-3 d-flex align-items-center" ref={dropdownRef}>
              <div className="dropdown">
                <button 
                  className="btn dropdown-toggle d-flex align-items-center" 
                  type="button" 
                  onClick={toggleDropdown}
                  style={{border: 'none', background: 'none', padding: '0.5rem'}}
                >
                  {currentUser.photo_url ? (
                    <img 
                      src={currentUser.photo_url} 
                      alt={currentUser.first_name || 'User'} 
                      className="rounded-circle me-2" 
                      style={{ width: '40px', height: '40px' }} 
                    />
                  ) : (
                    <div className="avatar me-2">
                      {currentUser.first_name ? currentUser.first_name.charAt(0) : 'U'}
                    </div>
                  )}
                  <span>{currentUser.first_name || ''} {currentUser.last_name || ''}</span>
                </button>
                
                {dropdownOpen && (
                  <ul className="dropdown-menu dropdown-menu-end show" style={{position: 'absolute', right: 0}}>
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;