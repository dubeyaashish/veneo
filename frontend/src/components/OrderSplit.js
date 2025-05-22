// frontend/src/components/OrderSplit.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const OrderSplit = ({ show, onHide, orderDetails, onSplitComplete, currentUser }) => {
  const [originalItems, setOriginalItems] = useState([]);
  const [splitItems, setSplitItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (show && orderDetails?.items) {
      // Initialize original items with current quantities
      const items = orderDetails.items.map((item, index) => ({
        ...item,
        originalIndex: index,
        currentQuantity: parseFloat(item.quantity || 0),
        originalQuantity: parseFloat(item.quantity || 0),
        item_display: orderDetails.itemMap[item.item?.id] || item.item?.id || `Item ${index + 1}`
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
          return { ...item, currentQuantity: clampedQuantity };
        }
        return item;
      }));
    } else {
      setSplitItems(prev => prev.map((item, idx) => {
        if (idx === itemIndex) {
          const originalItem = originalItems[item.originalIndex];
          const maxAllowed = originalItem.originalQuantity - originalItem.currentQuantity;
          const clampedQuantity = Math.min(Math.max(0, quantity), maxAllowed);
          return { ...item, currentQuantity: clampedQuantity };
        }
        return item;
      }));
    }
  };

  const getSplitQuantityForItem = (originalIndex) => {
    return splitItems
      .filter(item => item.originalIndex === originalIndex)
      .reduce((sum, item) => sum + item.currentQuantity, 0);
  };

  const transferToSplit = (originalIndex, transferQuantity = null) => {
    const originalItem = originalItems[originalIndex];
    const availableQuantity = originalItem.currentQuantity;
    const quantity = transferQuantity || Math.min(1, availableQuantity);
    
    if (quantity <= 0 || quantity > availableQuantity) return;

    // Check if item already exists in split items
    const existingSplitIndex = splitItems.findIndex(item => item.originalIndex === originalIndex);
    
    if (existingSplitIndex >= 0) {
      // Update existing split item
      setSplitItems(prev => prev.map((item, idx) => {
        if (idx === existingSplitIndex) {
          return { ...item, currentQuantity: item.currentQuantity + quantity };
        }
        return item;
      }));
    } else {
      // Add new split item
      setSplitItems(prev => [...prev, {
        ...originalItem,
        currentQuantity: quantity
      }]);
    }

    // Reduce original item quantity
    setOriginalItems(prev => prev.map((item, idx) => {
      if (idx === originalIndex) {
        return { ...item, currentQuantity: item.currentQuantity - quantity };
      }
      return item;
    }));
  };

  const transferToOriginal = (splitIndex, transferQuantity = null) => {
    const splitItem = splitItems[splitIndex];
    const quantity = transferQuantity || Math.min(1, splitItem.currentQuantity);
    
    if (quantity <= 0 || quantity > splitItem.currentQuantity) return;

    // Increase original item quantity
    setOriginalItems(prev => prev.map((item, idx) => {
      if (idx === splitItem.originalIndex) {
        return { ...item, currentQuantity: item.currentQuantity + quantity };
      }
      return item;
    }));

    // Reduce or remove split item
    setSplitItems(prev => {
      const newSplitItems = [...prev];
      if (newSplitItems[splitIndex].currentQuantity <= quantity) {
        newSplitItems.splice(splitIndex, 1);
      } else {
        newSplitItems[splitIndex] = {
          ...newSplitItems[splitIndex],
          currentQuantity: newSplitItems[splitIndex].currentQuantity - quantity
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
      // Transfer from original to split
      const originalIndex = originalItems.findIndex(item => 
        item.originalIndex === draggedItem.item.originalIndex
      );
      transferToSplit(originalIndex, 1);
    } else if (!draggedItem.isOriginal && isDropZoneOriginal) {
      // Transfer from split to original
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

    try {
      setCreating(true);
      
      const splitData = splitItems.map(item => ({
        item_id: item.item?.id,
        quantity: item.currentQuantity,
        rate: item.rate,
        description: item.description,
        location: item.inventorylocation?.id,
        custcol_ice_ld_discount: item.custcol_ice_ld_discount,
        inpt_units_11: item.inpt_units_11
      }));

      const response = await axios.post(`${API_URL}/order/${orderDetails.so.id}/split`, {
        splitItems: splitData,
        createdBy: currentUser?.telegram_id
      });

      if (response.data.success) {
        toast.success(response.data.message);
        onSplitComplete(response.data);
        onHide();
      }
    } catch (error) {
      console.error('Error creating split order:', error);
      toast.error(error.response?.data?.message || 'Failed to create split order');
    } finally {
      setCreating(false);
    }
  };

  const canCreateSplit = splitItems.length > 0 && !creating;

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-scissors me-2"></i>
          Split Sales Order #{orderDetails?.so?.id}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row">
          {/* Original Order Items */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Original Order Items
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
                          {item.currentQuantity}/{item.originalQuantity}
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
                          value={item.currentQuantity}
                          onChange={(e) => handleQuantityChange(index, e.target.value, true)}
                        />
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => transferToSplit(index)}
                          disabled={item.currentQuantity <= 0}
                          title="Transfer 1 unit to split order"
                        >
                          <i className="bi bi-arrow-right"></i>
                        </button>
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
                            {item.currentQuantity}
                          </span>
                        </div>
                        <p className="text-muted small mb-2">{item.description}</p>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() => transferToOriginal(index)}
                            disabled={item.currentQuantity <= 0}
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
                            value={item.currentQuantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value, false)}
                          />
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
          <Alert variant="info" className="mt-3">
            <i className="bi bi-info-circle me-2"></i>
            Split order will inherit all properties from the original order (customer, shipping address, etc.)
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
              Create Split Order
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrderSplit;