// frontend/src/components/OrderSplit.js - Fixed version
import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://ppg24.tech/api';

const OrderSplit = ({ show, onHide, orderDetails, onSplitComplete, currentUser }) => {
  const { id } = useParams();
  const [originalItems, setOriginalItems] = useState([]);
  const [splitItems, setSplitItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (show && orderDetails?.items) {
      // Initialize original items with current quantities
      const items = orderDetails.items.map((item, index) => ({
        href: item.href,
        item_id: item.item?.id || '',
        quantity: parseFloat(item.quantity || 0),
        originalQuantity: parseFloat(item.quantity || 0),
        rate: item.rate || '',
        description: item.description || '',
        location: item.inventorylocation?.id || '',
        custcol_ice_ld_discount: item.custcol_ice_ld_discount || '',
        inpt_units_11: item.inpt_units_11 || '',
        item_display: orderDetails.itemMap[item.item?.id] || item.item?.id || `Item ${index + 1}`,
        originalIndex: index
      }));
      
      setOriginalItems(items);
      setSplitItems([]);
    }
  }, [show, orderDetails]);

  const handleQuantityChange = (itemIndex, newQuantity, isOriginal = true) => {
    const quantity = parseFloat(newQuantity) || 0;
    
    if (isOriginal) {
      setOriginalItems(prev => prev.map((item, idx) => {
        if (idx === itemIndex) {
          const maxAllowed = item.originalQuantity - getSplitQuantityForItem(item.originalIndex);
          const clampedQuantity = Math.min(Math.max(0, quantity), maxAllowed);
          return { ...item, quantity: clampedQuantity };
        }
        return item;
      }));
    } else {
      setSplitItems(prev => prev.map((item, idx) => {
        if (idx === itemIndex) {
          const originalItem = originalItems[item.originalIndex];
          const maxAllowed = originalItem.originalQuantity - originalItem.quantity;
          const clampedQuantity = Math.min(Math.max(0, quantity), maxAllowed);
          return { ...item, quantity: clampedQuantity };
        }
        return item;
      }));
    }
  };

  const getSplitQuantityForItem = (originalIndex) => {
    return splitItems
      .filter(item => item.originalIndex === originalIndex)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const transferToSplit = (originalIndex, transferQuantity = null) => {
    const originalItem = originalItems[originalIndex];
    const availableQuantity = originalItem.quantity;
    const quantity = transferQuantity || Math.min(1, availableQuantity);
    
    if (quantity <= 0 || quantity > availableQuantity) return;

    const existingSplitIndex = splitItems.findIndex(item => item.originalIndex === originalIndex);
    
    if (existingSplitIndex >= 0) {
      setSplitItems(prev => prev.map((item, idx) => {
        if (idx === existingSplitIndex) {
          return { ...item, quantity: item.quantity + quantity };
        }
        return item;
      }));
    } else {
      setSplitItems(prev => [...prev, {
        ...originalItem,
        quantity: quantity
      }]);
    }

    setOriginalItems(prev => prev.map((item, idx) => {
      if (idx === originalIndex) {
        return { ...item, quantity: item.quantity - quantity };
      }
      return item;
    }));
  };

  const transferToOriginal = (splitIndex, transferQuantity = null) => {
    const splitItem = splitItems[splitIndex];
    const quantity = transferQuantity || Math.min(1, splitItem.quantity);
    
    if (quantity <= 0 || quantity > splitItem.quantity) return;

    setOriginalItems(prev => prev.map((item, idx) => {
      if (idx === splitItem.originalIndex) {
        return { ...item, quantity: item.quantity + quantity };
      }
      return item;
    }));

    setSplitItems(prev => {
      const newSplitItems = [...prev];
      if (newSplitItems[splitIndex].quantity <= quantity) {
        newSplitItems.splice(splitIndex, 1);
      } else {
        newSplitItems[splitIndex] = {
          ...newSplitItems[splitIndex],
          quantity: newSplitItems[splitIndex].quantity - quantity
        };
      }
      return newSplitItems;
    });
  };

  const handleDragStart = (e, item, isOriginal) => {
    setDraggedItem({ item, isOriginal });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, isDropZoneOriginal) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    if (draggedItem.isOriginal && !isDropZoneOriginal) {
      const originalIndex = originalItems.findIndex(item => 
        item.originalIndex === draggedItem.item.originalIndex
      );
      transferToSplit(originalIndex, 1);
    } else if (!draggedItem.isOriginal && isDropZoneOriginal) {
      const splitIndex = splitItems.findIndex(item => 
        item.originalIndex === draggedItem.item.originalIndex
      );
      transferToOriginal(splitIndex, 1);
    }

    setDraggedItem(null);
  };

  const handleCreateSplitOrder = async () => {
    if (splitItems.length === 0) {
      toast.error('Please add items to the split order');
      return;
    }

    // Validate that split items have quantities > 0
    const validSplitItems = splitItems.filter(item => item.quantity > 0);
    if (validSplitItems.length === 0) {
      toast.error('All split items have zero quantity');
      return;
    }

    try {
      setCreating(true);
      
      console.log('Creating split order with the following data:');
      console.log('Original Order ID:', id);
      console.log('Split Items:', validSplitItems);
      console.log('Remaining Original Items:', originalItems);

      // Prepare the data for split order creation
      const splitOrderPayload = {
        originalOrderId: parseInt(id),
        items: validSplitItems.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          rate: item.rate,
          description: item.description,
          location: item.location,
          custcol_ice_ld_discount: item.custcol_ice_ld_discount,
          inpt_units_11: item.inpt_units_11
        })),
        updatedBy: currentUser?.telegram_id || null
      };

      console.log('Sending split order payload:', splitOrderPayload);

      // Call the backend to create split order
      const response = await axios.post(`${API_URL}/order/split/create`, splitOrderPayload);
      
      if (response.data.success) {
        console.log('Split order created successfully:', response.data);
        toast.success(`Split order created successfully! New Order ID: ${response.data.newOrderId}`);
        
        // Call the completion handler
        onSplitComplete({
          newOrderId: response.data.newOrderId,
          newOrderNumber: response.data.newOrderNumber || response.data.newOrderId,
          logs: response.data.logs || []
        });
        
        // Close the modal
        onHide();
      } else {
        console.error('Split order creation failed:', response.data);
        toast.error(response.data.message || 'Failed to create split order');
      }
      
    } catch (error) {
      console.error('Error creating split order:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to create split order';
      
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const canCreateSplit = splitItems.length > 0 && splitItems.some(item => item.quantity > 0) && !creating;

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-scissors me-2"></i>
          Split Sales Order #{id}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Split Order Process:</strong>
          <ul className="mb-0 mt-2">
            <li>New order will inherit ALL header information from original order</li>
            <li>Original order quantities will be reduced by split amounts</li>
            <li>Items with zero quantity will be removed from original order</li>
            <li>Split relationship will be tracked in the system</li>
          </ul>
        </Alert>

        <div className="row">
          {/* Original Order Items */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Original Order Items (Remaining)
                </h6>
              </div>
              <div 
                className="card-body" 
                style={{ maxHeight: '400px', overflowY: 'auto' }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, true)}
              >
                {originalItems.map((item, index) => (
                  <div 
                    key={index}
                    className="card mb-2 border-start border-primary border-3"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, true)}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong className="text-truncate me-2">{item.item_display}</strong>
                        <span className="badge bg-secondary">
                          {item.quantity}/{item.originalQuantity}
                        </span>
                      </div>
                      <p className="text-muted small mb-2">{item.description}</p>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          style={{ width: '80px' }}
                          min="0"
                          max={item.originalQuantity - getSplitQuantityForItem(item.originalIndex)}
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, e.target.value, true)}
                        />
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => transferToSplit(index)}
                          disabled={item.quantity <= 0}
                          title="Transfer 1 unit to split order"
                        >
                          <i className="bi bi-arrow-right"></i>
                        </button>
                      </div>
                      <div className="mt-2">
                        <small className="text-muted">
                          Rate: ฿{parseFloat(item.rate || 0).toFixed(2)} | 
                          Total: ฿{(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)).toFixed(2)}
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Split Order Items */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header bg-success text-white">
                <h6 className="mb-0">
                  <i className="bi bi-file-earmark-plus me-2"></i>
                  New Split Order Items
                </h6>
              </div>
              <div 
                className="card-body" 
                style={{ maxHeight: '400px', overflowY: 'auto' }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, false)}
              >
                {splitItems.length === 0 ? (
                  <div className="text-center text-muted p-4">
                    <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
                    <p className="mt-2">Drag items here or use transfer buttons</p>
                  </div>
                ) : (
                  splitItems.map((item, index) => (
                    <div 
                      key={index}
                      className="card mb-2 border-start border-success border-3"
                      draggable
                      onDragStart={(e) => handleDragStart(e, item, false)}
                      style={{ cursor: 'grab' }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong className="text-truncate me-2">{item.item_display}</strong>
                          <span className="badge bg-success">
                            {item.quantity}
                          </span>
                        </div>
                        <p className="text-muted small mb-2">{item.description}</p>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() => transferToOriginal(index)}
                            disabled={item.quantity <= 0}
                            title="Transfer 1 unit back to original"
                          >
                            <i className="bi bi-arrow-left"></i>
                          </button>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: '80px' }}
                            min="0"
                            max={item.originalQuantity}
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value, false)}
                          />
                        </div>
                        <div className="mt-2">
                          <small className="text-muted">
                            Rate: ฿{parseFloat(item.rate || 0).toFixed(2)} | 
                            Total: ฿{(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)).toFixed(2)}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {splitItems.length > 0 && (
          <Alert variant="success" className="mt-3">
            <i className="bi bi-check-circle me-2"></i>
            <strong>Split Summary:</strong>
            <div className="mt-2">
              <div className="row">
                <div className="col-md-6">
                  <strong>Items to Split:</strong> {splitItems.length}
                  <br />
                  <strong>Total Split Value:</strong> ฿{splitItems.reduce((total, item) => 
                    total + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)), 0
                  ).toFixed(2)}
                </div>
                <div className="col-md-6">
                  <strong>Remaining Items:</strong> {originalItems.filter(item => item.quantity > 0).length}
                  <br />
                  <strong>Remaining Value:</strong> ฿{originalItems.reduce((total, item) => 
                    total + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)), 0
                  ).toFixed(2)}
                </div>
              </div>
            </div>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={creating}>
          Cancel
        </Button>
        <Button 
          variant="success" 
          onClick={handleCreateSplitOrder}
          disabled={!canCreateSplit}
        >
          {creating ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Creating Split Order...
            </>
          ) : (
            <>
              <i className="bi bi-plus-circle me-2"></i>
              Create Split Order ({splitItems.filter(item => item.quantity > 0).length} items)
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrderSplit;