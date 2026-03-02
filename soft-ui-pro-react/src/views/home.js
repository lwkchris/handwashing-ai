import React from 'react'
import Header from '../components/Header' // Capital H
// Make sure path is correct
import './HandwashingGamePage.css'

function HandwashingGamePage() {
  return (
    <div className="handwashing-game-page">
      {/* 🔝 導覽列 */}
      <Header />

      {/* 👋 歡迎區域 */}
      <section className="welcome-section">
        <div className="mascot">
          <img
            src="/Photoroom_20250505_114039.png"
            alt="洗手小勇士吉祥物"
            className="mascot-image"
          />
        </div>
        <div className="welcome-text">
          <h1 className="welcome-title">👋 歡迎嚟到洗手小勇士！</h1>
          <p className="welcome-message">
            一齊玩住學，做個乾淨小勇士啦！
          </p>
        </div>
      </section>

      {/* 🧼 任務選單 */}
      <section className="menu-section">
        <h2 className="section-title">揀一個關卡開始啦！</h2>
        <div className="phase-cards">
          <div className="phase-card phase-pretest">
            <div className="phase-icon">
              <img src="/pretest-icon.png" alt="前測圖示" />
            </div>
            <h3 className="phase-title">前測</h3>
          </div>
          <div className="phase-card phase-practice">
            <div className="phase-icon">
              <img src="/practice-icon.png" alt="練習圖示" />
            </div>
            <h3 className="phase-title">練習</h3>
          </div>
          <div className="phase-card phase-battle">
            <div className="phase-icon">
              <img src="/battle-icon.png" alt="挑戰圖示" />
            </div>
            <h3 className="phase-title">挑戰</h3>
          </div>
          <div className="phase-card phase-posttest">
            <div className="phase-icon">
              <img src="/posttest-icon.png" alt="大測驗圖示" />
            </div>
            <h3 className="phase-title">大測驗</h3>
          </div>
        </div>
      </section>

      {/* 💡 鼓勵資訊區 */}
      <section className="info-section">
        <h2 className="info-title">你知唔知道？</h2>
        <p className="info-text">
          勤洗手可以打敗好多細菌！做個健康小勇士，保護自己同屋企人啦 💪
        </p>
      </section>
    </div>
  )
}

export default HandwashingGamePage
