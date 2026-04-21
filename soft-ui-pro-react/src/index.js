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
import AboutUs from './views/Aboutus'
import GamePage from './views/GamePage'
import HandwashingChallengePage from './views/HandwashingChallengePage'
import HandwashingTutorialPage from './views/HandwashingTutorialPage'

const App = () => {
  return (
    <Router>
      <Switch>
        <Route exact path="/coming-soon" component={ComingSoon} />
        <Route exact path="/" component={Home} />
        <Route exact path="/Aboutus" component={AboutUs} />
        <Route exact path="/game" component={GamePage} />

        <Route exact path="/challenge" component={HandwashingChallengePage} />
        <Route exact path="/handwashing/tutorial" component={HandwashingTutorialPage} />

        <Route exact path="/404" component={NotFound} />
        <Redirect to="/404" />
      </Switch>
    </Router>
  )
}

ReactDOM.render(<App />, document.getElementById('app'))


