import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { FaBars } from 'react-icons/fa';
import DonationPopup from '../common/DonationPopup';
import CombinedStoryDropdown from '../story/CombinedStoryDropdown';
import { useAuth } from '../../contexts/AuthContext';
import HomePage from '../../pages/HomePage';

const Header = ({
  stories = [],
  currentStoryId = null,
  currentChapterId = null,
  currentSectionId = null,
  onStorySelect,
  onChapterSelect,
  onSectionSelect,
  showStoryDropdown = false,
  usePlainLogo = false,
  onHomePageClick = null,
}) => {
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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

  const toggleMobileMenu = () => {
    setShowMobileMenu((prev) => !prev);
  };

  return (
    <div className="sticky top-0 z-50 flex flex-col">
      {}
      {/* xs, sm & md: single bar = Logo | Selection tab | Hamburger | User avatar (first line disappears) */}
      <div className="relative flex lg:hidden h-10 bg-[#09090B] border-b border-[#707070] items-center px-2 gap-2">
        <Link to="/" className="flex-shrink-0 flex items-center">
          {/* xs: icon only; sm/md: full logo with label */}
          <img
            src="/images/logo-without-text.png"
            alt="Invisible Inquiry"
            className="h-8 w-8 object-contain sm:hidden"
            onClick={onHomePageClick}
            onError={(e) => {
              e.target.classList.add('hidden');
            }}
          />
          <img
            src="/images/logo-with-text.png"
            alt="Invisible Inquiry Logo"
            onClick={onHomePageClick}
            className="h-6 w-auto min-w-[2rem] object-contain hidden sm:block"
            onError={(e) => {
              e.target.classList.add('hidden');
            }}
          />
        </Link>
        {showStoryDropdown ? (
          <div className="flex-1 min-w-0">
            <CombinedStoryDropdown
              stories={stories}
              selectedStoryId={currentStoryId}
              selectedChapterId={currentChapterId}
              selectedSectionId={currentSectionId}
              onStorySelect={onStorySelect}
              onChapterSelect={onChapterSelect}
              onSectionSelect={onSectionSelect}
              inHeader={false}
              isMobileFullWidth={true}
              placeholder="Select an Investigation"
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0" />
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="p-1 text-white hover:text-gray-300 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <FaBars className="w-5 h-5" />
            </button>
            {showMobileMenu && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-[#09090B] border border-[#27272A] rounded-md shadow-lg z-40">
                {onHomePageClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      onHomePageClick();
                    }}
                    className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  >
                    Home Page
                  </button>
                ) : (
                  <Link
                    to="/"
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  >
                    Home Page
                  </Link>
                )}
                <Link
                  to="/about"
                  onClick={() => setShowMobileMenu(false)}
                  className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                >
                  About
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setShowMobileMenu(false)}
                  className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                >
                  Contact
                </Link>
                <button
                  className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowDonationPopup(true);
                  }}
                >
                  Donate
                </button>
              </div>
            )}
          </div>
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
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'User'}</p>
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
            <Link to="/login" className="text-white hover:text-gray-300 transition-colors text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* lg and up: original header (first line with logo, nav, user) */}
      <header className="hidden lg:flex bg-[#09090B] text-white shadow-md h-[42px] items-center relative px-2">

        {}
        <div className={`h-full flex items-center ${showStoryDropdown ? 'ml-2' : 'ml-2 pl-1'}`}>
          <Link to="/" className="h-full flex items-center">
            <img
              src='/images/logo-with-text.png'
              alt="Invisible Inqury Logo"
              className="h-6 object-contain ml-1"
              onClick={onHomePageClick}
              onError={(e) => {
                console.error("Image failed to load");
                e.target.classList.add('hidden');
              }}
            />
          </Link>
        </div>

        {}
        <nav className="hidden xl:flex absolute left-1/2 transform -translate-x-1/2 items-center">
          {onHomePageClick ? (
            <button
              type="button"
              onClick={onHomePageClick}
              className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm bg-transparent border-none p-0 cursor-pointer"
              aria-label="Home page"
              tabIndex={0}
            >
              Home Page
            </button>
          ) : (
            <Link
              to="/"
              className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm"
              aria-label="Home page"
              tabIndex={0}
            >
              Home Page
            </Link>
          )}
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

        {/* Mobile - Logo + Hamburger + User Avatar (xs / sm / md / lg) */}
        <div className="xl:hidden ml-4 flex items-center gap-2 mr-auto mr-2">
          <div className="relative">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="p-1 text-white hover:text-gray-300 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <FaBars className="w-5 h-5" />
            </button>
            {showMobileMenu && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-[#09090B] border border-[#27272A] rounded-md shadow-lg z-40">
                {onHomePageClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      onHomePageClick();
                    }}
                    className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  >
                    Home Page
                  </button>
                ) : (
                  <Link
                    to="/"
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  >
                    Home Page
                  </Link>
                )}
                <Link
                  to="/about"
                  onClick={() => setShowMobileMenu(false)}
                  className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                >
                  About
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setShowMobileMenu(false)}
                  className="block px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                >
                  Contact
                </Link>
                <button
                  className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-[#18181B]"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowDonationPopup(true);
                  }}
                >
                  Donate
                </button>
              </div>
            )}
          </div>
          {!showStoryDropdown && (
            <>
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
            </>
          )}
        </div>

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
                <span className="text-sm">
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
          
          <span className="hidden 2xl:inline text-white text-sm">Graph Viewer 1.0</span>
        </div>

        {}
        {showDonationPopup && (
          <DonationPopup onClose={() => setShowDonationPopup(false)} />
        )}
      </header>

      {}
      {/* second line with selection tab not used (xs/sm/md use single bar; lg+ uses sidebar) */}
      {showStoryDropdown && (
        <div className="hidden w-full bg-[#09090B] border-b border-[#707070] h-10 mt-0">
          <CombinedStoryDropdown
            stories={stories}
            selectedStoryId={currentStoryId}
            selectedChapterId={currentChapterId}
            selectedSectionId={currentSectionId}
            onStorySelect={onStorySelect}
            onChapterSelect={onChapterSelect}
            onSectionSelect={onSectionSelect}
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
