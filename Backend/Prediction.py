
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
        # 1. Check for empty input or all zeros
        if not landmarks or all(v == 0 for v in landmarks):
            return [{"label": "No hands detected", "confidence": 0.0}]

        # 2. Convert and Normalize
        landmarks_array = np.array(landmarks)
        max_val = np.max(np.abs(landmarks_array))

        if max_val > 0:
            landmarks_array = landmarks_array / max_val
        else:
            return [{"label": "No hands detected", "confidence": 0.0}]

        # 3. Predict
        landmarks_tensor = torch.tensor(landmarks_array, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(landmarks_tensor)
            probs = torch.softmax(outputs, dim=1)

            top_probs, top_indices = torch.topk(probs, 3, dim=1)
            top_probs = top_probs.squeeze(0).cpu().numpy()
            top_indices = top_indices.squeeze(0).cpu().numpy()

            return [
                {"label": str(self.label_encoder.inverse_transform([idx])[0]), "confidence": float(p)}
                for p, idx in zip(top_probs, top_indices)
            ]