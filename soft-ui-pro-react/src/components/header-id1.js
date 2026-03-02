import React from 'react'
import { Link } from 'react-router-dom'

import PrimaryPinkButton from './primary-pink-button'
import './header.css'

const Header = (props) => {
  return (
    <div data-role="Header" className="header-header">
      <nav className="header-nav">
        <div className="header-container1">
          <Link to="/" className="header-link HeadingTwo">
            Children&apos;s Handwashing game
          </Link>
          <div className="header-menu1">
            <Link to="/" className="header-navlink1 HeadingTwo">
              Home
            </Link>
            <Link to="/profile" className="header-navlink2 HeadingTwo">
              Profile
            </Link>
            <Link to="/coming-soon" className="header-navlink3 HeadingTwo">
              Coming Soon
            </Link>
          </div>
        </div>
        <div className="header-container2">
          <div className="header-container3">
            <div className="header-container4">
              <PrimaryPinkButton button="buy now"></PrimaryPinkButton>
            </div>
            <div data-role="BurgerMenu" className="header-burger-menu">
              <svg viewBox="0 0 1024 1024" className="header-icon1">
                <path d="M128 256h768v86h-768v-86zM128 554v-84h768v84h-768zM128 768v-86h768v86h-768z"></path>
              </svg>
            </div>
          </div>
        </div>
      </nav>
      <div data-role="MobileMenu" className="header-mobile-menu">
        <div className="header-top">
          <Link to="/" className="header-navlink4 Large">
            Soft UI Design System
          </Link>
          <div data-role="CloseMobileMenu" className="header-close-menu">
            <svg viewBox="0 0 1024 1024" className="header-icon3">
              <path d="M810 274l-238 238 238 238-60 60-238-238-238 238-60-60 238-238-238-238 60-60 238 238 238-238z"></path>
            </svg>
          </div>
        </div>
        <div className="header-mid">
          <div className="header-menu2">
            <Link to="/" className="header-navlink5 Large">
              Home
            </Link>
            <Link to="/profile" className="header-navlink6 Large">
              Profile
            </Link>
            <Link to="/coming-soon" className="header-navlink7 Large">
              Coming Soon
            </Link>
          </div>
        </div>
        <div className="header-bot">
          <PrimaryPinkButton button="buy now"></PrimaryPinkButton>
        </div>
      </div>
    </div>
  )
}

export default Header
