import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import ParticlesBackground from '../components/common/ParticlesBackground';
import BackgroundOverlay from '../components/common/BackgroundOverlay';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.error || 'Login failed. Please check your credentials.');
    }
    
    setIsLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setErrorMessage('');
    setIsLoading(true);
    
    const result = await loginWithGoogle(credentialResponse.credential);
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.error || 'Google login failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleGoogleError = () => {
    setErrorMessage('Google login failed. Please try again.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Particles Background */}
      <ParticlesBackground className="z-0" />
      {/* Background Overlay */}
      <BackgroundOverlay opacity={0.2} gradient={true} className="z-0" />
      <div className="max-w-md w-full space-y-8 relative z-10">


        <div className="bg-[#18181B] border border-[#27272A] py-8 px-4 shadow-xl rounded-lg sm:px-10">
          {errorMessage && (
            <div className="mb-4 bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded relative">
              <span className="block sm:inline">{errorMessage}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
          <Link to="/" className="flex justify-center">
            <img
              className="h-12 w-auto"
              src="/logo/logo-with-text.png"
              alt="Logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              create a new account
            </Link>
          </p>
        </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2 border border-[#27272A] bg-[#09090B] text-white rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-[#09090B] rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-indigo-400 hover:text-indigo-300">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#27272A]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#18181B] text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
