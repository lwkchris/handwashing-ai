import torch
import numpy as np
from joblib import load
from model import FNNModel

class HandWashing:
    def __init__(self):
        MODEL_PATH = r"../Training/model_dir/fnn_model.pth"
        ENCODER_PATH = r"../Training/model_dir/fnn_label_encoder.joblib"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize model
        self.model = FNNModel(input_size=126, num_classes=7)
        self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device), strict=False)
        self.model.to(self.device)
        self.model.eval()

        self.label_encoder = load(ENCODER_PATH)

    def predict_landmarks(self, landmarks):
        # Check if landmarks are valid
        if not landmarks or all(v == 0 for v in landmarks):
            return [{"label": "No hands detected", "confidence": 0.0}]

        # Convert to numpy and check scale
        landmarks_array = np.array(landmarks)
        max_val = np.max(np.abs(landmarks_array))

        # If the points are too close to zero (no hand structure), reject it
        if max_val < 1e-5:
            return [{"label": "No hands detected", "confidence": 0.0}]

        # Normalize landmarks
        landmarks_array = landmarks_array / max_val

        # Convert to tensor for FNN
        landmarks_tensor = torch.tensor(landmarks_array, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(landmarks_tensor)
            probs = torch.softmax(outputs, dim=1)

            top_probs, top_indices = torch.topk(probs, 3, dim=1)

            # Convert index back to "Step X" label
            return [
                {
                    "label": self.label_encoder.inverse_transform([idx.item()])[0],
                    "confidence": float(prob.item())
                }
                for prob, idx in zip(top_probs[0], top_indices[0])
            ]