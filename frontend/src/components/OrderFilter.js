// frontend/src/components/OrderFilter.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const OrderFilter = ({ show, onHide, onApplyFilters, currentFilters }) => {
  const [filters, setFilters] = useState({
    staffCode: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [staffList, setStaffList] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      // Set current filters when modal opens
      setFilters(currentFilters || {
        staffCode: '',
        status: '',
        startDate: '',
        endDate: ''
      });
      
      // Fetch filter options
      fetchFilterOptions();
    }
  }, [show, currentFilters]);

  const fetchFilterOptions = async () => {
    try {
      setLoading(true);
      const [staffResponse, statusResponse] = await Promise.all([
        axios.get(`${API_URL}/filters/staff`),
        axios.get(`${API_URL}/filters/status`)
      ]);

      if (staffResponse.data.success) {
        setStaffList(staffResponse.data.staff);
      }

      if (statusResponse.data.success) {
        setStatusList(statusResponse.data.statuses);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onHide();
  };

  const handleClear = () => {
    const clearedFilters = {
      staffCode: '',
      status: '',
      startDate: '',
      endDate: ''
    };
    setFilters(clearedFilters);
    onApplyFilters(clearedFilters);
    onHide();
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const hasActiveFilters = Object.values(filters).some(value => value && value.trim() !== '');

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-funnel me-2"></i>
          Filter Sales Orders
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center p-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading filter options...</p>
          </div>
        ) : (
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="bi bi-person me-2"></i>
                    Staff Member
                  </Form.Label>
                  <Form.Select
                    value={filters.staffCode}
                    onChange={(e) => handleInputChange('staffCode', e.target.value)}
                  >
                    <option value="">All Staff</option>
                    {staffList.map((staff) => (
                      <option key={staff.staffCode} value={staff.staffCode}>
                        {staff.staffCode} - {staff.staffName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="bi bi-flag me-2"></i>
                    Status
                  </Form.Label>
                  <Form.Select
                    value={filters.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {statusList.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="bi bi-calendar me-2"></i>
                    Start Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={formatDateForInput(filters.startDate)}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="bi bi-calendar-check me-2"></i>
                    End Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={formatDateForInput(filters.endDate)}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            {hasActiveFilters && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Active filters:</strong>
                <ul className="mb-0 mt-2">
                  {filters.staffCode && <li>Staff: {staffList.find(s => s.staffCode === filters.staffCode)?.staffName || filters.staffCode}</li>}
                  {filters.status && <li>Status: {filters.status}</li>}
                  {filters.startDate && <li>Start Date: {new Date(filters.startDate).toLocaleDateString('en-GB')}</li>}
                  {filters.endDate && <li>End Date: {new Date(filters.endDate).toLocaleDateString('en-GB')}</li>}
                </ul>
              </div>
            )}
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleClear} disabled={loading}>
          <i className="bi bi-x-circle me-2"></i>
          Clear All
        </Button>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleApply} disabled={loading}>
          <i className="bi bi-check2 me-2"></i>
          Apply Filters
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrderFilter;