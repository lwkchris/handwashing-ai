from flask import Flask, render_template, Response, jsonify, request
from flask_cors import CORS, cross_origin
import sys
import os
import cv2
import mediapipe as mp
import atexit
import multiprocessing

import warnings
warnings.filterwarnings("ignore", category=UserWarning, message="resource_tracker.*")


# Add parent folder to path to allow importing Prediction
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Prediction import HandWashing  # Make sure this file exists and works

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])  # Allow requests from React frontend

# Load handwashing prediction model
hand_washing = HandWashing()

# Initialize MediaPipe for hand detection
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2,
                       min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Start webcam
video_capture = cv2.VideoCapture(0)

# ✅ Cleanup multiprocessing semaphore at shutdown
@atexit.register
def cleanup_resources():
    try:
        multiprocessing.resource_tracker._after_fork()
        print("🧹 Cleaned up multiprocessing resource tracker")
    except Exception as e:
        print("⚠️ Cleanup error:", e)


def generate_frames_with_skeleton():
    """Stream webcam frames with hand skeleton overlay"""
    while True:
        success, frame = video_capture.read()
        if not success:
            break

        # Flip and convert frame to RGB for MediaPipe
        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)

        # Draw skeletons if detected
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2, circle_radius=2),
                )

        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        # Return frame in streaming response
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')


@app.route('/')
def index():
    return "This server handles webcam streaming and prediction."


@app.route('/video_feed_with_skeleton')
@cross_origin(origins="http://localhost:3000")
def video_feed_with_skeleton():
    """Route for video streaming to frontend"""
    response = Response(generate_frames_with_skeleton(), mimetype='multipart/x-mixed-replace; boundary=frame')
    response.headers.add('Access-Control-Allow-Origin', '*')  # Allow CORS
    return response


@app.route('/predict', methods=['POST', 'OPTIONS'])
@cross_origin(origins="http://localhost:3000")
def predict():
    """Make a prediction on the current webcam frame"""
    print("📥 Received prediction request")
    try:
        success, frame = video_capture.read()
        if not success:
            print("❌ Failed to read webcam frame")
            return jsonify({"label": "No hands detected", "confidence": 0.0}), 500

        # Flip frame to match mirror view
        frame = cv2.flip(frame, 1)

        # Get hand landmarks from the frame
        landmarks = hand_washing.get_landmarks_from_frame(frame)
        print(f"📌 Extracted landmarks: {landmarks}")

        if not landmarks or all(value == 0 for value in landmarks):
            print("🚫 No valid hand landmarks detected in current frame. Returning no-hand result.")
            return jsonify({"label": "No hands detected", "confidence": 0.0})

        predictions = hand_washing.predict_landmarks(landmarks)
        print(f"🔮 Prediction result: {predictions}")

        if predictions:
            top_prediction = predictions[0]
            print(f"✅ Sending: {top_prediction}")
            return jsonify(top_prediction)
        else:
            return jsonify({"label": "No hands detected", "confidence": 0.0})

    except Exception as e:
        print("❌ Error during prediction:", str(e))
        return jsonify({"label": "Prediction error", "confidence": 0.0})


@app.route('/shutdown', methods=['POST'])
def shutdown():
    """Shutdown Flask server and clean up resources"""
    global video_capture
    video_capture.release()
    hands.close()
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return "Server shutting down..."


if __name__ == "__main__":
    app.run(debug=True)
