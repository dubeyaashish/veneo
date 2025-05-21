import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import RemarkModal from './RemarkModal';
import LogsModal from './LogsModal';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://ppg24.tech/api';

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
    custbody_ar_all_memo: '',
    custbody_ar_estimate_contrat1: '',
    items: []
  });
  const [logs, setLogs] = useState([]);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [collapseStates, setCollapseStates] = useState({});
  const [isMyOrder, setIsMyOrder] = useState(false);
  const [itemsViewMode, setItemsViewMode] = useState('card');
  const [allCollapsed, setAllCollapsed] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/order/${id}`);
        setOrderData(response.data);

        const so = response.data.so;

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
          custbody_ar_all_memo: so.custbody_ar_all_memo || '',
          custbody_ar_estimate_contrat1: so.custbody_ar_estimate_contrat1 || '',
          items: response.data.items.map(item => ({
            href: item.href,
            item_id: item.item?.id || '',
            quantity: item.quantity || '',
            rate: item.rate || '',
            description: item.description || '',
            location: item.inventorylocation?.id || '',
            custcol_ice_ld_discount: item.custcol_ice_ld_discount || '',
            inpt_units_11: item.inpt_units_11 || ''
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
    setCollapseStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleCollapseAll = (collapse = true) => {
    const newStates = {};
    formData.items.forEach((item, i) => {
      newStates[i] = collapse;
    });
    setCollapseStates(newStates);
    setAllCollapsed(collapse);
  };

// In EditOrder.js - update handleSubmit function

const handleSubmit = async (e) => {
  e.preventDefault();
  console.log(formData);

  try {
    setProcessing(true);
    const response = await axios.post(`${API_URL}/order/${id}/update`, formData);

    setLogs(response.data.logs);
    
    // Check if any notifications were sent
    const notificationSent = response.data.logs.some(log => 
      log.includes('ส่งการแจ้งเตือน')
    );
    
    // Show more detailed toast based on what happened
    if (response.data.headerUpdated || response.data.itemsUpdated.length > 0) {
      if (notificationSent) {
        toast.success('Sales Order updated successfully. Notifications sent to coordination team!', {
          autoClose: 5000 // Show for longer
        });
      } else {
        toast.success('Sales Order updated successfully!');
      }
    } else {
      toast.info('No changes were detected in the sales order.');
    }
    
    setShowLogsModal(true);
    setProcessing(false);
  } catch (err) {
    console.error('Error updating order:', err);
    toast.error('Failed to update Sales Order: ' + (err.response?.data?.message || err.message));
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
        {/* Order Main Info */}
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-primary text-white">
                <i className="bi bi-info-circle"></i> ข้อมูลหลัก
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Existing fields */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Memo:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-pencil"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        name="custbody_ar_all_memo"
                        value={formData.custbody_ar_all_memo}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">PO #:</label>
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
                      <input
                        type="text"
                        className="form-control"
                        value={locations[formData.location_id] || ''}
                        readOnly
                        tabIndex={-1}
                        style={{ background: "#f8f9fa", cursor: "not-allowed" }}
                      />
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
                    <label className="form-label">Remark: (Long Memo) </label>
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

                  {/* ---- Additional Header Fields ---- */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">ผู้ติดต่อ:</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-clipboard-data"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        name="custbody_ar_estimate_contrat1"
                        value={formData.custbody_ar_estimate_contrat1}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  {/* ---- End Additional Header Fields ---- */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-cart"></i> รายการสินค้า
                </div>
                <span className="badge bg-white text-primary ms-2">{formData.items.length} รายการ</span>
              </div>
              <div className="card-body pb-0">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
                  <div>
                    <div className="btn-group me-2 mb-2 mb-md-0" role="group" aria-label="View Toggle">
                      <button
                        type="button"
                        className={`btn btn-outline-primary ${itemsViewMode === 'card' ? 'active' : ''}`}
                        onClick={() => setItemsViewMode('card')}
                      >
                        <i className="bi bi-grid-3x3-gap"></i> Card
                      </button>
                      <button
                        type="button"
                        className={`btn btn-outline-primary ${itemsViewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setItemsViewMode('table')}
                      >
                        <i className="bi bi-table"></i> Table
                      </button>
                    </div>
                  </div>
                  {itemsViewMode === 'card' && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-2"
                        onClick={() => handleCollapseAll(false)}
                        disabled={!allCollapsed}
                      >
                        <i className="bi bi-arrows-angle-expand"></i> Expand All
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleCollapseAll(true)}
                        disabled={allCollapsed}
                      >
                        <i className="bi bi-arrows-angle-contract"></i> Collapse All
                      </button>
                    </div>
                  )}
                </div>

                {/* Items Content */}
                {itemsViewMode === 'card' ? (
                  <>
                    {formData.items.length === 0 && (
                      <div className="alert alert-secondary">ไม่มีรายการสินค้า</div>
                    )}
                    {formData.items.map((item, i) => {
                      const itemDisplay = orderData.itemMap[item.item_id] || item.item_id;
                      return (
                        <div
                          className="card mb-3 border-0 shadow-sm item-card rounded-3"
                          key={i}
                          style={{ borderLeft: '5px solid #0d6efd', transition: 'box-shadow 0.2s' }}
                        >
                          <div
                            className="card-header bg-light d-flex align-items-center pointer"
                            onClick={() => toggleCollapse(i)}
                            style={{ cursor: 'pointer' }}
                          >
                            <h5 className="mb-0 flex-grow-1">
                              <i className={`bi ${collapseStates[i] ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                              <span className="badge bg-primary-subtle text-primary-emphasis ms-2 me-2">{i + 1}</span>
                              {item.description || `Item ${i + 1}`}
                            </h5>
                            <span className="ms-auto text-muted small">คลิกเพื่อ {collapseStates[i] ? 'ซ่อน' : 'แสดง'}</span>
                          </div>
                          {!collapseStates[i] && (
                            <div className="card-body bg-white">
                              <div className="row g-3">
                                <div className="col-md-3">
                                  <label className="form-label">Item:</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={itemDisplay}
                                    readOnly
                                  />
                                </div>
                                <div className="col-md-2">
                                  <label className="form-label">Qty:</label>
                                  <input
                                    type="text"
                                    className="form-control text-end"
                                    value={item.quantity}
                                    onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-2">
                                  <label className="form-label">Rate:</label>
                                  <input
                                    type="text"
                                    className="form-control text-end"
                                    value={item.rate}
                                    onChange={e => handleItemChange(i, 'rate', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">Description:</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.description}
                                    onChange={e => handleItemChange(i, 'description', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-2">
                                  <label className="form-label">Location:</label>
                                  <select
                                    className="form-control"
                                    value={item.location}
                                    onChange={e => handleItemChange(i, 'location', e.target.value)}
                                  >
                                    <option value="">เลือกสถานที่</option>
                                    {Object.entries(locations).map(([id, name]) => (
                                      <option key={id} value={id}>{name}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* ---- Additional Item Fields ---- */}
                                <div className="col-md-4">
                                  <label className="form-label">Discount (formatted):</label>
                                  <input
                                    type="text"
                                    className="form-control text-end"
                                    value={item.custcol_ice_ld_discount}
                                    onChange={e => handleItemChange(i, 'custcol_ice_ld_discount', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">Units 11:</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.inpt_units_11}
                                    onChange={e => handleItemChange(i, 'inpt_units_11', e.target.value)}
                                  />
                                </div>
                                {/* ---- End Additional Item Fields ---- */}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="table-responsive mb-3">
                    <table className="table table-hover align-middle table-bordered bg-white rounded-3">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Description</th>
                          <th>Location</th>
                          <th>Discount (formatted)</th>
                          <th>Units 11</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted">ไม่มีรายการสินค้า</td>
                          </tr>
                        ) : (
                          formData.items.map((item, i) => {
                            const itemDisplay = orderData.itemMap[item.item_id] || item.item_id;
                            return (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={itemDisplay}
                                    readOnly
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.quantity}
                                    onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.rate}
                                    onChange={e => handleItemChange(i, 'rate', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.description}
                                    onChange={e => handleItemChange(i, 'description', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <select
                                    className="form-control"
                                    value={item.location}
                                    onChange={e => handleItemChange(i, 'location', e.target.value)}
                                  >
                                    <option value="">เลือกสถานที่</option>
                                    {Object.entries(locations).map(([id, name]) => (
                                      <option key={id} value={id}>{name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.custcol_ice_ld_discount}
                                    onChange={e => handleItemChange(i, 'custcol_ice_ld_discount', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.inpt_units_11}
                                    onChange={e => handleItemChange(i, 'inpt_units_11', e.target.value)}
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Save/Cancel Bar */}
        <div className="row">
          <div className="col-md-12 text-center action-buttons position-sticky bottom-0 bg-white py-3" style={{ zIndex: 999 }}>
            <button type="submit" className="btn btn-primary btn-lg mx-2" disabled={processing}>
              <i className="bi bi-save"></i> บันทึกการเปลี่ยนแปลง
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg mx-2"
              onClick={() => navigate(-1)}
              disabled={processing}
            >
              <i className="bi bi-x-circle"></i> ยกเลิก
            </button>
            <a
              href={`https://7446749${so.realm?.includes('SB') ? '-sb1' : ''}.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-info btn-lg mx-2"
            >
              <i className="bi bi-box-arrow-up-right"></i> เปิดใน NetSuite
            </a>
          </div>
        </div>
      </form>

      {/* Floating action to top */}
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

      {/* Loading spinner (save) */}
      {processing && (
        <div className="loading-spinner-overlay">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">กำลังบันทึก...</span>
          </div>
          <p className="mt-2">กำลังบันทึกการเปลี่ยนแปลง...</p>
        </div>
      )}
    </div>
  );
};

export default EditOrder;
