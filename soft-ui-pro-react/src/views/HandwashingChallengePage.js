// soft-ui-pro-react/src/views/HandwashingChallengePage.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import Header from '../components/Header';
import './HandwashingChallengePage.css';

import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function HandwashingChallengePage() {
  const history = useHistory();

  // 1. 定義基礎 7 個步驟
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
  const [steps, setSteps] = useState([]);
  const [prediction, setPrediction] = useState({ label: '尚未開始', confidence: 0 });
  const [score, setScore] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [holdSeconds, setHoldSeconds] = useState(0);

  const holdCounter = useRef(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);
  const latestLandmarks126Ref = useRef(null);

  const currentStep = steps[stepIndex] || null;

  // 2. 隨機生成 10 個動作的邏輯 (確保打亂順序)
  const generateTenSteps = (array) => {
    // A. 包含所有 7 個動作各一次
    let result = [...array];
    // B. 隨機再選 3 個動作補充至 10 個
    for (let i = 0; i < 3; i++) {
      const randomPick = array[Math.floor(Math.random() * array.length)];
      result.push(randomPick);
    }
    // C. Fisher-Yates Shuffle 洗牌演算法：徹底打亂這 10 個動作的順序
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const handleStartGame = () => {
    const tenSteps = generateTenSteps(baseSteps);
    setSteps(tenSteps);
    setStepIndex(0);
    setScore(0);
    setHoldSeconds(0);
    holdCounter.current = 0;
    setGameStarted(true);
    setGameFinished(false);
    setPrediction({ label: '偵測中...', confidence: 0 });
    setCameraError('');
  };

  const handleRestartGame = () => handleStartGame();

  // 3. MediaPipe & Camera 初始化 (固定前置鏡頭)
  useEffect(() => {
    if (!gameStarted || gameFinished) return;

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
          const w = videoEl.videoWidth || 640;
          const h = videoEl.videoHeight || 480;

          if (canvasEl.width !== w) canvasEl.width = w;
          if (canvasEl.height !== h) canvasEl.height = h;

          ctx.save();
          ctx.clearRect(0, 0, w, h);
          const handsLm = results.multiHandLandmarks || [];
          for (const lm of handsLm) {
            drawConnectors(ctx, lm, Hands.HAND_CONNECTIONS, { lineWidth: 4, color: '#00FF00' });
            drawLandmarks(ctx, lm, { radius: 3, color: '#FF0000' });
          }
          ctx.restore();
        });

        handsRef.current = hands;

        // 強制設定為 'user' 使用前置鏡頭
        const cam = new Camera(videoEl, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
          facingMode: 'environment', 
        });
        cameraRef.current = cam;
        await cam.start();
      } catch (err) {
        setCameraError('⚠️ 無法啟動鏡頭。請確保已允許瀏覽器存取相機。');
      }
    };

    setup();
    return () => {
      cancelled = true;
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
    };
  }, [gameStarted, gameFinished]); // 移除 facingMode 依賴

  // 4. 判定邏輯
  useEffect(() => {
    if (!gameStarted || gameFinished || !currentStep) return;

    const interval = setInterval(async () => {
      try {
        const landmarks126 = latestLandmarks126Ref.current || new Array(126).fill(0);
        const data = await postLandmarks(landmarks126);

        if (!data || !data.label) return;

        const matched = baseSteps.find(s => s.label === data.label);
        setPrediction({
          label: matched ? matched.displayLabel : '偵測中...',
          confidence: data.confidence || 0,
        });

        if (data.label === currentStep.label) {
          holdCounter.current += 1;
          setHoldSeconds(holdCounter.current);

          if (holdCounter.current >= 3) {
            clearInterval(interval);
            setScore((prev) => prev + 1);

            if (stepIndex < steps.length - 1) {
              setStepIndex((prev) => prev + 1);
              holdCounter.current = 0;
              setHoldSeconds(0);
            } else {
              setGameFinished(true);
              setGameStarted(false);
            }
          }
        } else {
          holdCounter.current = 0;
          setHoldSeconds(0);
        }
      } catch (err) {
        console.error('Prediction fail:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, gameFinished, stepIndex, steps.length, currentStep, baseSteps]);

  // 輔助函數
  const flattenHandLandmarksTo63 = (handLandmarks) => {
    const out = [];
    for (const p of handLandmarks) out.push(p.x, p.y, p.z);
    return out;
  };

  const resultsTo126 = (results) => {
    const hands = results?.multiHandLandmarks || [];
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
    if (!res.ok) throw new Error('API Error');
    return res.json();
  };

  return (
    <div className="challenge-page">
      <Header />
      <main className="main-content">
        {!gameStarted && !gameFinished && (
          <section className="game-start-screen">
            <div className="game-card text-center">
              <h1 className="game-title">🧼 洗手挑戰：全能戰士</h1>
              <p className="game-desc">系統會隨機安排 10 個洗手動作，每個動作需維持正確 3 秒。準備好就開始！</p>
              <div className="action-buttons">
                <button className="btn-primary" onClick={handleStartGame}>開始挑戰</button>
                <button className="btn-secondary" onClick={() => history.push('/')}>返回主頁</button>
              </div>
            </div>
          </section>
        )}

        {gameStarted && !gameFinished && currentStep && (
          <section className="game-playing-section">
            <div className="game-topbar">
              <button className="btn-secondary small" onClick={() => history.push('/')}>放棄挑戰</button>
            </div>

            <div className="guide-layout">
              <div className="game-card left-panel">
                <h2 className="panel-title">📷 偵測畫面 (前置鏡頭)</h2>
                <div className="webcam-wrap">
                  <video ref={videoRef} className="webcam-stream" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="webcam-overlay" />
                </div>
                {cameraError && <p className="error-text">{cameraError}</p>}
                <div className="prediction-box">
                  <p>🧠 AI 辨識中：<strong>{prediction.label}</strong></p>
                  <p>📊 信心指數：{(prediction.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="game-card right-panel">
                <div className="step-badge">第 {stepIndex + 1} / 10 關</div>
                <h2 className="current-step-title">請做出：{currentStep.displayLabel}</h2>
                <div className="step-image-wrap">
                  <img src={currentStep.image} alt="step" className="step-image" />
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
              <div className="action-buttons">
                <button className="btn-primary" onClick={handleRestartGame}>再玩一次</button>
                <button className="btn-secondary" onClick={() => history.push('/')}>返回主頁</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default HandwashingChallengePage;


