import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiHome, FiActivity, FiUsers, FiLogOut, FiMenu, FiX, FiUser, FiChevronDown } from 'react-icons/fi';
import { useState, useRef, useEffect } from 'react';

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: FiHome, label: 'Dashboard' },
    { path: '/activities', icon: FiActivity, label: 'Activities' },
    { path: '/users', icon: FiUsers, label: 'Users' },
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#09090B] text-white transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo/logo-with-text.png"
              alt="Invisible Inquiry"
              className="h-7 object-contain"
              onError={(e) => {
                console.error("Logo image failed to load");
                e.target.style.display = 'none';
              }}
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 py-2.5 mb-1.5 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-[#27272A] hover:text-white'
                }`}
              >
                <Icon className="mr-3" size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full px-2 py-1 border-t border-[#27272A]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 text-gray-300 hover:bg-[#27272A] hover:text-white rounded-lg transition-colors text-sm"
          >
            <FiLogOut className="mr-2" size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-[#09090B]/80 backdrop-blur-sm shadow-sm border-b border-[#27272A]">
          <div className="flex items-center justify-between h-12 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors p-2"
            >
              <FiMenu size={20} />
            </button>
            <div className="flex items-center space-x-4 ml-auto">
              {/* User Info Button */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white hover:bg-[#27272A] transition-colors"
                  aria-label="User information"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                    <FiUser className="w-4 h-4" />
                  </div>
                  <span className="text-sm hidden md:inline">
                    {user?.full_name || user?.email?.split('@')[0] || 'Admin'}
                  </span>
                  <FiChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* User Info Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#18181B] border border-[#27272A] rounded-lg shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-[#27272A]">
                      <p className="text-sm font-medium text-white mb-1">
                        {user?.full_name || 'Admin User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate mb-2">
                        {user?.email || 'No email'}
                      </p>
                      {user?.created_at && (
                        <div className="mt-2 pt-2 border-t border-[#27272A]">
                          <p className="text-xs text-gray-400 mb-1">Registered</p>
                          <p className="text-xs text-white">
                            {new Date(user.created_at).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      )}
                      {user?.auth_provider && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Auth Provider</p>
                          <p className="text-xs text-white capitalize">{user.auth_provider}</p>
                        </div>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#27272A] hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <FiLogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6 bg-black min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
