import React from 'react'

import PropTypes from 'prop-types'

import NextButton from './next-button'
import './blog-card.css'

const BlogCard = (props) => {
  return (
    <div className="blog-card-container">
      <img
        alt={props.imageAlt}
        src={props.imageSrc}
        className="blog-card-image"
      />
      <h5 className="blog-card-text1">{props.newProp}</h5>
      <span>{props.description}</span>
      <NextButton button="Read more"></NextButton>
    </div>
  )
}

BlogCard.defaultProps = {
  imageAlt: 'image',
  description:
    'Finding temporary housing for your dog should be as easy as renting an Airbnb. That’s the idea behind Rover',
  newProp: 'Rover raised $65 million',
  imageSrc:
    'https://raw.githubusercontent.com/creativetimofficial/public-assets/master/soft-ui-design-system/assets/img/color-bags.jpg',
}

BlogCard.propTypes = {
  imageAlt: PropTypes.string,
  description: PropTypes.string,
  newProp: PropTypes.string,
  imageSrc: PropTypes.string,
}

export default BlogCard
