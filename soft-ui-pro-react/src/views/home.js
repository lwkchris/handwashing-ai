import React from 'react'
import { useHistory } from 'react-router-dom'
import Header from '../components/Header'
import './home.css'

function Home() {
  const history = useHistory()

  const mainSections = [
    {
      key: 'tutorial',
      title: '📖 教學',
      subtitle: '學習洗手七步驟 🧼',
      icon: '/tutorial-icon.png',
      className: 'section-tutorial',
      onClick: () => history.push('/handwashing/tutorial'),
    },
    {
      key: 'practice',
      title: '🧪 練習',
      subtitle: '試下自己做不做得到 💪',
      icon: '/practice-icon.png',
      className: 'section-practice',
      onClick: () => history.push('/game'),
    },
    {
      key: 'game',
      title: '🎮 遊戲',
      subtitle: '遊戲中挑戰自己 🏆',
      icon: '/game-icon.png',
      className: 'section-game',
      onClick: () => history.push('/challenge'),
    },
  ]

  return (
    <div className="home-page">
      <Header />

      <section className="home-welcome-section">
        <div className="home-mascot-wrap">
          <img
            src="/Photoroom_20250505_114039.png"
            alt="洗手小勇士吉祥物"
            className="home-mascot-image"
          />
        </div>

        <div className="home-welcome-text">
          <h1 className="home-welcome-title">🧼 洗手小勇士 🦸‍♂️</h1>
          <p className="home-welcome-message">
            一起學習正確洗手方法 ✨
            <br />
            保護自己和家人 🏠💖
          </p>
        </div>
      </section>

      <section className="home-menu-section">
        <h2 className="home-section-title">👇 選一個開始啦！ 👇</h2>

        <div className="home-main-section-cards">
          {mainSections.map((item) => (
            <button
              key={item.key}
              className={`home-main-section-card ${item.className}`}
              onClick={item.onClick}
              type="button"
            >
              <div className="home-main-section-icon">
                <img src={item.icon} alt={`${item.title}圖示`} />
              </div>

              <div className="home-main-section-content">
                <h3 className="home-main-section-title">{item.title}</h3>
                <p className="home-main-section-subtitle">{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-info-section">
        <h2 className="home-info-title">💡 小貼士</h2>
        <p className="home-info-text">
          🦠 細菌看不到，但是會黏在你手上！
          <br />
          🧼 記得用正確方法洗手，才可以真正洗乾淨！✨
        </p>
      </section>
    </div>
  )
}

export default Home

