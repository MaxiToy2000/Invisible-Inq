import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { FiUsers, FiActivity, FiTrendingUp, FiClock } from 'react-icons/fi';
import Loader from '../components/Loader';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('/api/admin/dashboard');
      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="loader"></span>
      </div>
    );
  }

  if (error) {
      return (
        <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      );
  }

  const stats7d = dashboardData?.stats_7_days || {};
  const stats30d = dashboardData?.stats_30_days || {};
  const recentActivities = dashboardData?.recent_activities || [];

  // Process data for charts
  const processChartData = () => {
    // Daily activity breakdown (last 7 days)
    const dailyData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayActivities = recentActivities.filter(activity => {
        if (!activity.timestamp) return false;
        const activityDate = new Date(activity.timestamp);
        return activityDate.toDateString() === date.toDateString();
      });

      dailyData.push({
        date: dateStr,
        activities: dayActivities.length,
        users: new Set(dayActivities.map(a => a.user_id || a.user_email)).size
      });
    }

    // Activity types distribution
    const activityTypes = {};
    recentActivities.forEach(activity => {
      const type = activity.activity_type || 'Unknown';
      activityTypes[type] = (activityTypes[type] || 0) + 1;
    });

    const activityTypeData = Object.entries(activityTypes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Activity by hour (last 24 hours)
    const hourlyData = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i);
      const hourStr = hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      
      const hourActivities = recentActivities.filter(activity => {
        if (!activity.timestamp) return false;
        const activityDate = new Date(activity.timestamp);
        return activityDate.getHours() === hour.getHours() && 
               activityDate.toDateString() === hour.toDateString();
      });

      hourlyData.push({
        hour: hourStr,
        count: hourActivities.length
      });
    }

    // Top users by activity
    const userActivityCount = {};
    recentActivities.forEach(activity => {
      const user = activity.user_email || activity.user_id || 'Unknown';
      userActivityCount[user] = (userActivityCount[user] || 0) + 1;
    });

    const topUsersData = Object.entries(userActivityCount)
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return { dailyData, activityTypeData, hourlyData, topUsersData };
  };

  const { dailyData, activityTypeData, hourlyData, topUsersData } = processChartData();

  // Calculate average session duration
  const avgDuration7d = stats7d.unique_sessions > 0 
    ? Math.round((stats7d.total_duration_seconds || 0) / stats7d.unique_sessions / 60)
    : 0;
  const avgDuration30d = stats30d.unique_sessions > 0 
    ? Math.round((stats30d.total_duration_seconds || 0) / stats30d.unique_sessions / 60)
    : 0;

  const statCards = [
    {
      title: 'Total Activities (7 days)',
      value: stats7d.total_activities || 0,
      icon: FiActivity,
      color: 'blue',
      change: stats30d.total_activities ? 
        (((stats7d.total_activities || 0) / (stats30d.total_activities || 1)) * 100).toFixed(1) + '%' : 'N/A',
    },
    {
      title: 'Total Users (7 days)',
      value: stats7d.unique_users || 0,
      icon: FiUsers,
      color: 'green',
      change: stats30d.unique_users ? 
        (((stats7d.unique_users || 0) / (stats30d.unique_users || 1)) * 100).toFixed(1) + '%' : 'N/A',
    },
    {
      title: 'Active Sessions (7 days)',
      value: stats7d.unique_sessions || 0,
      icon: FiTrendingUp,
      color: 'purple',
      change: stats30d.unique_sessions ? 
        (((stats7d.unique_sessions || 0) / (stats30d.unique_sessions || 1)) * 100).toFixed(1) + '%' : 'N/A',
    },
    {
      title: 'Avg Duration (7 days)',
      value: avgDuration7d > 0 ? avgDuration7d + ' min' : '0 min',
      icon: FiClock,
      color: 'orange',
      change: avgDuration30d > 0 ? 
        ((avgDuration7d / avgDuration30d) * 100).toFixed(1) + '%' : 'N/A',
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-indigo-500 text-white',
      green: 'bg-green-500 text-white',
      purple: 'bg-purple-500 text-white',
      orange: 'bg-orange-500 text-white',
    };
    return colors[color] || colors.blue;
  };

  const CHART_COLORS = ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const chartTheme = {
    grid: { stroke: '#27272A' },
    text: { fill: '#9ca3af', fontSize: 12 },
    axis: { stroke: '#27272A' }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400 text-sm">Overview of system statistics and recent activities</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg flex items-center justify-center w-11 h-11 ${getColorClasses(stat.color)}`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs text-gray-400">{stat.change} of 30d</span>
              </div>
              <h3 className="text-xs font-medium text-gray-400 mb-1.5">{stat.title}</h3>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Activity Trend */}
        <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Daily Activity Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="activities" 
                stroke="#6366f1" 
                fillOpacity={1} 
                fill="url(#colorActivities)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Types Distribution */}
        <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Activity Types Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={activityTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => {
                  const label = `${name} ${(percent * 100).toFixed(0)}%`;
                  return percent > 0.05 ? label : ''; // Only show label if slice is large enough
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {activityTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Activity Breakdown */}
        <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Daily Activity Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="activities" fill="#6366f1" name="Activities" />
              <Bar dataKey="users" fill="#10b981" name="Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity by Hour */}
        <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Activity by Hour (Last 24h)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="hour" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Top Users by Activity */}
        <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Top Users by Activity</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topUsersData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" width={150} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#f59e0b" name="Activities" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-[#18181B] rounded-lg shadow-sm border border-[#27272A]">
        <div className="px-6 py-4 border-b border-[#27272A]">
          <h2 className="text-xl font-semibold text-white">Recent Activities</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#09090B]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
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
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-400">
                    No activities found
                  </td>
                </tr>
              ) : (
                recentActivities.map((activity, index) => (
                  <tr key={index} className="hover:bg-[#27272A]">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                      {activity.user_email || activity.user_id || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-600 text-white">
                        {activity.activity_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
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
