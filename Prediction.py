from pathlib import Path
import cv2
import torch
import numpy as np
import mediapipe as mp
from joblib import load
from Training.model import CNNModel

class HandWashing:
    def __init__(self):
        # Paths to the model and label encoder
        MODEL_PATH = r"../Training/model_dir/cnn_asl_model.pth"
        ENCODER_PATH = r"../Training/model_dir/cnn_label_encoder.joblib"

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize the CNN model
        self.model = CNNModel(input_size=21 * 3 * 2, num_classes=7)
        self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
        self.model.to(self.device)
        self.model.eval()

        # Load the label encoder
        self.label_encoder = load(ENCODER_PATH)

        # MediaPipe Hands instance
        self.mp_hands = mp.solutions.hands

    def get_landmarks_from_frame(self, frame):
        """Extract hand landmarks from the video frame using MediaPipe."""
        with self.mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.4) as hands:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)

            # Initialize landmarks vector (21 landmarks × 3 coordinates × 2 hands = 126)
            landmarks = [0] * (21 * 3 * 2)
            if results.multi_hand_landmarks:
                for hand_index, hand_landmarks in enumerate(results.multi_hand_landmarks):
                    if hand_index >= 2:  # Process up to 2 hands
                        break
                    for i, landmark in enumerate(hand_landmarks.landmark):
                        start_idx = hand_index * 21 * 3 + i * 3
                        landmarks[start_idx:start_idx + 3] = [landmark.x, landmark.y, landmark.z]

                # Normalize landmarks
                landmarks = np.array(landmarks)
                if np.max(landmarks) > 0:
                    landmarks = landmarks / np.max(landmarks)

                return landmarks.tolist()
        return None

    def predict_landmarks(self, landmarks):
        """Predict the top 3 confidence levels for the given landmarks."""
        if not landmarks or all(value == 0 for value in landmarks):
            return [{"label": "No hands detected", "confidence": 0.0}]

        # Convert landmarks to tensor for model input
        landmarks_tensor = torch.tensor(landmarks, dtype=torch.float32).unsqueeze(0).to(self.device)

        # Inferencing
        with torch.no_grad():
            outputs = self.model(landmarks_tensor)
            probabilities = torch.softmax(outputs, dim=1)

            # Extract top-3 predictions with confidence
            top_probs, top_indices = torch.topk(probabilities, 3, dim=1)
            top_probs = top_probs.squeeze(0).cpu().numpy()
            top_indices = top_indices.squeeze(0).cpu().numpy()

            return [
                {"label": self.label_encoder.inverse_transform([index])[0], "confidence": float(prob)}
                for index, prob in zip(top_indices, top_probs)
            ]