// src/components/RegistrationPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const RegistrationPage = () => {
  const { pendingRegistration, completeRegistration, logout } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    employeeId: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If no pending registration, redirect to login
    if (!pendingRegistration) {
      navigate('/login');
    }
  }, [pendingRegistration, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate email
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email address is invalid';
    }
    
    // Validate employee ID
    if (!formData.employeeId) {
      newErrors.employeeId = 'Employee ID is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || !pendingRegistration) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Combine telegram data with form data
      const userData = {
        ...pendingRegistration,
        email: formData.email,
        employee_id: formData.employeeId,
        registration_complete: true
      };
      
      const response = await axios.post(`${API_URL}/auth/complete-registration`, userData);
      
      if (response.data.success) {
        // Update user in auth context with the complete data
        completeRegistration(response.data.user);
        
        // Redirect to dashboard
        navigate('/');
      } else {
        setErrors({ submit: response.data.message || 'Registration failed. Please try again.' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    logout();
    navigate('/login');
  };

  if (!pendingRegistration) {
    return null;
  }

  return (
    <div className="container">
      <div className="row justify-content-center mt-5">
        <div className="col-md-6">
          <div className="card shadow-lg border-0">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <i className="bi bi-person-plus-fill" style={{ fontSize: '3rem', color: 'var(--primary-color)' }}></i>
                <h2 className="mt-3 mb-4">Complete Your Registration</h2>
                <p className="text-muted mb-4">Please provide the following information to complete your account setup.</p>
              </div>
              
              {errors.submit && (
                <div className="alert alert-danger mb-4" role="alert">
                  {errors.submit}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="form-label">Email Address <span className="text-danger">*</span></label>
                  <div className="input-group">
                    <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      id="email"
                      name="email"
                      placeholder="Enter your work email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {errors.email && <div className="invalid-feedback d-block">{errors.email}</div>}
                </div>
                
                <div className="mb-4">
                  <label htmlFor="employeeId" className="form-label">Employee ID <span className="text-danger">*</span></label>
                  <div className="input-group">
                    <span className="input-group-text"><i className="bi bi-person-badge"></i></span>
                    <input
                      type="text"
                      className={`form-control ${errors.employeeId ? 'is-invalid' : ''}`}
                      id="employeeId"
                      name="employeeId"
                      placeholder="Enter your employee ID"
                      value={formData.employeeId}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {errors.employeeId && <div className="invalid-feedback d-block">{errors.employeeId}</div>}
                </div>
                
                <div className="d-grid gap-2 mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Complete Registration
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
              
              <div className="mt-4 text-center">
                <p className="text-muted small">
                  <i className="bi bi-info-circle me-1"></i>
                  This information is required to link your account with the sales order system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;