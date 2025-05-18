// src/components/TelegramLogin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const BOT_USERNAME = process.env.REACT_APP_BOT_USERNAME || 'ppsalebuddy_bot';

const TelegramLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up Telegram login callback
    window.onTelegramAuth = (user) => {
      handleTelegramResponse(user);
    };

    try {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      
      // If we're using ngrok, we need to set the auth URL to match
      if (process.env.REACT_APP_PUBLIC_URL) {
        script.setAttribute('data-auth-url', `${process.env.REACT_APP_PUBLIC_URL}/login`);
      }
      
      script.async = true;

      const container = document.getElementById('telegram-login-container');
      if (container) {
        container.appendChild(script);
      }

      return () => {
        if (container && script && script.parentNode === container) {
          container.removeChild(script);
        }
      };
    } catch (error) {
      setError(`Error loading widget: ${error.message}`);
    }
  }, []);

  const handleTelegramResponse = async (user) => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Telegram user data:', user);
      
      const response = await axios.post(`${API_URL}/auth/telegram`, user);
      
      if (response.data.success) {
        const userData = response.data.user;
        const isComplete = login(userData);
        
        // If registration is complete, go to dashboard
        // Otherwise, go to registration page
        if (isComplete) {
          navigate('/');
        } else {
          navigate('/register');
        }
      } else {
        setError(response.data.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during Telegram login:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // For development testing only
  const handleTestLogin = () => {
    const mockTelegramUser = {
      id: 12345678,
      first_name: "Test",
      last_name: "User",
      username: "testuser",
      photo_url: "",
      auth_date: Math.floor(Date.now() / 1000)
    };
    
    handleTelegramResponse(mockTelegramUser);
  };

  return (
    <div className="text-center my-4">
      {error && (
        <div className="alert alert-danger mb-4">{error}</div>
      )}
      
      <div id="telegram-login-container"></div>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-3">
          <button 
            className="btn btn-outline-primary"
            onClick={handleTestLogin}
          >
            <i className="bi bi-bug"></i> Test Telegram Login
          </button>
        </div>
      )}
      
      {loading && (
        <div className="mt-3">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">กำลังเข้าสู่ระบบ...</p>
        </div>
      )}
    </div>
  );
};

export default TelegramLogin;