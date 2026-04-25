import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import Header from '../components/Header';
import './GamePage.css'; // ✅ Use the same CSS as GamePage for UI consistency

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
  const [facingMode, setFacingMode] = useState('environment');

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

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // ---------- Setup MediaPipe (Exact Mirror of GamePage.js) ----------
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
          facingMode: facingMode
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
  }, [gameStarted, gameFinished, facingMode]);

  // ---------- Challenge Loop (Logic logic) ----------
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
          setPrediction({ label: data.label || '偵測中', confidence: data.confidence || 0 });

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
        } catch (err) { console.error(err); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameFinished, score, currentStep, baseSteps]);

  return (
    <div className="game-page"> {/* ✅ Class matches GamePage */}
      <Header />
      <main className="main-content">
        {!gameStarted && !gameFinished && (
          <div className="start-section text-center">
            <h1>✨ 洗手挑戰模式</h1>
            <p>隨機出現 10 個步驟，每個動作維持 3 秒即可過關！</p>
            <button className="start-button" onClick={handleStartGame}>開始挑戰</button>
          </div>
        )}

        {gameStarted && !gameFinished && currentStep && (
          <div className="guide-layout">
            {/* Left Panel: Webcam (Exact Mirror of GamePage) */}
            <div className="left-panel">
              <h2>🧼 Webcam 偵測中...</h2>
              <button onClick={handleToggleCamera} className="camera-toggle-btn">
                🔄 切換鏡頭（{facingMode === 'user' ? '前置' : '後置'}）
              </button>

              {cameraError ? (
                <div className="error-msg"><p>{cameraError}</p></div>
              ) : (
                <div className="webcam-wrap">
                  <video ref={videoRef} className="webcam-stream" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="webcam-overlay" />
                </div>
              )}
            </div>

            {/* Right Panel: Challenge Info (Exact Mirror of GamePage) */}
            <div className="right-panel">
              <div className="step-badge">進度：{score} / 10</div>
              <h2>目標任務：請做出「{currentStep.displayLabel}」</h2>

              <img src={currentStep.image} alt="step" className="step-image" onError={(e) => e.target.style.display='none'} />

              <div className="prediction-result">
                <p>🧠 AI 偵測：<strong>{prediction.label}</strong></p>
                <p>📊 信心指數：{(prediction.confidence * 100).toFixed(2)}%</p>
                <p>🎯 目前得分：{score}</p>

                <div className="countdown-container" style={{ background: holdSeconds > 0 ? '#e8f5e9' : '#f5f5f5' }}>
                  {holdSeconds > 0 ? (
                    <h3 style={{ color: '#2e7d32' }}>✅ 動作正確！請維持 {3 - holdSeconds} 秒...</h3>
                  ) : (
                    <h3 style={{ color: '#757575' }}>⏳ 等待正確動作...</h3>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="finish-section text-center">
            <h1>🎉 恭喜！你完成了挑戰</h1>
            <p>你已經完成 10 個隨機洗手步驟！</p>
            <h2 style={{ color: '#f39c12' }}>🏆 最終得分：{score} / 10</h2>
            <button className="start-button" onClick={handleStartGame}>再玩一次</button>
            <button className="start-button" onClick={() => history.push('/')} style={{ background: '#95a5a6', marginLeft: '10px' }}>返回主頁</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default HandwashingChallengePage;