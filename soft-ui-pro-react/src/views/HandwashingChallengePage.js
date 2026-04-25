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
  const latestLandmarks126Ref = useRef(new Array(126).fill(0)); // Initialize with zeros

  const currentStep = steps[stepIndex] || null;

  const generateTenSteps = (array) => {
    let result = [...array];
    for (let i = 0; i < 3; i++) {
      const randomPick = array[Math.floor(Math.random() * array.length)];
      result.push(randomPick);
    }
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
    setPrediction({ label: '等待偵測...', confidence: 0 });
  };

  // MediaPipe Initialization
  useEffect(() => {
    if (!gameStarted || gameFinished) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      // Update landmarks reference
      latestLandmarks126Ref.current = resultsTo126(results);

      // Draw landmarks on canvas
      if (canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.save();
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        if (results.multiHandLandmarks) {
          for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
          }
        }
        ctx.restore();
      }
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
        facingMode: 'user', // Changed to user for front camera
      });
      camera.start();
      cameraRef.current = camera;
    }

    handsRef.current = hands;

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
    };
  }, [gameStarted, gameFinished]);

  // Prediction Loop with Gatekeeper
  useEffect(() => {
    if (!gameStarted || gameFinished || !currentStep) return;

    const interval = setInterval(async () => {
      const landmarks126 = latestLandmarks126Ref.current;

      // --- SOLUTION 1: GATEKEEPER ---
      const hasHands = landmarks126 && landmarks126.some(val => val !== 0);

      if (!hasHands) {
        setPrediction({ label: '未偵測到雙手', confidence: 0 });
        holdCounter.current = 0;
        setHoldSeconds(0);
        return; // Skip API call
      }

      try {
        const data = await postLandmarks(landmarks126);
        if (!data) return;

        // Use standard confidence threshold of 0.6
        const isCorrectAction = data.label === currentStep.label && data.confidence > 0.6;

        const matched = baseSteps.find(s => s.label === data.label);
        setPrediction({
          label: matched ? matched.displayLabel : '未知動作',
          confidence: data.confidence || 0,
        });

        if (isCorrectAction) {
          holdCounter.current += 0.5; // Increment by interval timing (roughly 0.5s)
          setHoldSeconds(Math.floor(holdCounter.current));

          if (holdCounter.current >= 3) {
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
    }, 500); // 0.5 second interval is smoother for feedback

    return () => clearInterval(interval);
  }, [gameStarted, gameFinished, stepIndex, steps, currentStep, baseSteps]);

  const flattenHandLandmarksTo63 = (handLandmarks) => {
    return handLandmarks.flatMap(p => [p.x, p.y, p.z]);
  };

  const resultsTo126 = (results) => {
    const hands = results?.multiHandLandmarks || [];
    const left = hands[0] ? flattenHandLandmarksTo63(hands[0]) : new Array(63).fill(0);
    const right = hands[1] ? flattenHandLandmarksTo63(hands[1]) : new Array(63).fill(0);
    return left.concat(right);
  };

  const postLandmarks = async (landmarks126) => {
    const res = await fetch('http://localhost:5000/predict', { // Ensure URL is correct
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: landmarks126 }),
    });
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
              <p className="game-desc">隨機安排 10 個洗手動作，每個動作需維持正確 3 秒。</p>
              <button className="btn-primary" onClick={handleStartGame}>開始挑戰</button>
            </div>
          </section>
        )}

        {gameStarted && !gameFinished && currentStep && (
          <div className="guide-layout">
            <div className="game-card left-panel">
              <div className="webcam-wrap">
                <video ref={videoRef} className="webcam-stream" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="webcam-overlay" />
              </div>
              <div className="prediction-box">
                <p>AI 辨識：<strong>{prediction.label}</strong> ({(prediction.confidence * 100).toFixed(0)}%)</p>
              </div>
            </div>

            <div className="game-card right-panel">
              <div className="step-badge">第 {stepIndex + 1} / 10 關</div>
              <h2 className="current-step-title">{currentStep.displayLabel}</h2>
              <img src={currentStep.image} alt="step" className="step-image" />
              <div className="status-box">
                <div className={`countdown-box ${holdSeconds > 0 ? 'active' : ''}`}>
                  <p>{holdSeconds > 0 ? `請維持 ${3 - holdSeconds} 秒` : '等待動作...'}</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(holdSeconds / 3) * 100}%` }}></div>
                  </div>
                </div>
                <p className="score-text">已完成：{score} / 10</p>
              </div>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="finish-section text-center">
            <h1>🎉 挑戰成功！</h1>
            <h2>最終得分：{score} / 10</h2>
            <button className="btn-primary" onClick={handleStartGame}>再玩一次</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default HandwashingChallengePage;