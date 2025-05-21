// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';
import SearchPage from './components/SearchPage';
import EditOrder from './components/EditOrder';
import SaleCoResponse from './components/SaleCoResponse';
import Navbar from './components/Navbar';
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <div className="content-container">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/search" element={
                <PrivateRoute>
                  <SearchPage />
                </PrivateRoute>
              } />
              <Route path="/order/:id" element={
                <PrivateRoute>
                  <EditOrder />
                </PrivateRoute>
              } />
              <Route path="/response/:id" element={
                <PrivateRoute>
                  <SaleCoResponse />
                </PrivateRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <ToastContainer position="top-right" autoClose={3000} />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;