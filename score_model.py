import sys
import json
import joblib
import numpy as np
import os

# Load model from script path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'schedule_model.pkl')
model = joblib.load(model_path)

# Read JSON input from stdin
features = json.load(sys.stdin)

# Convert feature values to floats
X = np.array([[
    float(features["num_events"]),
    float(features["avg_duration"]),
    float(features["time_span"]),
    float(features["num_priority_events"])
]])

# Predict and return score
score = float(model.predict(X)[0])
print(json.dumps({ "score": score }))