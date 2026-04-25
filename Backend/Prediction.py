# Backend/Prediction.py

import cv2
import torch
import numpy as np
import mediapipe as mp
from joblib import load
from model import FNNModel  # Ensure this matches your directory structure


class HandWashing:
    def __init__(self):
        # Paths to the model and label encoder
        MODEL_PATH = r"../Training/model_dir/cnn_asl_model.pth"
        ENCODER_PATH = r"../Training/model_dir/cnn_label_encoder.joblib"

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize the model
        # Input size: 21 landmarks * 3 coordinates (x,y,z) * 2 hands = 126
        self.model = FNNModel(input_size=126, num_classes=7)

        # Load weights
        try:
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
            print(f"Model loaded successfully on {self.device}")
        except Exception as e:
            print(f"Error loading model: {e}")

        self.model.to(self.device)
        self.model.eval()

        # Load the label encoder
        self.label_encoder = load(ENCODER_PATH)

        # MediaPipe Hands instance
        self.mp_hands = mp.solutions.hands

    def get_landmarks_from_frame(self, frame):
        """Extract hand landmarks from the video frame using MediaPipe."""
        with self.mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.25, min_tracking_confidence=0.25) as hands:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)

            if results.multi_hand_landmarks:
                # Initialize 126 zeros (63 for left, 63 for right)
                landmarks = [0.0] * 126

                for hand_index, hand_landmarks in enumerate(results.multi_hand_landmarks):
                    if hand_index >= 2: break  # Max 2 hands

                    for i, landmark in enumerate(hand_landmarks.landmark):
                        # Calculate start index based on which hand it is
                        start_idx = hand_index * 63 + i * 3
                        landmarks[start_idx] = landmark.x
                        landmarks[start_idx + 1] = landmark.y
                        landmarks[start_idx + 2] = landmark.z

                return landmarks
        return None

    def predict_landmarks(self, landmarks):
        """Predict the top 3 confidence levels for the given landmarks."""

        # 1. Check if landmarks exist
        if not landmarks:
            return [{"label": "No hands detected", "confidence": 0.0}]

        # 2. Check if the array is effectively empty (all zeros)
        # We use a small epsilon for float comparison
        landmarks_array = np.array(landmarks)
        if np.all(np.abs(landmarks_array) < 1e-5):
            return [{"label": "No hands detected", "confidence": 0.0}]

        # 3. Normalization logic (Preventing division by zero)
        max_val = np.max(np.abs(landmarks_array))
        if max_val > 0:
            landmarks_array = landmarks_array / max_val
        else:
            return [{"label": "No hands detected", "confidence": 0.0}]

        # Convert to tensor for model input
        landmarks_tensor = torch.tensor(landmarks_array, dtype=torch.float32).unsqueeze(0).to(self.device)

        # Inferencing
        with torch.no_grad():
            outputs = self.model(landmarks_tensor)
            probabilities = torch.softmax(outputs, dim=1)

            # Extract top-3 predictions with confidence
            top_probs, top_indices = torch.topk(probabilities, 3, dim=1)
            top_probs = top_probs.squeeze(0).cpu().numpy()
            top_indices = top_indices.squeeze(0).cpu().numpy()

            results = []
            for i in range(len(top_probs)):
                label = self.label_encoder.inverse_transform([top_indices[i]])[0]
                results.append({
                    "label": str(label),
                    "confidence": float(top_probs[i])
                })

            return results