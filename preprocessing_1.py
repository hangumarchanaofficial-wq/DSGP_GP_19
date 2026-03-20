import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from sklearn.model_selection import train_test_split


def preprocess_data(file_path):
    # Load dataset
    df = pd.read_csv(file_path)

    # Remove unnecessary columns
    df = df.drop(columns=[
        'student_id', 'index', 'major', 'previous_gpa', 'time_management_score',
        'learning_style', 'exam_anxiety_score', 'motivation_level',
        'parental_support_level', 'family_income_range', 'study_environment',
        'semester', 'screen_time', 'social_activity', 'dropout_risk',
        'stress_level', 'access_to_tutoring', 'attendance_percentage',
        'exercise_frequency', 'diet_quality', 'parental_education_level',
        'internet_quality', 'netflix_hours', 'mental_health_rating',
        'extracurricular_participation', 'exam_score'
    ], errors='ignore')

    # Remove duplicates
    df = df.drop_duplicates()

    # ---------------------------
    # Feature Engineering
    # ---------------------------
    df['total_social_hours'] = df['social_media_hours']

    # Normalize key features
    study_norm = df['study_hours_per_day'] / 10
    sleep_norm = df['sleep_hours'] / 10
    social_norm = df['total_social_hours'] / 10
    job_effect = df['part_time_job'].map({'Yes': -0.1, 'No': 0.1}).fillna(0)

    # ---------------------------
    # Target Creation
    # ---------------------------
    prob = (
        0.45 * sleep_norm +         # good sleep helps
        0.25 * (1 - social_norm) -  # less social distraction helps
        0.50 * study_norm +         # more study hours -> more fatigue
        0.10 * job_effect           # part-time job has small influence
    )

    # Add small randomness
    prob = prob + np.random.normal(0, 0.08, len(df))

    # Final target
    df['task_completed'] = (prob > 0.4).astype(int)

    # ---------------------------
    # Feature Selection
    # ---------------------------
    features = [
        'age',
        'gender',
        'part_time_job',
        'study_hours_per_day',
        'sleep_hours',
        'total_social_hours'
    ]

    X = df[features].copy()
    y = df['task_completed'].copy()

    # ---------------------------
    # Encoding
    # ---------------------------
    X = pd.get_dummies(X, columns=['gender', 'part_time_job'], drop_first=True)
    feature_columns = X.columns.tolist()

    # ---------------------------
    # Scaling
    # ---------------------------
    num_cols = ['age', 'study_hours_per_day', 'sleep_hours', 'total_social_hours']
    scaler = StandardScaler()
    X[num_cols] = scaler.fit_transform(X[num_cols])

    # ---------------------------
    # SMOTE
    # ---------------------------
    smote = SMOTE(random_state=42)
    X_bal, y_bal = smote.fit_resample(X, y)

    # ---------------------------
    # Train-Test Split
    # ---------------------------
    X_train_bal, X_test_bal, y_train_bal, y_test_bal = train_test_split(
        X_bal, y_bal,
        test_size=0.2,
        random_state=42,
        stratify=y_bal
    )

    return X_train_bal, X_test_bal, y_train_bal, y_test_bal, scaler, feature_columns