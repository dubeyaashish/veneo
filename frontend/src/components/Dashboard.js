// src/components/Dashboard.js - Updated with better error handling
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser || !currentUser.staff_code) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/orders/staff/${currentUser.staff_code}`);
        
        if (response.data.success) {
          setOrders(response.data.orders);
        } else {
          setError('Failed to fetch orders');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('An error occurred while fetching your orders');
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);

  if (!currentUser) {
    // This should never happen since PrivateRoute should prevent it
    console.error('Dashboard rendered without user - this should not happen');
    return null;
  }

  // Display a message if the user doesn't have a staff code
  if (!currentUser.staff_code) {
    return (
      <div className="container mt-5">
        <div className="card shadow-lg border-0">
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <i className="bi bi-exclamation-triangle-fill text-warning" style={{ fontSize: '3rem' }}></i>
              <h3 className="mt-3">Staff Code Not Linked</h3>
              <p className="text-muted">
                Your Telegram account is not linked with a staff code. Please contact your administrator to set up this link.
              </p>
            </div>
            
            <div className="card bg-light">
              <div className="card-body">
                <h5>Your Telegram Information</h5>
                <p><strong>ID:</strong> {currentUser.telegram_id || 'Not available'}</p>
                <p><strong>Name:</strong> {currentUser.first_name || ''} {currentUser.last_name || ''}</p>
                <p><strong>Username:</strong> {currentUser.username ? `@${currentUser.username}` : 'Not provided'}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-muted small text-center">
                Once your staff code is linked, you'll be able to receive notifications about your sales orders.
              </p>
              
              <div className="text-center mt-3">
                <Link to="/search" className="btn btn-primary">
                  <i className="bi bi-search"></i> Search for Sales Orders
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-8">
          <h2 className="page-title">
            <i className="bi bi-speedometer2"></i> Dashboard
          </h2>
        </div>
        <div className="col-md-4 text-end">
          <span className="badge bg-primary">Staff Code: {currentUser.staff_code}</span>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center p-4">
              <i className="bi bi-file-earmark-text text-primary mb-3" style={{ fontSize: '2.5rem' }}></i>
              <h3>{orders.length}</h3>
              <p className="text-muted">Recent Sales Orders</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center p-4">
              <i className="bi bi-check-circle text-success mb-3" style={{ fontSize: '2.5rem' }}></i>
              <h3>{orders.filter(order => order.status === 'created').length}</h3>
              <p className="text-muted">Created Orders</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center p-4">
              <i className="bi bi-clock-history text-warning mb-3" style={{ fontSize: '2.5rem' }}></i>
              <h3>{orders.filter(order => order.status !== 'created').length}</h3>
              <p className="text-muted">Pending Orders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header bg-primary text-white">
          <i className="bi bi-list-ul"></i> Your Recent Sales Orders
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : orders.length === 0 ? (
            <div className="alert alert-info">You don't have any sales orders yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>SO Number</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.salesOrderNo}>
                      <td>{order.salesOrderNo}</td>
                      <td>{order.customerCode}</td>
                      <td>{new Date(order.salesOrderDate).toLocaleDateString('en-GB')}</td>
                      <td>${parseFloat(order.grandTotal).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${order.status === 'created' ? 'bg-success' : 'bg-warning'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/order/${order.netsuite_id}`} className="btn btn-sm btn-primary">
                          <i className="bi bi-pencil"></i> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <Link to="/search" className="btn btn-primary">
          <i className="bi bi-search"></i> ค้นหา Sales Order อื่น
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;