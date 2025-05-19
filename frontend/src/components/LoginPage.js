// src/components/LoginPage.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TelegramLogin from './TelegramLogin';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { currentUser, pendingRegistration } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if user is already logged in or has pending registration
    if (currentUser) {
      navigate('/');
    } else if (pendingRegistration) {
      navigate('/register');
    }
  }, [currentUser, pendingRegistration, navigate]);

  return (
    <div className="container">
      <div className="row justify-content-center mt-5">
        <div className="col-md-6">
          <div className="card shadow-lg border-0">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <i className="bi bi-stack" style={{ fontSize: '3rem', color: 'var(--primary-color)' }}></i>
                <h2 className="mt-3 mb-4">VERP</h2>
                <p className="text-muted">ระบบจัดการ Sales Order</p>
              </div>
              
              <div className="text-center mb-4">
                <h4>เข้าสู่ระบบด้วย Telegram</h4>
                <p className="text-muted">กรุณาเข้าสู่ระบบด้วยบัญชี Telegram ของคุณเพื่อเข้าใช้งานระบบ</p>
              </div>
              
              <TelegramLogin />
              
              <div className="mt-4 text-center">
                <p className="text-muted small">
                  การเข้าสู่ระบบด้วย Telegram จะช่วยให้คุณได้รับการแจ้งเตือนเกี่ยวกับ Sales Order ที่เกี่ยวข้องกับคุณโดยตรง
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;