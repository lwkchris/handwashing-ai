import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import Header from '../components/Header';
import './HandwashingChallengePage.css';

import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function HandwashingChallengePage() {
  const history = useHistory();

  const baseSteps = useMemo(
    () => [
      { label: 'Step1', displayLabel: '洗手心', image: '/images/Step1.png' },
      { label: 'Step2', displayLabel: '洗手背', image: '/images/Step2.png' },
      { label: 'Step3', displayLabel: '洗指縫', image: '/images/Step3.png' },
      { label: 'Step4', displayLabel: '洗指背', image: '/images/Step4.png' },
      { label: 'Step5', displayLabel: '洗大拇指', image: '/images/Step5.png' },
      { label: 'Step6', displayLabel: '洗指尖', image: '/images/Step6.png' },
      { label: 'Step7', displayLabel: '洗手腕', image: '/images/Step7.png' },
    ],
    []
  );

  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [prediction, setPrediction] = useState({ label: '準備中', confidence: 0 });
  const [score, setScore] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [cameraError, setCameraError] = useState('');

  const holdCounter = useRef(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);
  const latestLandmarks126Ref = useRef(null);

  // ---------- Helpers ----------
  const flattenHandLandmarksTo63 = (handLandmarks) => {
    const out = [];
    for (const p of handLandmarks) out.push(p.x, p.y, p.z);
    return out;
  };

  const resultsTo126 = (results) => {
    const hands = results?.multiHandLandmarks || [];
    if (hands.length === 0) return null;
    const left = hands[0] ? flattenHandLandmarksTo63(hands[0]) : new Array(63).fill(0);
    const right = hands[1] ? flattenHandLandmarksTo63(hands[1]) : new Array(63).fill(0);
    return left.concat(right);
  };

  const postLandmarks = async (landmarks126) => {
    const res = await fetch('/api/classify_landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: landmarks126 }),
    });
    return await res.json();
  };

  const handleStartGame = () => {
    setGameStarted(true);
    setGameFinished(false);
    setScore(0);
    setHoldSeconds(0);
    holdCounter.current = 0;
    setCurrentStep(baseSteps[Math.floor(Math.random() * baseSteps.length)]);
  };

  const handleRestartGame = () => handleStartGame();

  // ---------- Setup MediaPipe (Mirrors Game.js logic) ----------
  useEffect(() => {
    if (!gameStarted || gameFinished) return undefined;

    let cancelled = false;

    const setup = async () => {
      try {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
          if (cancelled) return;
          latestLandmarks126Ref.current = resultsTo126(results);

          const canvasEl = canvasRef.current;
          if (!canvasEl) return;

          const ctx = canvasEl.getContext('2d');

          // ✅ Matches Game.js: Force canvas resolution to match video metadata
          // This keeps skeletons aligned without extending the container
          const w = videoEl.videoWidth || 640;
          const h = videoEl.videoHeight || 480;
          if (canvasEl.width !== w) canvasEl.width = w;
          if (canvasEl.height !== h) canvasEl.height = h;

          ctx.save();
          ctx.clearRect(0, 0, w, h);
          if (results.multiHandLandmarks) {
            for (const lm of results.multiHandLandmarks) {
              drawConnectors(ctx, lm, Hands.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
              drawLandmarks(ctx, lm, { color: '#FF0000', radius: 3 });
            }
          }
          ctx.restore();
        });

        handsRef.current = hands;

        const cam = new Camera(videoEl, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = cam;
        await cam.start();
      } catch (err) {
        setCameraError('鏡頭啟動失敗');
      }
    };

    setup();

    return () => {
      cancelled = true;
      cameraRef.current?.stop();
      handsRef.current?.close();
      latestLandmarks126Ref.current = null;
    };
  }, [gameStarted, gameFinished]);

  // ---------- Challenge Loop ----------
  useEffect(() => {
    let interval;
    if (gameStarted && !gameFinished && currentStep) {
      interval = setInterval(async () => {
        const landmarks = latestLandmarks126Ref.current;

        if (!landmarks) {
          setPrediction({ label: '未偵測到雙手', confidence: 0 });
          holdCounter.current = 0;
          setHoldSeconds(0);
          return;
        }

        try {
          const data = await postLandmarks(landmarks);
          setPrediction({
            label: data.label || '偵測中',
            confidence: data.confidence || 0
          });

          if (data.label === currentStep.label) {
            holdCounter.current += 1;
            setHoldSeconds(holdCounter.current);

            if (holdCounter.current >= 3) {
              const nextScore = score + 1;
              setScore(nextScore);
              holdCounter.current = 0;
              setHoldSeconds(0);

              if (nextScore >= 10) {
                setGameFinished(true);
                setGameStarted(false);
              } else {
                setCurrentStep(baseSteps[Math.floor(Math.random() * baseSteps.length)]);
              }
            }
          } else {
            holdCounter.current = 0;
            setHoldSeconds(0);
          }
        } catch (err) {
          console.error(err);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameFinished, score, currentStep, baseSteps]);

  return (
    <div className="challenge-page">
      <Header />
      <main className="main-content">
        {!gameStarted && !gameFinished && (
          <section className="game-start-screen">
            <div className="game-card text-center">
              <h1 className="game-title">✨ 洗手挑戰模式</h1>
              <p className="game-desc">隨機出現 10 個步驟，每個動作維持 3 秒即可過關！</p>
              <button className="btn-primary" onClick={handleStartGame}>開始挑戰</button>
            </div>
          </section>
        )}

        {gameStarted && !gameFinished && currentStep && (
          <section className="game-play-screen">
            <div className="challenge-container">
              <div className="video-panel">
                <div className="webcam-box">
                  <video ref={videoRef} className="webcam-feed" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="webcam-overlay" />
                </div>
                <div className="prediction-box">
                  <p>AI 判斷：<strong>{prediction.label}</strong> ({(prediction.confidence * 100).toFixed(1)}%)</p>
                </div>
              </div>

              <div className="info-panel">
                <div className="step-card">
                  <span className="step-badge">目標任務</span>
                  <h2 className="current-step-title">{currentStep.displayLabel}</h2>
                  <div className="step-image-wrap">
                    <img src={currentStep.image} alt="step" className="step-image" />
                  </div>
                </div>

                <div className="status-box">
                  <div className={`countdown-box ${holdSeconds > 0 ? 'active' : ''}`}>
                    {holdSeconds > 0 ? (
                      <p className="countdown-text">✅ 正確！請維持 <strong>{3 - holdSeconds}</strong> 秒</p>
                    ) : (
                      <p className="countdown-wait">等待正確動作...</p>
                    )}
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(holdSeconds / 3) * 100}%` }}></div>
                    </div>
                  </div>
                  <p className="score-text">🎯 已完成關卡：{score} / 10</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {gameFinished && (
          <section className="game-finish-screen">
            <div className="game-card text-center">
              <h1>🎉 恭喜！你完成了挑戰</h1>
              <h2 className="finish-score">最終得分：{score} / 10</h2>
              <button className="btn-primary" onClick={handleRestartGame}>再玩一次</button>
              <button className="btn-secondary" onClick={() => history.push('/')}>返回主頁</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default HandwashingChallengePage;