import React from 'react'

import PropTypes from 'prop-types'

import './feature-card.css'

const FeatureCard = (props) => {
  return (
    <div className="feature-card-container">
      <img
        alt={props.imageAlt}
        src={props.imageSrc}
        className="feature-card-image"
      />
      <h5 className="feature-card-text1 HeadingThree">{props.newProp}</h5>
      <span className="feature-card-text2">{props.text}</span>
    </div>
  )
}

FeatureCard.defaultProps = {
  imageSrc: '/rocket1.svg',
  imageAlt: 'image',
  text: 'Get the latest design ideas and turn it into reality.',
  newProp: 'Design',
}

FeatureCard.propTypes = {
  imageSrc: PropTypes.string,
  imageAlt: PropTypes.string,
  text: PropTypes.string,
  newProp: PropTypes.string,
}

export default FeatureCard
