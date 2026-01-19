import { createContext, useContext, useState, useEffect } from 'react';
import { adminLogin } from '../utils/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    
    if (token && userData) {
      try {
        const decoded = jwtDecode(token);
        // Check if token is expired
        if (decoded.exp * 1000 > Date.now()) {
          setUser(JSON.parse(userData));
        } else {
          // Token expired
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await adminLogin(email, password);
      
      if (response.access_token) {
        const decoded = jwtDecode(response.access_token);
        const userData = {
          email: decoded.email || response.user?.email || email,
          id: decoded.id || response.user?.id,
          is_admin: decoded.is_admin || true,
          full_name: decoded.full_name || response.user?.full_name || 'Admin',
          created_at: response.user?.created_at || null,
          auth_provider: response.user?.auth_provider || decoded.auth_provider || 'local',
        };
        
        localStorage.setItem('admin_token', response.access_token);
        localStorage.setItem('admin_user', JSON.stringify(userData));
        setUser(userData);
        
        return { success: true };
      }
      
      throw new Error('No access token received');
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
