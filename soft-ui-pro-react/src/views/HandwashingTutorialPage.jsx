import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'
import Header from '../components/Header'
import './HandwashingTutorialPage.css'

function HandwashingTutorialPage() {
  const history = useHistory()
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      title: '💧 第一步：濕水',
      image: './handwash-step-1.png',
      description: '先用清水將雙手濕透，為之後使用洗手液做好準備。🚿',
    },
    {
      title: '🫧 第二步：搓手心',
      image: './handwash-step-2.png',
      description: '加入洗手液，雙手手心互相搓揉，洗走表面污垢。🧼',
    },
    {
      title: '🙌 第三步：搓手背',
      image: './handwash-step-3.png',
      description: '一隻手搓另一隻手背，之後交換，確保手背位置都洗乾淨。✨',
    },
    {
      title: '🤝 第四步：洗指縫',
      image: './handwash-step-4.png',
      description: '十指交扣，來回搓揉，清潔手指之間容易忽略嘅位置。🫶',
    },
    {
      title: '✋ 第五步：洗指背',
      image: './handwash-step-5.png',
      description: '將手指彎曲，用另一隻手包住搓揉，清潔指背關節位。💫',
    },
    {
      title: '👍 第六步：洗拇指',
      image: './handwash-step-6.png',
      description: '握住拇指打圈搓洗，再交換另一隻手，拇指位置都好重要。🔄',
    },
    {
      title: '🌟 第七步：洗指尖與沖水',
      image: './handwash-step-7.png',
      description: '指尖喺手心打圈清潔，之後用清水沖淨，再抹乾雙手。🧽',
    },
  ]

  const goPrev = () => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev))
  }

  const goNext = () => {
    setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
  }

  const step = steps[currentStep]

  return (
    <div className="tutorial-page">
      <Header />

      <div className="tutorial-page-container">
        <div className="tutorial-topbar">
          <button
            className="back-button"
            type="button"
            onClick={() => history.push('/')}
          >
            ⬅️ 返回主頁
          </button>

          <div className="tutorial-progress-text">
            📍 步驟 {currentStep + 1} / {steps.length}
          </div>
        </div>

        <section className="tutorial-card">
          <div className="tutorial-image-area">
            <img
              src={step.image}
              alt={step.title}
              className="tutorial-step-image"
            />
          </div>

          <div className="tutorial-text-area">
            <h1 className="tutorial-step-title">{step.title}</h1>
            <p className="tutorial-step-description">{step.description}</p>
          </div>

          <div className="tutorial-navigation">
            <button
              className="nav-button"
              type="button"
              onClick={goPrev}
              disabled={currentStep === 0}
            >
              ⬅️ 上一步
            </button>

            <button
              className="nav-button primary"
              type="button"
              onClick={goNext}
              disabled={currentStep === steps.length - 1}
            >
              下一步 ➡️
            </button>
          </div>

          <div className="tutorial-dots">
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`dot ${index === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(index)}
                aria-label={`前往第 ${index + 1} 步`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default HandwashingTutorialPage


