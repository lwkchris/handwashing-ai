import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import './GamePage.css';

// MediaPipe (browser-side)
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function GamePage() {
  // ✅ 更新：加入完整 7 個洗手步驟 (內、外、夾、弓、大、立、腕)
  // 請確保你有對應嘅圖片放喺 public/images/ 目錄下
  const steps = [
  { label: 'Step1', displayLabel: '洗手心', image: '/images/Step1.png' },
  { label: 'Step2', displayLabel: '洗手背', image: '/images/Step2.png' },
  { label: 'Step3', displayLabel: '洗指縫', image: '/images/Step3.png' },
  { label: 'Step4', displayLabel: '洗指背', image: '/images/Step4.png' },
  { label: 'Step5', displayLabel: '洗大拇指', image: '/images/Step5.png' },
  { label: 'Step6', displayLabel: '洗指尖', image: '/images/Step6.png' },
  { label: 'Step7', displayLabel: '洗手腕', image: '/images/Step7.png' },
];

  // 遊戲狀態管理
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  
  const [prediction, setPrediction] = useState({ label: '尚未開始', confidence: 0 });
  const [score, setScore] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // "user" = 前置, "environment" = 後置
  
  // ✅ 新增：用作畫面顯示實時倒數嘅 State
  const [holdSeconds, setHoldSeconds] = useState(0);

  const holdCounter = useRef(0);
  const currentStep = steps[stepIndex];

  // Webcam & MediaPipe refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);
  const latestLandmarks126Ref = useRef(null);

  // ---------- 處理遊戲流程 ----------
  const handleStartGame = () => {
    setGameStarted(true);
    setGameFinished(false);
    setScore(0);
    setStepIndex(0);
    setHoldSeconds(0);
    holdCounter.current = 0;
    setPrediction({ label: '偵測中...', confidence: 0 });
  };

  const handleRestartGame = () => {
    handleStartGame();
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // ---------- 數據處理 Helpers ----------
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  };

  // ---------- Setup MediaPipe + Browser Webcam ----------
  useEffect(() => {
    if (!gameStarted || gameFinished) return undefined;

    let cancelled = false;

    const setup = async () => {
      try {
        setCameraError('');
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
          if (!ctx) return;

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

        try {
          if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop();
        } catch {}
        cameraRef.current = null;

        const cam = new Camera(videoEl, {
          onFrame: async () => {
            if (!handsRef.current || !videoRef.current) return;
            await handsRef.current.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
          facingMode: facingMode,
        });

        cameraRef.current = cam;
        await cam.start();
      } catch (err) {
        console.error('❌ Camera/MediaPipe init error:', err);
        setCameraError('⚠️ 開唔到鏡頭。請確認用 HTTPS、允許 Camera 權限，或用 Chrome/Edge 試下。');
      }
    };

    setup();

    return () => {
      cancelled = true;
      try { if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop(); } catch {}
      cameraRef.current = null;
      try { if (handsRef.current && handsRef.current.close) handsRef.current.close(); } catch {}
      handsRef.current = null;
      latestLandmarks126Ref.current = null;
    };
  }, [gameStarted, gameFinished, facingMode]);

  // ---------- Game loop: 判斷動作與倒數邏輯 ----------
  useEffect(() => {
    let interval;
    if (gameStarted && !gameFinished && currentStep) {
      interval = setInterval(async () => {
        try {
          const landmarks126 = latestLandmarks126Ref.current || new Array(126).fill(0);
          const data = await postLandmarks(landmarks126);

          setPrediction({
            label: data.label ?? '未知',
            confidence: typeof data.confidence === 'number' ? data.confidence : 0,
          });

          // 如果 AI 判斷正確
          if (data.label === currentStep.label) {
            holdCounter.current += 1;
            setHoldSeconds(holdCounter.current); // 更新畫面倒數

            if (holdCounter.current === 1) setScore((prev) => prev + 1);

            // 成功維持 3 秒，跳去下一個步驟
            if (holdCounter.current >= 3) {
              if (stepIndex < steps.length - 1) {
                setStepIndex((prev) => prev + 1);
                holdCounter.current = 0;
                setHoldSeconds(0);
              } else {
                // 如果已經係最後一步，完成遊戲
                setGameFinished(true);
                setGameStarted(false);
              }
            }
          } else {
            // 如果動作錯咗/斷咗，重置倒數
            holdCounter.current = 0;
            setHoldSeconds(0);
          }
        } catch (err) {
          console.error('❌ Prediction error:', err);
          setPrediction({ label: `⚠️ ${err.message}`, confidence: 0 });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [gameStarted, gameFinished, stepIndex, currentStep, steps.length]);

  return (
    <div className="game-page">
      <Header />

      <main className="main-content">
        
        {/* 狀態一：尚未開始遊戲 */}
        {!gameStarted && !gameFinished && (
          <div className="start-section text-center">
            <h1>🧼 洗手教學導引</h1>
            <p>準備好就開始挑戰 7 個正確洗手步驟啦！</p>
            <button className="start-button" onClick={handleStartGame}>
              開始遊戲
            </button>
          </div>
        )}

        {/* 狀態二：遊戲進行中 */}
        {gameStarted && !gameFinished && currentStep && (
          <div className="guide-layout">
            {/* 左邊：Webcam */}
            <div className="left-panel">
              <h2>🧼 Webcam 偵測中...</h2>
              <button
                onClick={handleToggleCamera}
                style={{
                  marginBottom: '10px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#4CAF50',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                🔄 切換鏡頭（{facingMode === 'user' ? '前置' : '後置'}）
              </button>

              {cameraError ? (
                <div style={{ padding: 12, borderRadius: 12, background: '#fff3cd' }}>
                  <p style={{ margin: 0 }}>{cameraError}</p>
                </div>
              ) : (
                <div className="webcam-wrap">
                  <video ref={videoRef} className="webcam-stream" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="webcam-overlay" />
                </div>
              )}
            </div>

            {/* 右邊：遊戲指示與倒數 */}
            <div className="right-panel">
              <div className="step-badge">進度：{stepIndex + 1} / {steps.length}</div>
              <h2>
                第 {stepIndex + 1} 步：請做出「{currentStep.displayLabel}」
              </h2>
              
              {/* 如果無圖片，可以 fallback 去文字或者留空 */}
              <img src={currentStep.image} alt={currentStep.label} className="step-image" onError={(e) => e.target.style.display='none'} />

              <div className="prediction-result">
                <p>🧠 AI 偵測：<strong>{prediction.label}</strong></p>
                <p>📊 信心指數：{(prediction.confidence * 100).toFixed(2)}%</p>
                <p>🎯 累積總分：{score}</p>
                
                {/* 倒數 3 秒 UI */}
                <div className="countdown-container" style={{ marginTop: '15px', padding: '10px', background: holdSeconds > 0 ? '#e8f5e9' : '#f5f5f5', borderRadius: '8px', transition: 'background 0.3s' }}>
                  {holdSeconds > 0 ? (
                    <h3 style={{ color: '#2e7d32', margin: 0 }}>✅ 動作正確！請維持 {3 - holdSeconds} 秒...</h3>
                  ) : (
                    <h3 style={{ color: '#757575', margin: 0 }}>⏳ 等待正確動作...</h3>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 狀態三：遊戲完成 */}
        {gameFinished && (
          <div className="finish-section text-center">
            <h1>🎉 挑戰成功！</h1>
            <p>你已經完成晒全部 7 個洗手步驟！</p>
            <h2 style={{ color: '#f39c12' }}>🏆 最終分數：{score}</h2>
            <button className="start-button" onClick={handleRestartGame} style={{ marginTop: '20px' }}>
              再玩一次
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

export default GamePage;
