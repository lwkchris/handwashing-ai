import React from 'react'
import ReactDOM from 'react-dom'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
} from 'react-router-dom'

import './style.css'
import ComingSoon from './views/coming-soon'
import Home from './views/home'
import NotFound from './views/not-found'
import AboutUs from './views/Aboutus.js'
import GamePage from './views/GamePage';

const App = () => {
  return (
    <Router>
      <Switch>
        <Route component={ComingSoon} exact path="/coming-soon" />
        <Route component={Home} exact path="/" />
        <Route component={AboutUs} exact path="/Aboutus" /> 
        <Route component={GamePage} exact path="/game" />
        <Route component={NotFound} path="**" />
        <Redirect to="**" />
      </Switch>
    </Router>
  )
}

ReactDOM.render(<App />, document.getElementById('app'))
