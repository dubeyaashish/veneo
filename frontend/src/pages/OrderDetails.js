// src/pages/OrderDetails.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pushingToNetSuite, setPushingToNetSuite] = useState(false);
  const [netSuiteSuccess, setNetSuiteSuccess] = useState(null);
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB' }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  
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
  
  // Push to NetSuite
  const handlePushToNetSuite = async () => {
    try {
      setPushingToNetSuite(true);
      setNetSuiteSuccess(null);
      
      const response = await api.post(`/orders/${id}/push-to-netsuite`);
      
      if (response.data.success) {
        setNetSuiteSuccess({
          message: 'Order pushed to NetSuite successfully!',
          netsuiteOrderId: response.data.netsuiteOrderId,
          netsuiteUrl: response.data.netsuiteUrl
        });
        
        // Refresh order data
        const orderResponse = await api.get(`/orders/${id}`);
        if (orderResponse.data.success) {
          setOrder(orderResponse.data.order);
        }
      } else {
        setError('Failed to push order to NetSuite. Please try again.');
      }
    } catch (error) {
      console.error('Error pushing to NetSuite:', error);
      setError('Failed to push order to NetSuite. Please try again.');
    } finally {
      setPushingToNetSuite(false);
    }
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        const response = await api.delete(`/orders/${id}`);
        
        if (response.data.success) {
          navigate('/orders');
        } else {
          setError('Failed to delete order. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting order:', error);
        setError('Failed to delete order. Please try again.');
      }
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
            </div>
            
            <div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            </div>
          </div>
          
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
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
            Order #{order.salesOrderNo}
          </h2>
          
          <div className="flex space-x-2">
            <Link
              to={`/orders/${id}/edit`}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <i className="fas fa-edit mr-1.5"></i>
              Edit
            </Link>
            
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <i className="fas fa-trash-alt mr-1.5"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
      
      {/* NetSuite Success Message */}
      {netSuiteSuccess && (
        <div className="m-6">
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="fas fa-check-circle text-green-500"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{netSuiteSuccess.message}</p>
                {netSuiteSuccess.netsuiteUrl && (
                  <div className="mt-2">
                    <a
                      href={netSuiteSuccess.netsuiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-green-700 hover:text-green-600"
                    >
                      View in NetSuite <i className="fas fa-external-link-alt ml-1"></i>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Order Details */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Information</h3>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Order Number</p>
              <p className="text-base text-gray-900">{order.salesOrderNo}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Order Date</p>
              <p className="text-base text-gray-900">{formatDate(order.salesOrderDate)}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Customer</p>
              <p className="text-base text-gray-900">{order.customerCode}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Status</p>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                order.status === 'yes' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {order.status === 'yes' ? 'Completed' : 'Pending'}
              </span>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Information</h3>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Subtotal</p>
              <p className="text-base text-gray-900">{formatCurrency(order.subTotal)}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Discount</p>
              <p className="text-base text-gray-900">
                {formatCurrency(order.discountValue)} ({order.discountType})
              </p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">VAT</p>
              <p className="text-base text-gray-900">{formatCurrency(order.totalVat)}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(order.grandTotal)}</p>
            </div>
          </div>
        </div>
        
        {/* NetSuite Integration */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">NetSuite Integration</h3>
            
            {order.status !== 'yes' && (
              <button
                onClick={handlePushToNetSuite}
                disabled={pushingToNetSuite}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  pushingToNetSuite ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {pushingToNetSuite ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt mr-1.5"></i>
                    Push to NetSuite
                  </>
                )}
              </button>
            )}
          </div>
          
          {order.netsuite_id ? (
            <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-2"></i>
                <p className="text-sm text-gray-700">
                  This order has been pushed to NetSuite with ID: <strong>{order.netsuite_id}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="flex items-center">
                <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                <p className="text-sm text-gray-700">
                  This order has not been pushed to NetSuite yet.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Line Items */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Line Items</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-gray-500">{item.productCode}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                      {item.quantity} {item.unitName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                      {formatCurrency(item.discount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right">
                      {formatCurrency(item.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="4" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    Subtotal
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(order.subTotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    Discount
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(order.discountValue)}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    VAT
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(order.totalVat)}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                    Total
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(order.grandTotal)}
                  </td>
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
            to="/orders"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <i className="fas fa-arrow-left mr-1.5"></i>
            Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;