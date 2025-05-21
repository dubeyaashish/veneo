// src/components/TelegramLogin.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://ppg24.tech/api';
const BOT_USERNAME = process.env.REACT_APP_BOT_USERNAME || 'ppsalebuddy_bot';

const TelegramLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    // Define the Telegram callback in the global scope
    window.onTelegramAuth = (user) => {
      handleTelegramResponse(user);
    };

    // Create and append the Telegram script
    if (!containerRef.current) return;
    
    try {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;

      // Clear existing content
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);

      return () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    } catch (error) {
      console.error('Error loading Telegram widget:', error);
      setError('Failed to load Telegram login widget.');
    }
  }, []);

  const handleTelegramResponse = async (user) => {
    if (!user || !user.id) {
      setError('Invalid response from Telegram');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('Telegram auth data:', user);
      
      const response = await axios.post(`${API_URL}/auth/telegram`, user);
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Pass the user data to the auth context
        const isComplete = login(userData);
        
        if (isComplete) {
          // If registration is complete, go to dashboard
          navigate('/');
        } else {
          // If registration is incomplete, go to registration
          navigate('/register');
        }
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Error authenticating with Telegram:', error);
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Development-only test login
  const handleTestLogin = async () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const mockUser = {
      id: 123456789,
      first_name: "Test",
      last_name: "User",
      username: "testuser",
      photo_url: "",
      auth_date: Math.floor(Date.now() / 1000)
    };
    
    handleTelegramResponse(mockUser);
  };

  return (
    <div className="text-center my-4">
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <div ref={containerRef} id="telegram-login-container"></div>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-3">
          <button 
            className="btn btn-outline-primary"
            onClick={handleTestLogin}
            disabled={loading}
          >
            <i className="bi bi-bug me-2"></i> Test Login (Dev Only)
          </button>
        </div>
      )}
      
      {loading && (
        <div className="mt-3">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Processing login...</p>
        </div>
      )}
    </div>
  );
};

export default TelegramLogin;