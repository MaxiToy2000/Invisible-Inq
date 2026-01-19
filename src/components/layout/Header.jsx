import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiLogOut, FiChevronDown } from 'react-icons/fi';
import DonationPopup from '../common/DonationPopup';
import CombinedStoryDropdown from '../story/CombinedStoryDropdown';
import { useAuth } from '../../contexts/AuthContext';

const Header = ({
  stories = [],
  currentStoryId = null,
  currentChapterId = null,
  currentSubstoryId = null,
  onStorySelect,
  onChapterSelect,
  onSubstorySelect,
  showStoryDropdown = false,
  usePlainLogo = false
}) => {
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const userMenuRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <div className="sticky top-0 z-50 flex flex-col">
      {}
      <header className="bg-[#09090B] text-white shadow-md flex h-[42px] items-center relative">

        {}
        <div className={`h-full flex items-center ${showStoryDropdown ? 'ml-4' : 'ml-4 pl-2'}`}>
          <Link to="/" className="h-full flex items-center">
            <img
              src='/logo/logo-with-text.png'
              alt="Invisible Injury Logo"
              className="h-6 object-contain ml-2"
              onError={(e) => {
                console.error("Image failed to load");
                e.target.classList.add('hidden');
              }}
            />
          </Link>
        </div>

        {}
        <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <Link
            to="/"
            className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm"
            aria-label="Home page"
            tabIndex={0}
          >
            Home Page
          </Link>
          <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm">-</span>
          <Link
            to="/about"
            className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm"
            aria-label="About page"
            tabIndex={0}
          >
            About
          </Link>
          <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm">-</span>
          <Link
            to="/contact"
            className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm"
            aria-label="Contact page"
            tabIndex={0}
          >
            Contact
          </Link>
          <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm">-</span>
          <button
            className="text-white hover:text-gray-300 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs lg:text-sm"
            aria-label="Donate page"
            tabIndex={0}
            onClick={() => setShowDonationPopup(true)}
          >
            Donate
          </button>
        </nav>

        {/* User Menu and Version Info - Desktop */}
        <div className="hidden lg:flex items-center gap-4 ml-auto mr-4">
          {isAuthenticated() ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
              >
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt={user.full_name || user.email}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                    <FiUser className="w-4 h-4" />
                  </div>
                )}
                <span className="text-sm hidden xl:inline">
                  {user?.full_name || user?.email?.split('@')[0]}
                </span>
                <FiChevronDown className="w-4 h-4" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FiLogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-white hover:text-gray-300 transition-colors text-sm"
              >
                Sign in
              </Link>
              <span className="text-white text-sm">|</span>
              <Link
                to="/register"
                className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors text-sm"
              >
                Sign up
              </Link>
            </div>
          )}
          
          <span className="text-white text-sm">Graph Viewer 1.0</span>
        </div>

        {/* Mobile - Show auth and version */}
        {!showStoryDropdown && (
          <div className="lg:hidden flex items-center gap-2 pr-4 ml-auto mr-4">
            {isAuthenticated() ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center text-white hover:text-gray-300 transition-colors"
                >
                  {user?.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt={user.full_name || user.email}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                      <FiUser className="w-4 h-4" />
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <FiLogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="text-white hover:text-gray-300 transition-colors text-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        )}

        {}
        {showDonationPopup && (
          <DonationPopup onClose={() => setShowDonationPopup(false)} />
        )}
      </header>

      {}
      {showStoryDropdown && (
        <div className="lg:hidden w-full bg-[#09090B] border-b border-[#707070] h-10 mt-0">
          <CombinedStoryDropdown
            stories={stories}
            selectedStoryId={currentStoryId}
            selectedChapterId={currentChapterId}
            selectedSubstoryId={currentSubstoryId}
            onStorySelect={onStorySelect}
            onChapterSelect={onChapterSelect}
            onSubstorySelect={onSubstorySelect}
            inHeader={false}
            isMobileFullWidth={true}
            placeholder="Select an Investigation"
          />
        </div>
      )}
    </div>
  );
};

export default Header;
