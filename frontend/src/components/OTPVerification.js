// src/components/OTPVerification.js - Updated for better UX and error handling
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const OTPVerification = ({ userData, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState('');
  const inputRefs = useRef([]);
  const { completeRegistration } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Focus the first input when component mounts
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    
    // Send OTP on initial render
    sendOTP();
  }, []);
  
  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  const sendOTP = async () => {
    if (!userData || !userData.telegram_id) {
      setError('Invalid user data');
      return;
    }
    
    try {
      setSendingOtp(true);
      setError('');
      
      const response = await axios.post(`${API_URL}/auth/send-otp`, userData);
      
      if (response.data.success) {
        // Set masked email for display
        setMaskedEmail(response.data.email);
        // Set countdown for resend button (60 seconds)
        setCountdown(60);
        toast.success('OTP sent! Check your email inbox');
      } else {
        setError(response.data.message || 'Failed to send OTP');
        toast.error('Failed to send OTP');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      setError(error.response?.data?.message || 'Failed to send OTP');
      toast.error('Failed to send OTP: ' + (error.response?.data?.message || error.message));
    } finally {
      setSendingOtp(false);
    }
  };
  
  const handleResendOTP = () => {
    if (countdown === 0) {
      sendOTP();
    }
  };
  
  const handleOtpChange = (index, value) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      // Auto-focus to next input if value is entered
      if (value !== '' && index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };
  
  const handleKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1].focus();
    }
    
    // Allow navigation with arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };
  
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // If pasted data contains exactly 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      
      // Focus the last input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post(`${API_URL}/auth/verify-otp`, {
        ...userData,
        otp: otpValue
      });
      
      if (response.data.success) {
        // Complete registration with the updated user data
        completeRegistration(response.data.user);
        toast.success('Registration completed successfully!');
        navigate('/');
      } else {
        setError(response.data.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError(error.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="otp-verification">
      <div className="text-center mb-4">
        <i className="bi bi-shield-lock" style={{ fontSize: '3rem', color: 'var(--primary-color)' }}></i>
        <h2 className="mt-3 mb-4">OTP Verification</h2>
        <p className="text-muted">
          We've sent a One-Time Password to your email
          {maskedEmail && <strong> {maskedEmail}</strong>}
        </p>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="form-label">Enter 6-digit OTP</label>
          <div className="otp-input-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                className="otp-input"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : null}
                required
              />
            ))}
          </div>
        </div>
        
        <div className="d-grid gap-2 mt-4">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Verifying...
              </>
            ) : (
              'Verify & Complete Registration'
            )}
          </button>
          
          <div className="text-center mt-3">
            <p className="timer mb-2">
              {countdown > 0 ? (
                <>Didn't receive the OTP? Resend in <strong>{countdown}s</strong></>
              ) : (
                "Didn't receive the OTP?"
              )}
            </p>
            <button
              type="button"
              className="resend-button"
              onClick={handleResendOTP}
              disabled={countdown > 0 || sendingOtp}
            >
              {sendingOtp ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Sending...
                </>
              ) : (
                'Resend OTP'
              )}
            </button>
          </div>
          
          <button
            type="button"
            className="btn btn-outline-secondary mt-3"
            onClick={onBack}
            disabled={loading || sendingOtp}
          >
            Back to Information
          </button>
        </div>
      </form>
    </div>
  );
};

export default OTPVerification;