import React from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const location = useLocation();

  return (
    <div className="bg-gray-800">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link 
              to="/books" 
              className={`mx-2 px-3 py-2 rounded-md ${location.pathname === '/books' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              Books
            </Link>
            <Link 
              to="/subscription" 
              className={`mx-2 px-3 py-2 rounded-md ${location.pathname.startsWith('/subscription') ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              Subscription
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header; 