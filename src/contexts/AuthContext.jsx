import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if token is expired
  const isTokenExpired = (token) => {
    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  };

  // Build user object from JWT payload (avoids /api/auth/me request on refresh)
  const userFromToken = (decoded) => {
    if (!decoded || decoded.exp * 1000 < Date.now()) return null;
    return {
      id: decoded.sub,
      email: decoded.email ?? '',
      full_name: decoded.full_name ?? null,
      profile_picture: decoded.profile_picture ?? null,
      is_active: decoded.is_active !== false,
      is_admin: decoded.is_admin === true,
      role: decoded.role ?? 'user',
      status: decoded.status ?? 'active',
      auth_provider: decoded.auth_provider ?? 'local',
    };
  };

  // Load user from token on mount (decode only; no /api/auth/me request)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      try {
        const decoded = jwtDecode(token);
        const userData = userFromToken(decoded);
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('token');
        setUser(null);
      }
    } else {
      if (token) localStorage.removeItem('token');
      setUser(null);
    }
    setLoading(false);
  }, []);

  // Register new user
  const register = async (email, password, fullName) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || 'Registration failed');
        return { success: false, error: data.detail || 'Registration failed' };
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error during registration';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || 'Login failed');
        return { success: false, error: data.detail || 'Login failed' };
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error during login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Login with Google
  const loginWithGoogle = async (credential) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || 'Google login failed');
        return { success: false, error: data.detail || 'Google login failed' };
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error during Google login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
    navigate('/');
  };

  // Get auth token
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return user !== null;
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    getToken,
    isAuthenticated
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
