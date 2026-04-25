import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import './GamePage.css';

// MediaPipe (browser-side)
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

function GamePage() {
  const steps = [
    { label: 'Step1', displayLabel: '洗手心', image: '/images/Step1.png' },
    { label: 'Step2', displayLabel: '洗手背', image: '/images/Step2.png' },
    { label: 'Step3', displayLabel: '洗指縫', image: '/images/Step3.png' },
    { label: 'Step4', displayLabel: '洗指背', image: '/images/Step4.png' },
    { label: 'Step5', displayLabel: '洗大拇指', image: '/images/Step5.png' },
    { label: 'Step6', displayLabel: '洗指尖', image: '/images/Step6.png' },
    { label: 'Step7', displayLabel: '洗手腕', image: '/images/Step7.png' },
  ];

  const [gameState, setGameState] = useState('start');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [prediction, setPrediction] = useState({ label: '等待中...', confidence: 0 });
  const [score, setScore] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const latestLandmarks126Ref = useRef(new Array(126).fill(0));
  const holdCounter = useRef(0);

  const currentStep = steps[currentStepIndex];

  // Helper: Flatten MediaPipe results to 126 array
  const resultsTo126 = (hands) => {
    const flatten = (hand) => {
      if (!hand) return new Array(63).fill(0);
      return hand.flatMap(lm => [lm.x, lm.y, lm.z]);
    };
    const left = hands[0] ? flatten(hands[0]) : new Array(63).fill(0);
    const right = hands[1] ? flatten(hands[1]) : new Array(63).fill(0);
    return left.concat(right);
  };

  const postLandmarks = async (landmarks) => {
    const response = await fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks }),
    });
    return response.json();
  };

  useEffect(() => {
    if (gameState !== 'playing' || gameFinished) return;

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
      latestLandmarks126Ref.current = resultsTo126(results.multiHandLandmarks);
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => await hands.send({ image: videoRef.current }),
        width: 640,
        height: 480,
      });
      camera.start();
    }

    // --- PREDICTION LOOP WITH GATEKEEPER ---
    const predictionInterval = setInterval(async () => {
      const landmarks126 = latestLandmarks126Ref.current;

      // SOLUTION 1: Check if there is actual data (at least one non-zero value)
      const hasHands = landmarks126 && landmarks126.some(val => val !== 0);

      if (!hasHands) {
        setPrediction({ label: '未偵測到雙手', confidence: 0 });
        setHoldSeconds(0);
        holdCounter.current = 0;
        return; // EXIT: Do not call the backend
      }

      try {
        const data = await postLandmarks(landmarks126);
        if (data && data.length > 0) {
          const topResult = data[0];
          setPrediction(topResult);

          if (topResult.label === currentStep.label && topResult.confidence > 0.6) {
            holdCounter.current += 0.5;
            setHoldSeconds(Math.floor(holdCounter.current));

            if (holdCounter.current >= 3) {
              setScore(s => s + 10);
              if (currentStepIndex < steps.length - 1) {
                setCurrentStepIndex(i => i + 1);
                holdCounter.current = 0;
                setHoldSeconds(0);
              } else {
                setGameFinished(true);
              }
            }
          } else {
            holdCounter.current = 0;
            setHoldSeconds(0);
          }
        }
      } catch (err) {
        console.error("API Error:", err);
      }
    }, 500);

    return () => clearInterval(predictionInterval);
  }, [gameState, currentStepIndex, gameFinished]);

  const handleStartGame = () => setGameState('playing');

  return (
    <div className="game-page">
      <Header />
      <div className="game-content">
        {gameState === 'start' && (
          <button className="start-button" onClick={handleStartGame}>開始挑戰</button>
        )}

        {gameState === 'playing' && !gameFinished && (
          <div className="guide-layout">
            <div className="left-panel">
              <video ref={videoRef} className="webcam-stream" autoPlay playsInline />
            </div>
            <div className="right-panel">
              <h2>目前步驟：{currentStep.displayLabel}</h2>
              <img src={currentStep.image} alt={currentStep.label} className="step-image" />
              <div className="prediction-result">
                <p>🧠 AI 偵測：<strong>{prediction.label}</strong></p>
                <p>📊 信心指數：{(prediction.confidence * 100).toFixed(2)}%</p>
                <div className="countdown-container" style={{ background: holdSeconds > 0 ? '#e8f5e9' : '#f5f5f5' }}>
                  <h3>{holdSeconds > 0 ? `✅ 請維持 ${3 - holdSeconds} 秒` : '⏳ 等待正確動作...'}</h3>
                </div>
              </div>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="finish-section">
            <h1>🎉 挑戰成功！</h1>
            <button onClick={() => window.location.reload()}>再玩一次</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GamePage;