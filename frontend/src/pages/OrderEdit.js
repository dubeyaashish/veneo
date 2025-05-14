// src/pages/OrderEdit.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const OrderEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        
        const response = await api.get(`/orders/${id}`);
        
        if (response.data.success) {
          setOrder(response.data.order);
        } else {
          setError('Failed to load order details. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
        setError('Failed to load order details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrder();
  }, [id]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrder({
      ...order,
      [name]: value
    });
  };
  
  // Handle item field changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...order.items];
    updatedItems[index][field] = value;
    
    // Recalculate total price
    if (field === 'price' || field === 'quantity') {
      const price = parseFloat(updatedItems[index].price) || 0;
      const quantity = parseFloat(updatedItems[index].quantity) || 0;
      updatedItems[index].totalPrice = (price * quantity).toFixed(2);
    }
    
    setOrder({
      ...order,
      items: updatedItems
    });
  };
  
  // Add new item
  const handleAddItem = () => {
    const newItem = {
      productCode: '',
      productName: '',
      price: 0,
      quantity: 1,
      unitName: 'pcs',
      description: '',
      discount: 0,
      totalPrice: 0
    };
    
    setOrder({
      ...order,
      items: [...order.items, newItem]
    });
  };
  
  // Remove item
  const handleRemoveItem = (index) => {
    const updatedItems = [...order.items];
    updatedItems.splice(index, 1);
    
    setOrder({
      ...order,
      items: updatedItems
    });
  };
  
  // Recalculate order totals
  const recalculateOrderTotals = () => {
    const subTotal = order.items.reduce((total, item) => total + parseFloat(item.totalPrice || 0), 0);
    const discountValue = parseFloat(order.discountValue || 0);
    const subTotalWithDiscount = subTotal - discountValue;
    const vatRate = 0.07; // Assuming 7% VAT
    const totalVat = subTotalWithDiscount * vatRate;
    const grandTotal = subTotalWithDiscount + totalVat;
    
    setOrder({
      ...order,
      subTotal,
      subTotalWithDiscount,
      totalVat,
      grandTotal
    });
  };
  
  // Save changes
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Recalculate totals before saving
      recalculateOrderTotals();
      
      const response = await api.put(`/orders/${id}`, {
        order
      });
      
      if (response.data.success) {
        setSuccess('Order updated successfully.');
        
        // Redirect to order details after 2 seconds
        setTimeout(() => {
          navigate(`/orders/${id}`);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to update order. Please try again.');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      setError('Failed to update order. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB' }).format(amount);
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && !order) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-circle text-red-500"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center mt-4">
          <Link
            to="/orders"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to Orders
          </Link>
        </div>
      </div>
    );
  }
  
  // Render order not found
  if (!order) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <h3 className="mt-2 text-lg font-medium text-gray-900">Order not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The order you are looking for does not exist or has been deleted.
          </p>
          <div className="mt-6">
            <Link
              to="/orders"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Edit Order #{order.salesOrderNo}
          </h2>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-4">
          {/* Error and Success Messages */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-exclamation-circle text-red-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-check-circle text-green-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Order Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="salesOrderNo" className="block text-sm font-medium text-gray-700">Order Number</label>
                <input
                  type="text"
                  id="salesOrderNo"
                  name="salesOrderNo"
                  value={order.salesOrderNo}
                  disabled
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              
              <div>
                <label htmlFor="salesOrderDate" className="block text-sm font-medium text-gray-700">Order Date</label>
                <input
                  type="date"
                  id="salesOrderDate"
                  name="salesOrderDate"
                  value={order.salesOrderDate ? order.salesOrderDate.substring(0, 10) : ''}
                  onChange={handleChange}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label htmlFor="customerCode" className="block text-sm font-medium text-gray-700">Customer</label>
                <input
                  type="text"
                  id="customerCode"
                  name="customerCode"
                  value={order.customerCode}
                  disabled
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              
              <div>
                <label htmlFor="salesOrderSubject" className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  id="salesOrderSubject"
                  name="salesOrderSubject"
                  value={order.salesOrderSubject || ''}
                  onChange={handleChange}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label htmlFor="remark" className="block text-sm font-medium text-gray-700">Remark</label>
                <textarea
                  id="remark"
                  name="remark"
                  rows="3"
                  value={order.remark || ''}
                  onChange={handleChange}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                ></textarea>
              </div>
              
              <div>
                <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Discount</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="number"
                    id="discountValue"
                    name="discountValue"
                    value={order.discountValue || 0}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-l-md"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    THB
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Line Items */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Line Items</h3>
              
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <i className="fas fa-plus mr-1.5"></i>
                Add Item
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-3 bg-gray-50"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.productName || ''}
                            onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                            placeholder="Product Name"
                            className="block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                          <input
                            type="text"
                            value={item.productCode || ''}
                            onChange={(e) => handleItemChange(index, 'productCode', e.target.value)}
                            placeholder="Product Code"
                            className="block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Description"
                            className="block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.price || 0}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          className="block w-24 shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={item.quantity || 0}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="block w-20 shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                          <input
                            type="text"
                            value={item.unitName || 'pcs'}
                            onChange={(e) => handleItemChange(index, 'unitName', e.target.value)}
                            className="block w-16 ml-2 shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.totalPrice || 0}
                          disabled
                          className="block w-24 shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                      Subtotal
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(order.subTotal || 0)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                      Discount
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(order.discountValue || 0)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                      VAT (7%)
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(order.totalVat || 0)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                      Total
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900">
                      {formatCurrency(order.grandTotal || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <Link
              to={`/orders/${id}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <i className="fas fa-arrow-left mr-1.5"></i>
              Cancel
            </Link>
            
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-1.5"></i>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default OrderEdit;