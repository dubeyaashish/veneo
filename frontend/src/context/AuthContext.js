// src/context/AuthContext.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const pendingUser = localStorage.getItem('pendingUser');
        
        if (pendingUser) {
          // If there's a pending registration
          setPendingRegistration(JSON.parse(pendingUser));
          setCurrentUser(null);
        } else if (storedUser) {
          // If there's a complete user
          setCurrentUser(JSON.parse(storedUser));
          setPendingRegistration(null);
        } else {
          // No user stored
          setCurrentUser(null);
          setPendingRegistration(null);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('pendingUser');
        setCurrentUser(null);
        setPendingRegistration(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login user
  const login = (userData) => {
    if (!userData) return false;
    
    if (!userData.registration_complete) {
      // Store the pending registration
      localStorage.setItem('pendingUser', JSON.stringify(userData));
      setPendingRegistration(userData);
      setCurrentUser(null);
      return false; // Registration needed
    } else {
      // Store the complete user
      localStorage.setItem('user', JSON.stringify(userData));
      setCurrentUser(userData);
      setPendingRegistration(null);
      localStorage.removeItem('pendingUser');
      return true; // Registration complete
    }
  };

  // Complete registration
  const completeRegistration = (userData) => {
    if (!userData) return;
    
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.removeItem('pendingUser');
    setCurrentUser(userData);
    setPendingRegistration(null);
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('pendingUser');
    setCurrentUser(null);
    setPendingRegistration(null);
  };

  const value = {
    currentUser,
    pendingRegistration,
    loading,
    login,
    completeRegistration,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using Auth Context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Private Route Component
export const PrivateRoute = ({ children }) => {
  const { currentUser, loading, pendingRegistration } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (pendingRegistration) {
    return <Navigate to="/register" state={{ from: location }} replace />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default AuthContext;