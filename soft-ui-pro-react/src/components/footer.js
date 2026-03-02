import React from 'react'

import './footer.css'

const Footer = (props) => {
  return (
    <footer className="footer-footer">
      <div className="footer-container1">
        <div className="footer-container2">
          <span className="footer-text10">SOFT</span>
          <span>Copyright © 2021 Soft by Creative Tim.</span>
        </div>
        <div className="footer-container3">
          <div className="footer-container4">
            <span className="footer-text12 Large">Company</span>
            <span className="footer-text13 Large">About Us</span>
            <span className="footer-text14 Large">Careers</span>
            <span className="footer-text15 Large">Press</span>
          </div>
          <div className="footer-container5">
            <span className="footer-text16 Large">Pages</span>
            <span className="footer-text17 Large">Login</span>
            <span className="footer-text18 Large">Register</span>
            <span className="footer-text19 Large">About</span>
          </div>
          <div className="footer-container6">
            <span className="footer-text20 Large">Products</span>
            <span className="footer-text21 Large">Free</span>
            <span className="footer-text22 Large">PRO</span>
            <span className="footer-text23 Large">Latest</span>
          </div>
        </div>
      </div>
      <img alt="image" src="/waves-white.svg" className="footer-image" />
    </footer>
  )
}

export default Footer
