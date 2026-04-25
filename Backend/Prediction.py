import cv2
import torch
import numpy as np
import mediapipe as mp
from joblib import load
<<<<<<< HEAD
<<<<<<< HEAD
from Training.model import CNNModel
=======
from model import FNNModel  # Ensure this matches your directory structure
=======
from model import FNNModel
>>>>>>> acee8dde8fad2186bfc3c9076a90a7c02d813cbc

>>>>>>> 4fbf3726b7c727edb5d8b3d053f8684d222b38f3

class HandWashing:
    def __init__(self):
<<<<<<< HEAD
        # Paths to the model and label encoder
        MODEL_PATH = r"../Training/model_dir/cnn_asl_model.pth"
        ENCODER_PATH = r"../Training/model_dir/cnn_label_encoder.joblib"

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

<<<<<<< HEAD
        # Initialize the CNN model
        self.model = CNNModel(input_size=21 * 3 * 2, num_classes=7)
        self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
=======
        # Initialize the model
        # Input size: 21 landmarks * 3 coordinates (x,y,z) * 2 hands = 126
        self.model = FNNModel(input_size=126, num_classes=7)

        # Load weights
        try:
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
            print(f"Model loaded successfully on {self.device}")
        except Exception as e:
            print(f"Error loading model: {e}")

>>>>>>> 4fbf3726b7c727edb5d8b3d053f8684d222b38f3
=======
        MODEL_PATH = r"../Training/model_dir/fnn_model.pth"
        ENCODER_PATH = r"../Training/model_dir/fnn_label_encoder.joblib"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Input size is 126 (21 points * 3 dims * 2 hands)
        self.model = FNNModel(input_size=126, num_classes=7)
        self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
>>>>>>> acee8dde8fad2186bfc3c9076a90a7c02d813cbc
        self.model.to(self.device)
        self.model.eval()

        self.label_encoder = load(ENCODER_PATH)

<<<<<<< HEAD
        # MediaPipe Hands instance
        self.mp_hands = mp.solutions.hands

    def get_landmarks_from_frame(self, frame):
        """Extract hand landmarks from the video frame using MediaPipe."""
<<<<<<< HEAD
        with self.mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.25, min_tracking_confidence=0.25) as hands:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)
=======
        with self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.25,
                min_tracking_confidence=0.2
        ) as hands:
            # Convert BGR to RGB
            results = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
>>>>>>> 4fbf3726b7c727edb5d8b3d053f8684d222b38f3

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

=======
>>>>>>> acee8dde8fad2186bfc3c9076a90a7c02d813cbc
    def predict_landmarks(self, landmarks):
        # Double-check guard for safety
        if not landmarks or all(value == 0 for value in landmarks):
            return [{"label": "No hands detected", "confidence": 0.0}]

        # Normalization
        landmarks_array = np.array(landmarks)
        max_val = np.max(np.abs(landmarks_array))
        if max_val > 0:
            landmarks_array = landmarks_array / max_val

        landmarks_tensor = torch.tensor(landmarks_array, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(landmarks_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            top_probs, top_indices = torch.topk(probabilities, 3, dim=1)

            top_probs = top_probs.squeeze(0).cpu().numpy()
            top_indices = top_indices.squeeze(0).cpu().numpy()

            return [
                {"label": str(self.label_encoder.inverse_transform([idx])[0]), "confidence": float(prob)}
                for prob, idx in zip(top_probs, top_indices)
            ]