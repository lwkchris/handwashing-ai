from pathlib import Path
import cv2
import torch
import numpy as np
import mediapipe as mp
from joblib import load
from Training.model import CNNModel


class HandWashing:
    """
    - Model input: expects 126 features (21 landmarks × 3 coords × 2 hands)
    - Model output: class probabilities, decoded with label_encoder
    """

    def __init__(self):
        # Base directory = where this file (Prediction.py) is located
        base_dir = Path(__file__).resolve().parent

        # Paths to the model and label encoder
        self.model_path = base_dir / "Training" / "model_dir" / "cnn_asl_model.pth"
        self.encoder_path = base_dir / "Training" / "model_dir" / "cnn_label_encoder.joblib"

        # Device (GPU if available, otherwise CPU)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize the CNN model
        self.model = CNNModel(input_size=21 * 3 * 2, num_classes=7)
        state = torch.load(str(self.model_path), map_location=self.device)
        # strict=False allows loading even if some layer names don’t exactly match
        self.model.load_state_dict(state, strict=False)
        self.model.to(self.device)
        self.model.eval()

        # Load label encoder
        self.label_encoder = load(self.encoder_path)

        # MediaPipe Hands instance (used only in get_landmarks_from_frame)
        self.mp_hands = mp.solutions.hands

    # ---------- (Optional) Extract landmarks from a video frame (for testing on server with webcam) ----------
    def get_landmarks_from_frame(self, frame):
        """
        Extract up to 2 hands with 21 landmarks each using MediaPipe.
        Returns a flattened vector of length 126. If no hands, return None.
        """
        with self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.4,
            min_tracking_confidence=0.4
        ) as hands:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)

            # Initialize zero vector (2 hands × 21 points × 3 coords = 126)
            vec = [0.0] * (21 * 3 * 2)

            if results.multi_hand_landmarks:
                for h_idx, hand_lms in enumerate(results.multi_hand_landmarks[:2]):
                    for i, lm in enumerate(hand_lms.landmark):
                        start = h_idx * 21 * 3 + i * 3
                        vec[start:start + 3] = [lm.x, lm.y, lm.z]

                # Normalize values (simple max normalization)
                arr = np.asarray(vec, dtype=np.float32)
                m = np.max(np.abs(arr))
                if m > 0:
                    arr = arr / m
                return arr.tolist()

            return None

    # ---------- Helper: ensure input is always 126-dim ----------
    def _ensure_126d(self, arr_like):
        """
        Convert input to a 126-length float32 array:
        - If nested [[x,y,z], ...], flatten it
        - Pad with zeros if shorter, cut if longer
        """
        a = np.asarray(arr_like, dtype=np.float32)
        if a.ndim > 1:
            a = a.reshape(-1)

        target = 21 * 3 * 2  # 126 features
        if a.size < target:
            out = np.zeros(target, dtype=np.float32)
            out[:a.size] = a
            a = out
        elif a.size > target:
            a = a[:target]

        # Normalize (must match training preprocessing!)
        m = np.max(np.abs(a))
        if m > 0:
            a = a / m

        return a

    # ---------- Route 2: prediction directly from frontend landmarks ----------
    def predict_vector(self, arr_like):
        """
        Entry point for Route 2: take landmarks (from frontend JSON) and classify.
        Returns a single {"label": "...", "confidence": 0.xx}
        """
        feat = self._ensure_126d(arr_like)
        x = torch.from_numpy(feat).unsqueeze(0).to(self.device)  # shape [1,126]

        with torch.no_grad():
            logits = self.model(x)
            prob = torch.softmax(logits, dim=1)[0]
            conf, cls = torch.max(prob, dim=0)

        label = self.label_encoder.inverse_transform([int(cls.item())])[0]
        return {"label": label, "confidence": float(conf.item())}

    # ---------- Original method (top-3 predictions) ----------
    def predict_landmarks(self, landmarks):
        """
        Old interface for backward compatibility.
        Input: landmarks (list of 126 or nested list)
        Output: top-3 predictions [{"label": "...", "confidence": ...}, ...]
        """
        feat = self._ensure_126d(landmarks)
        x = torch.from_numpy(feat).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(x)
            probabilities = torch.softmax(outputs, dim=1)

            top_probs, top_indices = torch.topk(probabilities, 3, dim=1)
            top_probs = top_probs.squeeze(0).cpu().numpy()
            top_indices = top_indices.squeeze(0).cpu().numpy()

        return [
            {
                "label": self.label_encoder.inverse_transform([int(index)])[0],
                "confidence": float(prob)
            }
            for index, prob in zip(top_indices, top_probs)
        ]
