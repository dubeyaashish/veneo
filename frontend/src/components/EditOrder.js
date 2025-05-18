// src/components/EditOrder.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import RemarkModal from './RemarkModal';
import LogsModal from './LogsModal';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const EditOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [formData, setFormData] = useState({
    memo: '',
    otherrefnum: '',
    tranDate: '',
    location_id: '',
    custbody_ar_req_inv_mac5: '',
    shipaddresslist: '',
    custbodyar_so_memo2: '',
    items: []
  });
  const [logs, setLogs] = useState([]);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [collapseStates, setCollapseStates] = useState({});
  const [isMyOrder, setIsMyOrder] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/order/${id}`);
        setOrderData(response.data);
        
        const so = response.data.so;
        
        // Check if this order belongs to the current user (by staff code)
        if (currentUser?.staff_code) {
          try {
            const conn = await axios.get(`${API_URL}/orders/staff/${currentUser.staff_code}`);
            const myOrders = conn.data.orders || [];
            const matchingOrder = myOrders.find(order => order.netsuite_id === id);
            setIsMyOrder(!!matchingOrder);
          } catch (error) {
            console.error('Error checking order ownership:', error);
          }
        }
        
        const initialFormData = {
          memo: so.memo || '',
          otherrefnum: so.otherRefNum || '',
          tranDate: so.tranDate ? so.tranDate.substring(0, 10) : '',
          location_id: so.location?.id || '',
          custbody_ar_req_inv_mac5: so.custbody_ar_req_inv_mac5 || '',
          shipaddresslist: so.shipaddresslist || '',
          custbodyar_so_memo2: so.custbodyar_so_memo2 || '',
          items: response.data.items.map(item => ({
            href: item.href,
            item_id: item.item?.id || '',
            quantity: item.quantity || '',
            rate: item.rate || '',
            description: item.description || '',
            location: item.inventorylocation?.id || ''
          }))
        };
        
        setFormData(initialFormData);
        
        // Initialize all items as expanded
        const initialCollapseStates = {};
        response.data.items.forEach((item, i) => {
          initialCollapseStates[i] = false;
        });
        setCollapseStates(initialCollapseStates);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order data');
        setLoading(false);
      }
    };
    
    fetchOrder();
  }, [id, currentUser]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      items: updatedItems
    });
  };
  
  const toggleCollapse = (index) => {
    setCollapseStates({
      ...collapseStates,
      [index]: !collapseStates[index]
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setProcessing(true);
      const response = await axios.post(`${API_URL}/order/${id}/update`, formData);
      
      setLogs(response.data.logs);
      setShowLogsModal(true);
      
      toast.success('Sales Order updated successfully');
      setProcessing(false);
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error('Failed to update Sales Order');
      setProcessing(false);
    }
  };
  
  const handleRemarkSave = (remarkText) => {
    setFormData({
      ...formData,
      custbodyar_so_memo2: remarkText
    });
    setShowRemarkModal(false);
  };
  
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card text-center p-5">
            <div className="mb-4">
              <i className="bi bi-exclamation-triangle-fill text-warning" style={{ fontSize: '4rem' }}></i>
            </div>
            <h3 className="mb-3">ไม่พบข้อมูล Sales Order</h3>
            <p className="text-muted">{error}</p>
            <div className="mt-4">
              <button onClick={() => navigate(-1)} className="btn btn-primary">
                <i className="bi bi-arrow-left"></i> กลับไปหน้าก่อนหน้า
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!orderData) return null;
  
  const { so, venioSONumber, customerName, shippingAddresses, locations } = orderData;
  
  let statusLabel = "รอดำเนินการ";
  let statusClass = "status-pending";
  if (so.status === 'Pending Fulfillment') {
    statusLabel = "รออนุมัติ";
    statusClass = "status-pending";
  } else if (so.status === 'Pending Billing') {
    statusLabel = "อนุมัติแล้ว";  
    statusClass = "status-approved";
  }
  
  return (
    <div>
      <div className="row mb-4">
        <div className="col-md-8">
          <h2 className="page-title">
            <i className="bi bi-file-earmark-text"></i> Sales Order #{id}
          </h2>
        </div>
        <div className="col-md-4 text-end">
          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
          {isMyOrder && (
            <span className="badge bg-info ms-2">Your Order</span>
          )}
        </div>
      </div>
      
      {venioSONumber && (
        <div className="venio-info mb-4">
          <i className="bi bi-link-45deg"></i>
          <div>
            <strong>เชื่อมโยงกับ Venio SO:</strong><br />
            <span>{venioSONumber}</span>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="form-container">
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <i className="bi bi-info-circle"></i> ข้อมูลหลัก
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Memo:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-pencil"></i></span>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="memo" 
                        value={formData.memo} 
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Reference #:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-hash"></i></span>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="otherrefnum" 
                        value={formData.otherrefnum} 
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Tran Date:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-calendar-date"></i></span>
                      <input 
                        type="date" 
                        className="form-control" 
                        name="tranDate" 
                        value={formData.tranDate} 
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Location:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-geo-alt"></i></span>
                      <select 
                        className="form-control" 
                        name="location_id" 
                        value={formData.location_id} 
                        onChange={handleInputChange}
                      >
                        <option value="">เลือกสถานที่</option>
                        {Object.entries(locations).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Req Inv MAC5:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-file-text"></i></span>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="custbody_ar_req_inv_mac5" 
                        value={formData.custbody_ar_req_inv_mac5} 
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Customer:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-person"></i></span>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={customerName} 
                        readOnly 
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">ที่อยู่จัดส่ง:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-geo"></i></span>
                      <select 
                        className="form-control" 
                        name="shipaddresslist" 
                        value={formData.shipaddresslist} 
                        onChange={handleInputChange}
                      >
                        <option value="">เลือกที่อยู่จัดส่ง</option>
                        {shippingAddresses.map((address) => (
                          <option 
                            key={address.address_internal_id} 
                            value={address.address_internal_id}
                          >
                            {address.shipping_address}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Remark:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-chat-text"></i></span>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.custbodyar_so_memo2} 
                        readOnly 
                        onClick={() => setShowRemarkModal(true)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-cart"></i> รายการสินค้า
                </div>
                <span className="badge bg-white text-primary">{formData.items.length} รายการ</span>
              </div>
              <div className="card-body">
                {formData.items.map((item, i) => {
                  const itemDisplay = orderData.itemMap[item.item_id] || item.item_id;
                  return (
                    <div className="item-card" key={i}>
                      <div 
                        className="item-header" 
                        onClick={() => toggleCollapse(i)}
                      >
                        <h5 className="mb-0">
                          <i className={`bi ${collapseStates[i] ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                          <span className="badge bg-light text-dark me-2">{i + 1}</span>
                          {item.description || `Item ${i + 1}`}
                        </h5>
                      </div>
                      {!collapseStates[i] && (
                        <div className="item-content">
                          <div className="row">
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Item:</label>
                              <div className="input-group">
                                <span className="input-group-text"><i className="bi bi-box"></i></span>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={itemDisplay} 
                                  readOnly 
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Qty:</label>
                              <div className="input-group">
                                <span className="input-group-text"><i className="bi bi-123"></i></span>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={item.quantity} 
                                  onChange={(e) => handleItemChange(i, 'quantity', e.target.value)} 
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Rate:</label>
                              <div className="input-group">
                                <span className="input-group-text"><i className="bi bi-currency-dollar"></i></span>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={item.rate} 
                                  onChange={(e) => handleItemChange(i, 'rate', e.target.value)} 
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Description:</label>
                              <div className="input-group">
                                <span className="input-group-text"><i className="bi bi-file-text"></i></span>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={item.description} 
                                  onChange={(e) => handleItemChange(i, 'description', e.target.value)} 
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Location:</label>
                              <div className="input-group">
                                <span className="input-group-text"><i className="bi bi-geo-alt"></i></span>
                                <select 
                                  className="form-control" 
                                  value={item.location} 
                                  onChange={(e) => handleItemChange(i, 'location', e.target.value)}
                                >
                                  <option value="">เลือกสถานที่</option>
                                  {Object.entries(locations).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        {processing && (
          <div className="loading-spinner">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">กำลังบันทึก...</span>
            </div>
            <p className="mt-2">กำลังบันทึกการเปลี่ยนแปลง...</p>
          </div>
        )}
        
        <div className="row">
          <div className="col-md-12 text-center action-buttons">
            <button type="submit" className="btn btn-primary btn-lg" disabled={processing}>
              <i className="bi bi-save"></i> บันทึกการเปลี่ยนแปลง
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-lg"
              onClick={() => navigate(-1)}
              disabled={processing}
            >
              <i className="bi bi-x-circle"></i> ยกเลิก
            </button>
            <a 
              href={`https://7446749${so.realm?.includes('SB') ? '-sb1' : ''}.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-info btn-lg"
            >
              <i className="bi bi-box-arrow-up-right"></i> เปิดใน NetSuite
            </a>
          </div>
        </div>
      </form>
      
      <a href="#top" className="floating-action-button">
        <i className="bi bi-arrow-up"></i>
      </a>
      
      {/* Remark Modal */}
      <RemarkModal 
        show={showRemarkModal} 
        onHide={() => setShowRemarkModal(false)}
        onSave={handleRemarkSave}
        initialValue={formData.custbodyar_so_memo2}
        conditions={orderData.conditions || {}}
      />
      
      {/* Logs Modal */}
      <LogsModal 
        show={showLogsModal} 
        onHide={() => setShowLogsModal(false)}
        logs={logs}
      />
    </div>
  );
};

export default EditOrder;