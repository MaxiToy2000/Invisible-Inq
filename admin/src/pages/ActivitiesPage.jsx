import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { FiFilter, FiRefreshCw } from 'react-icons/fi';
import Loader from '../components/Loader';

export function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    days: 7,
    limit: 100,
    activity_type: '',
    user_id: '',
  });

  useEffect(() => {
    fetchActivities();
  }, [filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (filters.days) params.append('days', filters.days);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.activity_type) params.append('activity_type', filters.activity_type);
      if (filters.user_id) params.append('user_id', filters.user_id);

      const data = await apiRequest(`/api/admin/activities?${params.toString()}`);
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load activities');
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    fetchActivities();
  };

  // Get unique activity types for filter
  const activityTypes = [...new Set(activities.map(a => a.activity_type).filter(Boolean))];

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="loader"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Activities</h1>
          <p className="text-gray-400 text-sm">Monitor and filter user activities</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <FiRefreshCw className="mr-2" size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-4">
        <div className="flex items-center mb-4">
          <FiFilter className="mr-2 text-gray-400" size={18} />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Days
            </label>
            <select
              value={filters.days}
              onChange={(e) => handleFilterChange('days', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder-gray-500"
            >
              <option value={1}>Last 1 day</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Activity Type
            </label>
            <select
              value={filters.activity_type}
              onChange={(e) => handleFilterChange('activity_type', e.target.value)}
              className="w-full px-4 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder-gray-500"
            >
              <option value="">All Types</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
              placeholder="Filter by user ID"
              className="w-full px-4 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Limit
            </label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder-gray-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Activities Table */}
      <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A]">
        <div className="px-6 py-4 border-b border-[#27272A]">
          <h2 className="text-xl font-semibold text-white">
            Activities ({activities.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#09090B]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Session ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Activity Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#18181B] divide-y divide-[#27272A]">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                    {loading ? 'Loading...' : 'No activities found'}
                  </td>
                </tr>
              ) : (
                activities.map((activity, index) => (
                  <tr key={index} className="hover:bg-[#09090B]">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                      {activity.user_email || activity.user_id || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono">
                      {activity.session_id ? activity.session_id.substring(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-600 text-white">
                        {activity.activity_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-md truncate">
                      {activity.details || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      {activity.timestamp ? 
                        new Date(activity.timestamp).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
