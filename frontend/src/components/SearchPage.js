import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const SearchPage = () => {
  const [orderId, setOrderId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Fetch suggestions as user types
  const handleChange = async (e) => {
    const value = e.target.value;
    setOrderId(value);

    if (value.length >= 2) {
      const res = await axios.get(`${API_URL}/orders/search?q=${encodeURIComponent(value)}`);
      setSuggestions(res.data.results);
      setDropdownOpen(true);
    } else {
      setSuggestions([]);
      setDropdownOpen(false);
    }
  };

  // Go to selected order
  const handleSelect = (netsuite_id) => {
    setDropdownOpen(false);
    setOrderId('');
    setSuggestions([]);
    if (netsuite_id) {
      navigate(`/order/${netsuite_id}`);
    }
  };

  // Handle form submit (manual entry)
  const handleSearch = (e) => {
    e.preventDefault();
    if (orderId.trim()) {
      navigate(`/order/${orderId.trim()}`);
    }
  };

  // Optional: close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <div className="search-card text-center">
          <i className="bi bi-search search-icon"></i>
          <h2 className="search-title">ค้นหา Sales Order</h2>
          <p className="text-muted mb-4">กรอก Order ID, Sales Order No, หรือ Customer Code</p>
          
          <form onSubmit={handleSearch} className="mt-4" autoComplete="off">
            <div className="input-group mb-3" ref={dropdownRef} style={{ position: 'relative' }}>
              <span className="input-group-text"><i className="bi bi-hash"></i></span>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                placeholder="กรอก Sales Order No หรือ Customer Code"
                value={orderId}
                onChange={handleChange}
                onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
              />
              <button type="submit" className="btn btn-primary btn-lg">
                <i className="bi bi-search"></i> ค้นหา
              </button>
              {/* Suggestions Dropdown */}
              {dropdownOpen && suggestions.length > 0 && (
                <ul className="list-group search-dropdown" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                  borderRadius: "0 0 0.5rem 0.5rem", boxShadow: "0 2px 8px #0002"
                }}>
                  {suggestions.map((item) => (
                    <li
                      key={item.netsuite_id}
                      className="list-group-item list-group-item-action"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelect(item.netsuite_id)}
                    >
                      <strong>{item.salesOrderNo}</strong>
                      <span className="text-muted ms-2">{item.customerCode}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
          {currentUser?.staff_code && (
            <div className="alert alert-info mt-3">
              <i className="bi bi-info-circle"></i> คุณกำลังค้นหาในฐานะพนักงานรหัส: {currentUser.staff_code}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
