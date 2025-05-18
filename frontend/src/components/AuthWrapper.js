// src/components/AuthWrapper.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';
import RegistrationForm from './RegisterPage';

const AuthWrapper = () => {
  const { currentUser } = useAuth();
  const [tempUser, setTempUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // If user is fully logged in, redirect to dashboard
    if (currentUser && currentUser.registration_complete) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // This will be called from TelegramLogin component when auth is successful
  // but registration is not complete
  const handleAuth = (userData) => {
    setTempUser(userData);
  };

  // If we have a temp user but registration is not complete,
  // show the registration form
  if (tempUser && !tempUser.registration_complete) {
    return <RegistrationForm telegramUser={tempUser} />;
  }

  // Otherwise show the login page with the onAuth callback
  return <LoginPage onAuth={handleAuth} />;
};

export default AuthWrapper;