import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import cv2
from Prediction import HandWashing

# 初始化模型
hand_washing = HandWashing()

# 開啟攝影機
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ 無法讀取 Webcam")
        break

    frame = cv2.flip(frame, 1)

    landmarks = hand_washing.get_landmarks_from_frame(frame)

    if not landmarks or all(value == 0 for value in landmarks):
        text = "No hand detected (0.00%)"
    else:
        predictions = hand_washing.predict_landmarks(landmarks)
        if predictions:
            label = predictions[0]["label"]
            confidence = predictions[0]["confidence"]
            text = f'{label} ({confidence * 100:.2f}%)'
        else:
            text = "No hands detected (0.00%)"

    cv2.putText(frame, text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
    cv2.imshow("Hand Washing Prediction", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
