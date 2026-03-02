import React from 'react'

import PropTypes from 'prop-types'

import './outline-gray-button.css'

const OutlineGrayButton = (props) => {
  return (
    <div
      className={`outline-gray-button-container ${props.rootClassName} `}
    ></div>
  )
}

OutlineGrayButton.defaultProps = {
  rootClassName: '',
}

OutlineGrayButton.propTypes = {
  rootClassName: PropTypes.string,
}

export default OutlineGrayButton
