// src/components/SearchPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SearchPage = () => {
  const [orderId, setOrderId] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleSearch = (e) => {
    e.preventDefault();
    if (orderId.trim()) {
      navigate(`/order/${orderId.trim()}`);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <div className="search-card text-center">
          <i className="bi bi-search search-icon"></i>
          <h2 className="search-title">ค้นหา Sales Order</h2>
          <p className="text-muted mb-4">กรอก Order ID เพื่อดูรายละเอียดและแก้ไขข้อมูล Sales Order</p>
          
          <form onSubmit={handleSearch} className="mt-4">
            <div className="input-group mb-3">
              <span className="input-group-text"><i className="bi bi-hash"></i></span>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                placeholder="กรอก Order ID ที่ต้องการค้นหา"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-lg">
                <i className="bi bi-search"></i> ค้นหา
              </button>
            </div>
          </form>

          {currentUser?.staff_code && (
            <div className="alert alert-info mt-3">
              <i className="bi bi-info-circle"></i> คุณกำลังค้นหาในฐานะพนักงานรหัส: {currentUser.staff_code}
            </div>
          )}

          <div className="row mt-5">
            <div className="col-md-4">
              <div className="card p-4 text-center">
                <i className="bi bi-clock-history text-primary mb-3" style={{ fontSize: '2rem' }}></i>
                <h5>ค้นหาล่าสุด</h5>
                <p className="text-muted">ดูรายการที่ค้นหาล่าสุด</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 text-center">
                <i className="bi bi-star text-primary mb-3" style={{ fontSize: '2rem' }}></i>
                <h5>รายการโปรด</h5>
                <p className="text-muted">ดูรายการที่บันทึกไว้</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-4 text-center">
                <i className="bi bi-bar-chart text-primary mb-3" style={{ fontSize: '2rem' }}></i>
                <h5>รายงาน</h5>
                <p className="text-muted">ดูสถิติและรายงาน</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;