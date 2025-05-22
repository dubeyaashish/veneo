// src/components/SaleCoResponse.js
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { Modal, Button, Form } from 'react-bootstrap';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);

  const department = deptParam || currentUser?.department || '';

  // Fetch all orders that need review
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // Update the endpoint based on your API design
        const response = await axios.get(`${API_URL}/orders/staff/${currentUser?.staff_code || 'all'}`);
        
        if (response.data.success) {
          // Make sure all object properties are serializable
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
          
          // If we have an ID from URL params, select it
          if (id) {
            const matchingOrder = safeOrders.find(order => 
              order.netsuite_id === id || order.netsuite_id === parseInt(id)
            );
            if (matchingOrder) {
              setSelectedOrder(matchingOrder);
              fetchOrderDetails(id);
            }
          } else if (safeOrders.length > 0) {
            // Otherwise select the first order
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
  }, [id, currentUser]);

  // Filter orders when search text changes
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredOrders(orderList);
      return;
    }
    
    const filtered = orderList.filter(order => {
      const orderNo = String(order.salesOrderNo || '').toLowerCase();
      const customerCode = String(order.customerCode || '').toLowerCase();
      const search = searchText.toLowerCase();
      
      return orderNo.includes(search) || customerCode.includes(search);
    });
    
    setFilteredOrders(filtered);
  }, [searchText, orderList]);

  const fetchOrderDetails = async (orderId) => {
    try {
      setLoadingDetails(true);
      const response = await axios.get(`${API_URL}/order/${orderId}`);
      
      // Process the response data to make it safely renderable
      const processedData = {
        ...response.data,
        customerName: safeRender(response.data.customerName),
        venioSONumber: safeRender(response.data.venioSONumber),
        so: processSalesOrderData(response.data.so),
        items: processItemsArray(response.data.items),
        locations: processLocationsObject(response.data.locations),
        itemMap: processItemMapObject(response.data.itemMap)
      };
      
      setOrderDetails(processedData);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Helper functions to process the data
  const processSalesOrderData = (so) => {
    if (!so) return {};
    
    const processedSo = {};
    for (const key in so) {
      if (key === 'location') {
        processedSo.location = so.location ? { id: safeRender(so.location.id) } : null;
      } else if (typeof so[key] === 'object' && so[key] !== null) {
        processedSo[key] = safeRender(so[key]);
      } else {
        processedSo[key] = so[key];
      }
    }
    return processedSo;
  };

  const processItemsArray = (items) => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => {
      const processedItem = {};
      for (const key in item) {
        if (key === 'item') {
          processedItem.item = item.item ? { id: safeRender(item.item.id) } : null;
        } else if (key === 'inventorylocation') {
          processedItem.inventorylocation = item.inventorylocation ? 
            { id: safeRender(item.inventorylocation.id) } : null;
        } else if (typeof item[key] === 'object' && item[key] !== null) {
          processedItem[key] = safeRender(item[key]);
        } else {
          processedItem[key] = item[key];
        }
      }
      return processedItem;
    });
  };

  const processLocationsObject = (locations) => {
    if (!locations) return {};
    
    const processedLocations = {};
    for (const key in locations) {
      processedLocations[key] = safeRender(locations[key]);
    }
    return processedLocations;
  };

  const processItemMapObject = (itemMap) => {
    if (!itemMap) return {};
    
    const processedItemMap = {};
    for (const key in itemMap) {
      processedItemMap[key] = safeRender(itemMap[key]);
    }
    return processedItemMap;
  };

  const handleOrderSelect = (order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.netsuite_id);
    
    // Update URL without reloading the page
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
      
      // Remove the approved order from the list
      setOrderList(orderList.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      setFilteredOrders(filteredOrders.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      
      // Select next order if available
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
      
      // Close modal and reset remark
      setShowRemarkModal(false);
      setRemark('');
      
      // Remove the revised order from the list
      setOrderList(orderList.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      setFilteredOrders(filteredOrders.filter(order => order.netsuite_id !== selectedOrder.netsuite_id));
      
      // Select next order if available
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

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

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

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        {/* Left pane - Order list */}
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-list-check me-2"></i>รายการคำสั่งซื้อที่รอตรวจสอบ
              </h5>
              <span className="badge bg-light text-primary">{filteredOrders.length}</span>
            </div>
            <div className="card-body p-0">
              <div className="p-3 border-bottom">
                <input
                  type="text"
                  className="form-control"
                  placeholder="ค้นหา Sales Order No. หรือ Customer Code"
                  value={searchText}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="list-group list-group-flush" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {filteredOrders.length === 0 ? (
                  <div className="text-center p-4 text-muted">
                    <i className="bi bi-inbox-fill" style={{ fontSize: '2rem' }}></i>
                    <p className="mt-2">ไม่พบรายการที่ต้องตรวจสอบ</p>
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <button
                      key={order.netsuite_id}
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedOrder?.netsuite_id === order.netsuite_id ? 'active' : ''}`}
                      onClick={() => handleOrderSelect(order)}
                    >
                      <div>
                        <div className="fw-bold">{safeRender(order.salesOrderNo)}</div>
                        <small>{safeRender(order.customerCode)}</small>
                      </div>
                      <small className="text-muted">
                        {order.salesOrderDate ? new Date(order.salesOrderDate).toLocaleDateString('th-TH') : ''}
                      </small>
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
              <div className="card">
                <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="bi bi-file-earmark-text me-2"></i>Sales Order #{safeRender(selectedOrder.netsuite_id)}
                  </h5>
                  <div>
                    <span className="badge bg-light text-primary me-2">
                      {orderDetails?.venioSONumber ? orderDetails.venioSONumber : safeRender(selectedOrder.salesOrderNo)}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  {orderDetails ? (
                    <>
                      <div className="row mb-4">
                        <div className="col-md-6">
                          <h6 className="text-muted">Customer Information</h6>
                          <p className="mb-1"><strong>Customer:</strong> {orderDetails.customerName}</p>
                          <p className="mb-1"><strong>Order Date:</strong> {orderDetails.so.tranDate ? new Date(orderDetails.so.tranDate).toLocaleDateString('th-TH') : 'N/A'}</p>
                          <p className="mb-1"><strong>Memo:</strong> {safeRender(orderDetails.so.memo)}</p>
                        </div>
                        <div className="col-md-6">
                          <h6 className="text-muted">Order Information</h6>
                          <p className="mb-1"><strong>PO #:</strong> {safeRender(orderDetails.so.otherRefNum)}</p>
                          <p className="mb-1"><strong>Status:</strong> {safeRender(orderDetails.so.status)}</p>
                          <p className="mb-1"><strong>Location:</strong> {orderDetails.so.location?.id && orderDetails.locations[orderDetails.so.location.id] ? 
                            orderDetails.locations[orderDetails.so.location.id] : 'N/A'}</p>
                        </div>
                      </div>
                      
                      <h6 className="text-muted mb-3">Items</h6>
                      <div className="table-responsive mb-4">
                        <table className="table table-bordered table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Item</th>
                              <th>Description</th>
                              <th>Quantity</th>
                              <th>Rate</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderDetails.items.map((item, index) => (
                              <tr key={index}>
                                <td>{index + 1}</td>
                                <td>
                                  {item.item?.id && orderDetails.itemMap[item.item.id] ? 
                                    orderDetails.itemMap[item.item.id] : 
                                    (item.item?.id ? item.item.id : 'N/A')}
                                </td>
                                <td>{safeRender(item.description)}</td>
                                <td className="text-end">{safeRender(item.quantity)}</td>
                                <td className="text-end">
                                  {item.rate ? parseFloat(item.rate).toFixed(2) : '0.00'}
                                </td>
                                <td className="text-end">
                                  {parseFloat(item.quantity || 0) * parseFloat(item.rate || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
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
                    </>
                  ) : (
                    <div className="text-center p-5 text-muted">
                      <i className="bi bi-exclamation-circle" style={{ fontSize: '2rem' }}></i>
                      <p className="mt-2">ไม่พบรายละเอียด</p>
                    </div>
                  )}
                </div>
              </div>
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
    </div>
  );
};

export default SaleCoResponse;