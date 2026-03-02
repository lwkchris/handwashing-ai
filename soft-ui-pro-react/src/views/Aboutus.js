import React from 'react';
import Header from '../components/Header'; // ✅ Ensure this is correct
import './Aboutus.css';

function AboutUs() {
  return (
    <div className="about-page">
      <Header />

      <section className="about-hero">
        <img
          src="/Photoroom_20250505_114039.png"
          alt="吉祥物"
          className="about-mascot"
        />
        <h1 className="about-title">關於我們</h1>
        <p className="about-intro">我哋係洗手小勇士團隊，專注幫小朋友學識正確洗手方法！</p>
      </section>

      <section className="about-section">
        <h2>我哋嘅故事 ✨</h2>
        <p>
          呢個網站係為咗幫助小朋友了解洗手嘅重要性。透過互動遊戲，我哋希望令洗手變得有趣同埋容易學！
        </p>
      </section>

      <section className="about-section">
        <h2>我哋嘅目標 🎯</h2>
        <p>
          教導正確洗手步驟，提升衛生意識，打造一個健康快樂嘅校園同社區！
        </p>
      </section>

      <footer className="about-footer">
        <p>© 2025 洗手小勇士團隊 | 一齊守護健康 💧</p>
      </footer>
    </div>
  );
}

export default AboutUs;
