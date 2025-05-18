// src/context/AuthContext.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingRegistration, setPendingRegistration] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Check if we have a pending registration
          if (userData && !userData.registration_complete) {
            setPendingRegistration(userData);
            setCurrentUser(null);
          } else {
            setCurrentUser(userData);
            setPendingRegistration(null);
          }
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('user');
          setCurrentUser(null);
          setPendingRegistration(null);
        }
      } else {
        setCurrentUser(null);
        setPendingRegistration(null);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Login user
  const login = (user) => {
    if (user && !user.registration_complete) {
      // Store the pending registration
      setPendingRegistration(user);
      localStorage.setItem('pendingUser', JSON.stringify(user));
      return false; // Registration needed
    } else {
      // Store the complete user
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      setPendingRegistration(null);
      localStorage.removeItem('pendingUser');
      return true; // No registration needed
    }
  };

  // Complete registration
  const completeRegistration = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    setCurrentUser(user);
    setPendingRegistration(null);
    localStorage.removeItem('pendingUser');
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

// Protected Route Component
export const PrivateRoute = ({ children }) => {
  const { currentUser, loading, pendingRegistration } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (pendingRegistration) {
        // User needs to complete registration
        navigate('/register');
      } else if (!currentUser) {
        // User is not logged in
        navigate('/login');
      }
    }
  }, [currentUser, pendingRegistration, loading, navigate]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Only render children if user is logged in and registration is complete
  return currentUser ? children : null;
};

export default AuthContext;