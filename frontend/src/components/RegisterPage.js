// src/components/RegisterPage.js - Updated to match your backend
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
    employeeId: '',
    department: ''
  });
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingDepartments, setFetchingDepartments] = useState(true);

  useEffect(() => {
    // Redirect to login if no pending registration
    if (!pendingRegistration) {
      navigate('/login');
    }
  }, [pendingRegistration, navigate]);

  // Fetch departments for dropdown
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setFetchingDepartments(true);
        console.log('Fetching departments from:', `${API_URL}/departments`);
        
        const response = await axios.get(`${API_URL}/departments`);
        console.log('Departments response:', response.data);
        
        if (response.data.success && Array.isArray(response.data.departments)) {
          // Extract department names from the response
          setDepartments(response.data.departments.map(dept => dept.Name_no_hierarchy));
        } else {
          console.error('Failed to fetch departments:', response.data);
          setErrors(prev => ({
            ...prev, 
            departments: 'Failed to load departments from server'
          }));
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        setErrors(prev => ({
          ...prev, 
          departments: `Error loading departments: ${error.message}`
        }));
      } finally {
        setFetchingDepartments(false);
      }
    };

    fetchDepartments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Changed ${name} to ${value}`);
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors as user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate email
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Validate employee ID
    if (!formData.employeeId) {
      newErrors.employeeId = 'Employee ID is required';
    }
    
    // Validate department
    if (!formData.department) {
      newErrors.department = 'Department is required';
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
      
      // Prepare data for the API call
      const userData = {
        telegram_id: pendingRegistration.telegram_id,
        email: formData.email,
        employee_id: formData.employeeId,
        department: formData.department
      };
      
      console.log('Submitting registration data:', userData);
      
      // Send registration data to the server
      const response = await axios.post(`${API_URL}/auth/complete-registration`, userData);
      
      console.log('Registration response:', response.data);
      
      if (response.data.success) {
        // Complete registration in auth context
        completeRegistration(response.data.user);
        navigate('/');
      } else {
        setErrors({
          submit: response.data.message || 'Registration failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({
        submit: error.response?.data?.message || 'An error occurred during registration. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    logout();
    navigate('/login');
  };

  // If no pending registration data, don't render the form
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
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
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
                
                <div className="mb-4">
                  <label htmlFor="department" className="form-label">แผนก <span className="text-danger">*</span></label>
                  <div className="input-group">
                    <span className="input-group-text"><i className="bi bi-building"></i></span>
                    <select
                      className={`form-control ${errors.department ? 'is-invalid' : ''}`}
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      required
                      disabled={fetchingDepartments}
                    >
                      <option value="">-- เลือกแผนก --</option>
                      {departments.map((deptName, index) => (
                        <option key={index} value={deptName}>
                          {deptName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.department && <div className="invalid-feedback d-block">{errors.department}</div>}
                  {errors.departments && (
                    <div className="text-danger small mt-1">
                      {errors.departments}
                    </div>
                  )}
                  {fetchingDepartments && (
                    <div className="text-muted small mt-1">
                      <i className="bi bi-hourglass-split me-1"></i> Loading departments...
                    </div>
                  )}
                  
                  {/* Debug info for development */}
                  {process.env.NODE_ENV === 'development' && departments.length > 0 && (
                    <div className="text-muted small mt-2">
                      Loaded {departments.length} departments
                    </div>
                  )}
                </div>
                
                <div className="d-grid gap-2 mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || fetchingDepartments}
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