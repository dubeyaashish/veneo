// frontend/src/components/SaleCoResponse.js - Complete updated version with PDF viewing
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { Modal, Button, Form } from 'react-bootstrap';
import OrderSplit from './OrderSplit';
import OrderFilter from './OrderFilter';

const API_URL = process.env.REACT_APP_API_URL || 'https://ppg24.tech/api';

// Helper function to safely render any value
const safeRender = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

// Helper function to format date to dd/mm/yyyy
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    let date;
    if (dateString.includes('T')) {
      date = new Date(dateString.split('T')[0]);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-GB');
  } catch (error) {
    console.error('Date formatting error:', error, 'for date:', dateString);
    return 'Invalid Date';
  }
};

// Helper function to format currency
const formatCurrency = (amount) => {
  if (!amount) return '0.00';
  return parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const SaleCoResponse = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const actionParam = searchParams.get('action');
  const deptParam = searchParams.get('dept');

  const [orderList, setOrderList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [splitHistory, setSplitHistory] = useState([]);
  const [relatedOrders, setRelatedOrders] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({
    staffCode: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  // View mode for order display
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'
  const [itemsViewMode, setItemsViewMode] = useState('table'); // 'card' or 'table'

  const department = deptParam || currentUser?.department || '';

  // Fetch all orders with filters
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        
        const params = new URLSearchParams();
        if (appliedFilters.staffCode) params.append('staffCode', appliedFilters.staffCode);
        if (appliedFilters.status) params.append('status', appliedFilters.status);
        if (appliedFilters.startDate) params.append('startDate', appliedFilters.startDate);
        if (appliedFilters.endDate) params.append('endDate', appliedFilters.endDate);
        
        const response = await axios.get(`${API_URL}/orders/all?${params.toString()}`);
        
        if (response.data.success) {
          const safeOrders = response.data.orders.map(order => {
            const safeOrder = {};
            for (const key in order) {
              if (typeof order[key] === 'object' && order[key] !== null) {
                safeOrder[key] = JSON.stringify(order[key]);
              } else {
                safeOrder[key] = order[key];
              }
            }
            return safeOrder;
          });
          
          setOrderList(safeOrders);
          setFilteredOrders(safeOrders);
          
          if (id) {
            const matchingOrder = safeOrders.find(order => 
              order.netsuite_id === id || order.netsuite_id === parseInt(id)
            );
            if (matchingOrder) {
              setSelectedOrder(matchingOrder);
              fetchOrderDetails(id);
            }
          } else if (safeOrders.length > 0) {
            setSelectedOrder(safeOrders[0]);
            fetchOrderDetails(safeOrders[0].netsuite_id);
          }
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [id, appliedFilters]);

  // Filter orders when search text changes
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredOrders(orderList);
      return;
    }
    
    const filtered = orderList.filter(order => {
      const orderNo = String(order.salesOrderNo || '').toLowerCase();
      const customerName = String(order.customerName || '').toLowerCase();
      const saleRepName = String(order.saleRepName || '').toLowerCase();
      const tranId = String(order.tranId || '').toLowerCase();
      const search = searchText.toLowerCase();
      
      return orderNo.includes(search) || 
             customerName.includes(search) || 
             saleRepName.includes(search) ||
             tranId.includes(search);
    });
    
    setFilteredOrders(filtered);
  }, [searchText, orderList]);

  const fetchOrderDetails = async (orderId) => {
    try {
      setLoadingDetails(true);
      const response = await axios.get(`${API_URL}/order/${orderId}`);
      setOrderDetails(response.data);
      fetchSplitHistory(orderId);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchSplitHistory = async (orderId) => {
    try {
      const response = await axios.get(`${API_URL}/order/${orderId}/splits`);
      if (response.data.success) {
        setSplitHistory(response.data.splits);
        
        const relatedOrderIds = response.data.splits.map(split => 
          split.parent_order_id === parseInt(orderId) ? split.child_order_id : split.parent_order_id
        );
        
        if (relatedOrderIds.length > 0) {
          fetchRelatedOrders(relatedOrderIds);
        }
      }
    } catch (error) {
      console.error('Error fetching split history:', error);
    }
  };

  const fetchRelatedOrders = async (orderIds) => {
    try {
      const promises = orderIds.map(id => axios.get(`${API_URL}/order/${id}`));
      const responses = await Promise.all(promises);
      const related = responses.map(response => response.data);
      setRelatedOrders(related);
    } catch (error) {
      console.error('Error fetching related orders:', error);
    }
  };

  const handleOrderSelect = (order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.netsuite_id);
    navigate(`/response/${order.netsuite_id}${deptParam ? `?dept=${deptParam}` : ''}`, { replace: true });
  };

  const handleApprove = async () => {
    if (!selectedOrder) return;
    
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/order/${selectedOrder.netsuite_id}/respond`, {
        department,
        action: 'approve',
        remark: '',
        respondedBy: currentUser?.telegram_id
      });
      toast.success('อนุมัติคำสั่งซื้อเรียบร้อย');
      
      setOrderList(orderList.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      setFilteredOrders(filteredOrders.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      
      if (filteredOrders.length > 1) {
        const currentIndex = filteredOrders.findIndex(o => o.netsuite_id === selectedOrder.netsuite_id);
        const nextIndex = (currentIndex + 1) % filteredOrders.length;
        handleOrderSelect(filteredOrders[nextIndex]);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error approving order:', err);
      toast.error('เกิดข้อผิดพลาดในการอนุมัติ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviseSubmit = async () => {
    if (!selectedOrder) return;
    
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/order/${selectedOrder.netsuite_id}/respond`, {
        department,
        action: 'revise',
        remark,
        respondedBy: currentUser?.telegram_id
      });
      toast.success('ส่งคำสั่งซื้อไปแก้ไขเรียบร้อย');
      
      setShowRemarkModal(false);
      setRemark('');
      
      setOrderList(orderList.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      setFilteredOrders(filteredOrders.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      
      if (filteredOrders.length > 1) {
        const currentIndex = filteredOrders.findIndex(o => o.netsuite_id === selectedOrder.netsuite_id);
        const nextIndex = (currentIndex + 1) % filteredOrders.length;
        handleOrderSelect(filteredOrders[nextIndex]);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error sending revision:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งแก้ไข');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSplitComplete = (splitResult) => {
    fetchOrderDetails(selectedOrder.netsuite_id);
    toast.success(`Split order created: ${splitResult.newOrderNumber}`);
  };

  const handleApplyFilters = (newFilters) => {
    setAppliedFilters(newFilters);
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // PDF Viewing function
  const handleViewPDF = (orderId) => {
    const pdfUrl = `${API_URL}/order/${orderId}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  // Calculate order totals
  const calculateOrderTotal = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      const quantity = parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      return total + (quantity * rate);
    }, 0);
  };

  const hasActiveFilters = Object.values(appliedFilters).some(value => value && value.trim() !== '');

  // If directed from a specific action button in Telegram
  useEffect(() => {
    if (actionParam && id && selectedOrder) {
      if (actionParam === 'approve') {
        handleApprove();
      } else if (actionParam === 'revise') {
        setShowRemarkModal(true);
      }
    }
  }, [actionParam, id, selectedOrder]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const { so, venioSONumber, customerName, shippingAddresses, locations } = orderDetails || {};

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        {/* Left pane - Order list */}
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-list-check me-2"></i>รายการคำสั่งซื้อทั้งหมด
              </h5>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-light text-primary">{filteredOrders.length}</span>
                <button
                  className={`btn btn-sm ${hasActiveFilters ? 'btn-warning' : 'btn-outline-light'}`}
                  onClick={() => setShowFilterModal(true)}
                  title="Filter orders"
                >
                  <i className="bi bi-funnel"></i>
                  {hasActiveFilters && <span className="ms-1">•</span>}
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="p-3 border-bottom">
                <input
                  type="text"
                  className="form-control"
                  placeholder="ค้นหา Sales Order No, Customer, Sale Rep"
                  value={searchText}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="list-group list-group-flush" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {filteredOrders.length === 0 ? (
                  <div className="text-center p-4 text-muted">
                    <i className="bi bi-inbox-fill" style={{ fontSize: '2rem' }}></i>
                    <p className="mt-2">
                      {hasActiveFilters ? 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา' : 'ไม่พบรายการคำสั่งซื้อ'}
                    </p>
                    {hasActiveFilters && (
                      <button 
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setShowFilterModal(true)}
                      >
                        <i className="bi bi-funnel me-2"></i>
                        แก้ไขตัวกรอง
                      </button>
                    )}
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <button
                      key={order.netsuite_id}
                      className={`list-group-item list-group-item-action ${selectedOrder?.netsuite_id === order.netsuite_id ? 'active' : ''}`}
                      onClick={() => handleOrderSelect(order)}
                      style={{ padding: '12px 16px' }}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between mb-1">
                            <div className="fw-bold">{safeRender(order.salesOrderNo)}</div>
                            <small className="text-muted">{safeRender(order.tranId)}</small>
                          </div>
                          <div className="text-truncate mb-1" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-person me-1"></i>
                            {safeRender(order.customerName)}
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                              <i className="bi bi-calendar3 me-1"></i>
                              {formatDate(order.salesOrderDate)}
                            </small>
                            <small className="text-success fw-bold">
                              ฿{formatCurrency(order.grandTotal)}
                            </small>
                          </div>
                          <div className="mt-1">
                            <small className="text-muted">
                              <i className="bi bi-person-badge me-1"></i>
                              {safeRender(order.saleRepName)}
                            </small>
                          </div>
                          {/* PDF Attachment Indicator */}
                          {order.pdf_attachment && (
                            <div className="mt-1">
                              <small className="text-info">
                                <i className="bi bi-paperclip me-1"></i>
                                มีไฟล์แนบ
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right pane - Order details */}
        <div className="col-md-8">
          {selectedOrder ? (
            loadingDetails ? (
              <div className="card">
                <div className="card-body text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">กำลังโหลดรายละเอียดคำสั่งซื้อ...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Enhanced Header Section */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <h2 className="page-title">
                      <i className="bi bi-file-earmark-text"></i> SO #{safeRender(selectedOrder.tranId)}
                    </h2>
                    <p className="text-muted mb-0">
                      Sales Order: {safeRender(selectedOrder.salesOrderNo)}
                    </p>
                  </div>
                  <div className="col-md-6 text-end">
                    <div className="btn-group mb-2" role="group">
                      <button
                        className={`btn btn-sm ${viewMode === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('summary')}
                      >
                        <i className="bi bi-list"></i> Summary
                      </button>
                      <button
                        className={`btn btn-sm ${viewMode === 'detailed' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('detailed')}
                      >
                        <i className="bi bi-grid-3x3-gap"></i> Detailed
                      </button>
                    </div>
                    <div className="d-block">
                      <span className="badge bg-info me-2">
                        {venioSONumber ? venioSONumber : safeRender(selectedOrder.netsuite_id)}
                      </span>
                      <button
                        className="btn btn-outline-primary btn-sm me-2"
                        onClick={() => setShowSplitModal(true)}
                        title="Split this order"
                      >
                        <i className="bi bi-scissors"></i> Split
                      </button>
                      <button
                        className="btn btn-outline-info btn-sm"
                        onClick={() => setShowOrderModal(true)}
                        title="View full order details"
                      >
                        <i className="bi bi-eye"></i> Full View
                      </button>
                    </div>
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

                {/* Summary View */}
                {viewMode === 'summary' ? (
                  <div className="row">
                    {/* Order Summary Card */}
                    <div className="col-md-6 mb-4">
                      <div className="card h-100">
                        <div className="card-header bg-primary text-white">
                          <i className="bi bi-info-circle"></i> Order Summary
                        </div>
                        <div className="card-body">
                          <table className="table table-borderless table-sm">
                            <tbody>
                              <tr>
                                <td><strong>Customer:</strong></td>
                                <td>{customerName || 'N/A'}</td>
                              </tr>
                              <tr>
                                <td><strong>Date:</strong></td>
                                <td>{formatDate(selectedOrder.salesOrderDate)}</td>
                              </tr>
                              <tr>
                                <td><strong>Sales Rep:</strong></td>
                                <td>
                                  {so?.salesRep?.refName || safeRender(selectedOrder.saleRepName)}
                                  {so?.salesRep?.id && (
                                    <small className="text-muted d-block">ID: {so.salesRep.id}</small>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td><strong>Department:</strong></td>
                                <td>
                                  {so?.department?.refName || 'N/A'}
                                  {so?.department?.id && (
                                    <small className="text-muted d-block">ID: {so.department.id}</small>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td><strong>PO #:</strong></td>
                                <td>{so?.otherRefNum || 'N/A'}</td>
                              </tr>
                              <tr>
                                <td><strong>Status:</strong></td>
                                <td>
                                  <span className="badge bg-info">{selectedOrder.status || 'N/A'}</span>
                                </td>
                              </tr>
                              <tr>
                                <td><strong>Total Amount:</strong></td>
                                <td className="text-success fw-bold">
                                  ฿{formatCurrency(selectedOrder.grandTotal)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Items Summary */}
                    <div className="col-md-6 mb-4">
                      <div className="card h-100">
                        <div className="card-header bg-success text-white d-flex justify-content-between">
                          <span><i className="bi bi-cart"></i> Items Summary</span>
                          <span className="badge bg-white text-success">
                            {orderDetails?.items?.length || 0} items
                          </span>
                        </div>
                        <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {orderDetails?.items?.length === 0 ? (
                            <p className="text-muted text-center">No items found</p>
                          ) : (
                            <div className="list-group list-group-flush">
                              {orderDetails?.items?.map((item, index) => (
                                <div key={index} className="list-group-item px-0 py-2">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1">
                                      <h6 className="mb-1 text-truncate">
                                        {orderDetails.itemMap?.[item.item?.id] || item.item?.id || `Item ${index + 1}`}
                                      </h6>
                                      <p className="mb-1 small text-muted">{item.description}</p>
                                      <small className="text-muted">
                                        Qty: {item.quantity} × ฿{formatCurrency(item.rate)}
                                      </small>
                                    </div>
                                    <div className="text-end">
                                      <span className="fw-bold text-success">
                                        ฿{formatCurrency(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0))}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PDF Attachment Card */}
                    {selectedOrder?.pdf_attachment && (
                      <div className="col-md-12 mb-4">
                        <div className="card">
                          <div className="card-header bg-info text-white d-flex justify-content-between">
                            <span><i className="bi bi-paperclip"></i> ไฟล์แนบ PDF</span>
                            <span className="badge bg-white text-info">
                              <i className="bi bi-file-earmark-pdf"></i>
                            </span>
                          </div>
                          <div className="card-body text-center">
                            <i className="bi bi-file-earmark-pdf text-danger" style={{fontSize: '3rem'}}></i>
                            <h5 className="mt-2">มีไฟล์ PDF แนบ</h5>
                            <p className="text-muted">ไฟล์: {selectedOrder.pdf_attachment}</p>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleViewPDF(selectedOrder.netsuite_id)}
                            >
                              <i className="bi bi-eye me-2"></i>ดู PDF
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Related Orders */}
                    {relatedOrders.length > 0 && (
                      <div className="col-md-12 mb-4">
                        <div className="card">
                          <div className="card-header bg-info text-white">
                            <h6 className="mb-0">
                              <i className="bi bi-diagram-3 me-2"></i>Related Split Orders
                            </h6>
                          </div>
                          <div className="card-body">
                            <div className="row">
                              {relatedOrders.map((relatedOrder, index) => (
                                <div key={index} className="col-md-6 mb-3">
                                  <div className="card border-info">
                                    <div className="card-header bg-light d-flex justify-content-between">
                                      <strong>Split Order #{relatedOrder.so.id}</strong>
                                      <span className="badge bg-info">
                                        {relatedOrder.items?.length || 0} items
                                      </span>
                                    </div>
                                    <div className="card-body p-3">
                                      {relatedOrder.so.memo && (
                                        <small className="text-muted d-block mb-2">{relatedOrder.so.memo}</small>
                                      )}
                                      <div className="text-end">
                                        <span className="fw-bold text-success">
                                          Total: ฿{formatCurrency(calculateOrderTotal(relatedOrder.items))}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Detailed View */
                  <>
                    {/* PDF Attachment in Detailed View */}
                    {orderDetails?.so?.pdf_attachment && (
                      <div className="row mb-4">
                        <div className="col-md-12">
                          <div className="card shadow-sm rounded-4">
                            <div className="card-header bg-info text-white">
                              <i className="bi bi-paperclip"></i> ไฟล์แนบ PDF
                            </div>
                            <div className="card-body text-center">
                              <div className="row justify-content-center">
                                <div className="col-md-6">
                                  <i className="bi bi-file-earmark-pdf text-danger" style={{fontSize: '4rem'}}></i>
                                  <h4 className="mt-3">มีไฟล์ PDF แนบ</h4>
                                  <p className="text-muted">คลิกเพื่อดูไฟล์แนบของ Sales Order นี้</p>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-lg"
                                    onClick={() => handleViewPDF(selectedOrder.netsuite_id)}
                                  >
                                    <i className="bi bi-eye me-2"></i>เปิดดู PDF
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Main Info */}
                    <div className="row mb-4">
                      <div className="col-md-12">
                        <div className="card shadow-sm rounded-4">
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
                                    value={so?.custbody_ar_all_memo || ''}
                                    readOnly
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
                                    value={so?.otherRefNum || ''}
                                    readOnly
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
                                    value={so?.tranDate ? so.tranDate.substring(0, 10) : ''}
                                    readOnly
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
                                    value={locations?.[so?.location?.id] || ''}
                                    readOnly
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
                                    value={so?.custbody_ar_req_inv_mac5 || ''}
                                    readOnly
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
                                    value={customerName || ''}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="form-label">ที่อยู่จัดส่ง:</label>
                                <div className="input-group">
                                  <span className="input-group-text"><i className="bi bi-geo"></i></span>
                                  <select className="form-control" value={so?.shipaddresslist || ''} disabled>
                                    <option value="">เลือกที่อยู่จัดส่ง</option>
                                    {shippingAddresses?.map((address) => (
                                      <option key={address.address_internal_id} value={address.address_internal_id}>
                                        {address.shipping_address}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="form-label">Remark: (Long Memo)</label>
                                <div className="input-group">
                                  <span className="input-group-text"><i className="bi bi-chat-text"></i></span>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={so?.custbodyar_so_memo2 || ''}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="form-label">Sales Rep:</label>
                                <div className="input-group">
                                  <span className="input-group-text"><i className="bi bi-person-badge"></i></span>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={so?.salesRep?.refName || safeRender(selectedOrder?.saleRepName) || ''}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="form-label">Department:</label>
                                <div className="input-group">
                                  <span className="input-group-text"><i className="bi bi-building"></i></span>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={so?.department?.refName || 'N/A'}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="col-md-6 mb-3">
                                <label className="form-label">ผู้ติดต่อ:</label>
                                <div className="input-group">
                                  <span className="input-group-text"><i className="bi bi-clipboard-data"></i></span>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={so?.custbody_ar_estimate_contrat1 || ''}
                                    readOnly
                                  />
                                </div>
                              </div>
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
                            <span className="badge bg-white text-primary ms-2">{orderDetails?.items?.length || 0} รายการ</span>
                          </div>
                          <div className="card-body">
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
                                    <th>Discount</th>
                                    <th>Units 11</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderDetails?.items?.length === 0 ? (
                                    <tr>
                                      <td colSpan={8} className="text-center text-muted">ไม่มีรายการสินค้า</td>
                                    </tr>
                                  ) : (
                                    orderDetails?.items?.map((item, i) => {
                                      const itemDisplay = orderDetails.itemMap?.[item.item?.id] || item.item?.id || `Item ${i + 1}`;
                                      return (
                                        <tr key={i}>
                                          <td>{i + 1}</td>
                                          <td>{itemDisplay}</td>
                                          <td className="text-end">{item.quantity}</td>
                                          <td className="text-end">{parseFloat(item.rate || 0).toFixed(2)}</td>
                                          <td>{item.description}</td>
                                          <td>{locations?.[item.inventorylocation?.id] || 'N/A'}</td>
                                          <td className="text-end">{item.custcol_ice_ld_discount || 0}</td>
                                          <td>{item.inpt_units_11 || ''}</td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="d-flex justify-content-center gap-3 mt-4">
                  <button
                    className="btn btn-success btn-lg"
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        กำลังทำงาน...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>ผ่าน
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-danger btn-lg"
                    onClick={() => setShowRemarkModal(true)}
                    disabled={submitting}
                  >
                    <i className="bi bi-arrow-counterclockwise me-2"></i>กลับไปแก้ไข
                  </button>
                </div>

                {/* Related/Split Orders */}
                {relatedOrders.length > 0 && viewMode === 'detailed' && (
                  <div className="card mt-4">
                    <div className="card-header bg-info text-white">
                      <h6 className="mb-0">
                        <i className="bi bi-diagram-3 me-2"></i>Related Split Orders
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        {relatedOrders.map((relatedOrder, index) => (
                          <div key={index} className="col-md-6 mb-3">
                            <div className="card border-info">
                              <div className="card-header bg-light">
                                <strong>Split Order #{relatedOrder.so.id}</strong>
                                {relatedOrder.so.memo && (
                                  <small className="text-muted d-block">{relatedOrder.so.memo}</small>
                                )}
                              </div>
                              <div className="card-body p-3">
                                <div className="table-responsive">
                                  <table className="table table-sm">
                                    <thead>
                                      <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {relatedOrder.items.map((item, itemIndex) => (
                                        <tr key={itemIndex}>
                                          <td className="text-truncate" style={{ maxWidth: '150px' }}>
                                            {orderDetails?.itemMap?.[item.item?.id] || item.item?.id || 'N/A'}
                                          </td>
                                          <td>{safeRender(item.quantity)}</td>
                                          <td>{(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          ) : (
            <div className="card">
              <div className="card-body text-center p-5">
                <i className="bi bi-arrow-left-circle" style={{ fontSize: '2rem' }}></i>
                <p className="mt-2">กรุณาเลือกคำสั่งซื้อจากรายการด้านซ้าย</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Remark Modal */}
      <Modal show={showRemarkModal} onHide={() => setShowRemarkModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>หมายเหตุการแก้ไข</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>กรุณาระบุเหตุผลที่ต้องการให้แก้ไข</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="ระบุรายละเอียดที่ต้องการให้แก้ไข..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRemarkModal(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button 
            variant="primary" 
            onClick={handleReviseSubmit} 
            disabled={submitting || !remark.trim()}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                กำลังส่ง...
              </>
            ) : (
              'ยืนยันการส่งแก้ไข'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Order Filter Modal */}
      <OrderFilter
        show={showFilterModal}
        onHide={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={appliedFilters}
      />

      {/* Order Split Modal */}
      <OrderSplit
        show={showSplitModal}
        onHide={() => setShowSplitModal(false)}
        orderDetails={orderDetails}
        onSplitComplete={handleSplitComplete}
        currentUser={currentUser}
      />
    </div>
  );
};

export default SaleCoResponse;