// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

// Components
import StatCard from '../components/StatCard';
import OrderTable from '../components/OrderTable';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    revenue: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch order statistics
        const statsResponse = await api.get('/orders/stats');
        
        if (statsResponse.data.success) {
          setStats(statsResponse.data.stats);
        }
        
        // Fetch recent orders
        const ordersResponse = await api.get('/orders?limit=5');
        
        if (ordersResponse.data.success) {
          setRecentOrders(ordersResponse.data.orders);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {currentUser?.firstName}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your sales orders today.
        </p>
      </div>
      
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
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon="shopping-cart" 
          color="blue"
          loading={loading}
        />
        <StatCard 
          title="Pending Orders" 
          value={stats.pendingOrders} 
          icon="clock" 
          color="yellow"
          loading={loading}
        />
        <StatCard 
          title="Completed Orders" 
          value={stats.completedOrders} 
          icon="check-circle" 
          color="green"
          loading={loading}
        />
        <StatCard 
          title="Total Revenue" 
          value={stats.revenue} 
          icon="dollar-sign" 
          color="indigo"
          isCurrency={true}
          loading={loading}
        />
      </div>
      
      {/* Recent Orders */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Orders
          </h3>
          <Link to="/orders" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            View all
          </Link>
        </div>
        
        <OrderTable 
          orders={recentOrders} 
          loading={loading} 
          showPagination={false}
          compact={true}
        />
      </div>
    </div>
  );
};

export default Dashboard;