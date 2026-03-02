import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import './GamePage.css';

// MediaPipe (browser-side)
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function GamePage() {
  const steps = [
    { label: '洗手心', image: '/images/step1.png' },
    { label: '洗手背', image: '/images/step2.png' },
    { label: '洗指縫', image: '/images/step3.png' },
    { label: '洗手腕', image: '/images/step4.png' },
  ];

  const [gameStarted, setGameStarted] = useState(false);
  const [prediction, setPrediction] = useState({ label: '尚未開始', confidence: 0 });
  const [score, setScore] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraError, setCameraError] = useState('');

  // ✅ NEW: camera facing mode (front/back)
  // "user" = front camera, "environment" = back camera
  const [facingMode, setFacingMode] = useState('user');

  const holdCounter = useRef(0);
  const currentStep = steps[stepIndex];

  // Webcam refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);

  // Mediapipe refs
  const handsRef = useRef(null);
  const latestLandmarks126Ref = useRef(null);

  const handleStartGame = () => {
    setGameStarted(true);
    setScore(0);
    setStepIndex(0);
    holdCounter.current = 0;
    setPrediction({ label: '偵測中...', confidence: 0 });
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // ---------- Helpers ----------
  const flattenHandLandmarksTo63 = (handLandmarks) => {
    // handLandmarks: 21 points, each has x,y,z
    const out = [];
    for (const p of handLandmarks) out.push(p.x, p.y, p.z);
    return out; // 63
  };

  const resultsTo126 = (results) => {
    const hands = results?.multiHandLandmarks || [];
    const left = hands[0] ? flattenHandLandmarksTo63(hands[0]) : new Array(63).fill(0);
    const right = hands[1] ? flattenHandLandmarksTo63(hands[1]) : new Array(63).fill(0);
    return left.concat(right); // 126
  };

  const postLandmarks = async (landmarks126) => {
    const res = await fetch('/api/classify_landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: landmarks126 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data; // expected {label, confidence}
  };

  // ---------- Setup MediaPipe + Browser Webcam ----------
  useEffect(() => {
    if (!gameStarted) return;

    let cancelled = false;

    const setup = async () => {
      try {
        setCameraError('');

        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Init MediaPipe Hands
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

          // 1) 保存 landmarks 俾 backend classify
          latestLandmarks126Ref.current = resultsTo126(results);

          // 2) 畫 skeleton 到 canvas（疊喺 video 上面）
          const canvasEl = canvasRef.current;
          if (!canvasEl) return;

          const ctx = canvasEl.getContext('2d');
          if (!ctx) return;

          const w = videoEl.videoWidth || 640;
          const h = videoEl.videoHeight || 480;

          // 確保 canvas 實際像素同 video 一致（清晰）
          if (canvasEl.width !== w) canvasEl.width = w;
          if (canvasEl.height !== h) canvasEl.height = h;

          ctx.save();
          ctx.clearRect(0, 0, w, h);

          // ✅ 如果你想 canvas 只畫骨架（唔畫 video），就保持註解
          // ctx.drawImage(videoEl, 0, 0, w, h);

          const handsLm = results.multiHandLandmarks || [];
          for (const lm of handsLm) {
            drawConnectors(ctx, lm, Hands.HAND_CONNECTIONS, { lineWidth: 4 });
            drawLandmarks(ctx, lm, { radius: 3 });
          }

          ctx.restore();
        });

        handsRef.current = hands;

        // Stop any old camera first (important when switching facingMode)
        try {
          if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop();
        } catch {}
        cameraRef.current = null;

        // Init Camera util (drives frames into mediapipe)
        const cam = new Camera(videoEl, {
          onFrame: async () => {
            if (!handsRef.current || !videoRef.current) return;
            await handsRef.current.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,

          // ✅ NEW: front/back camera
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

      // Stop camera
      try {
        if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop();
      } catch {}
      cameraRef.current = null;

      // Close mediapipe
      try {
        if (handsRef.current && handsRef.current.close) handsRef.current.close();
      } catch {}
      handsRef.current = null;

      latestLandmarks126Ref.current = null;

      // Clear canvas
      try {
        const c = canvasRef.current;
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        }
      } catch {}
    };
  }, [gameStarted, facingMode]); // ✅ include facingMode so toggling camera re-inits

  // ---------- Game loop: every 1 sec call backend with latest landmarks ----------
  useEffect(() => {
    let interval;
    if (gameStarted) {
      interval = setInterval(async () => {
        try {
          const landmarks126 = latestLandmarks126Ref.current || new Array(126).fill(0);
          const data = await postLandmarks(landmarks126);

          setPrediction({
            label: data.label ?? '未知',
            confidence: typeof data.confidence === 'number' ? data.confidence : 0,
          });

          if (data.label === currentStep.label) {
            holdCounter.current += 1;

            // Add score only once per step
            if (holdCounter.current === 1) setScore((prev) => prev + 1);

            // Move to next step after 3 correct frames
            if (holdCounter.current >= 3) {
              if (stepIndex < steps.length - 1) {
                setStepIndex((prev) => prev + 1);
                holdCounter.current = 0;
              }
            }
          } else {
            holdCounter.current = 0;
          }
        } catch (err) {
          console.error('❌ Prediction error:', err);
          setPrediction({ label: `⚠️ ${err.message}`, confidence: 0 });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [gameStarted, stepIndex, currentStep.label]);

  return (
    <div className="game-page">
      <Header />

      <div className="guide-layout">
        {/* Webcam on left (browser webcam) */}
        <div className="left-panel">
          <h2>🧼 Webcam 偵測中...</h2>

          {/* ✅ NEW: toggle camera button */}
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

        {/* Step instructions on right */}
        <div className="right-panel">
          <h2>
            第 {stepIndex + 1} 步：{currentStep.label}
          </h2>
          <img src={currentStep.image} alt={currentStep.label} className="step-image" />

          <div className="prediction-result">
            <p>🧠 AI 偵測：{prediction.label}</p>
            <p>📊 信心指數：{(prediction.confidence * 100).toFixed(2)}%</p>
            <p>🎯 分數：{score}</p>
            <p>⏱ 正確維持秒數：{holdCounter.current}/3</p>
          </div>
        </div>
      </div>

      {!gameStarted && (
        <div className="start-section">
          <h1>🧼 洗手教學導引</h1>
          <button className="start-button" onClick={handleStartGame}>
            開始遊戲
          </button>
        </div>
      )}
    </div>
  );
}

export default GamePage;
