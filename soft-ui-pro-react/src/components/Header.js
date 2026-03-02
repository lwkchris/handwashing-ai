import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
  return (
    <header className="site-header">
      <div className="navbar-container">
        <h1 className="site-title">🧼 洗手小勇士</h1>
        <nav className="nav-links">
          <Link to="/" className="nav-link">🏠 首頁</Link>
          <Link to="/game" className="nav-link">🎮 遊戲</Link>
          <Link to="/Aboutus" className="nav-link">ℹ️ 關於我們</Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
