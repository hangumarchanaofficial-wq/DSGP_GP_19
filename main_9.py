import json
import joblib
from planner_integration_6 import adaptive_planner


def create_student_input(age, gender, part_time_job, study_hours, night_sleep, day_sleep, social_hours):
    total_sleep = night_sleep + day_sleep

    # Input validation
    if total_sleep < 0 or total_sleep > 24:
        raise ValueError("Total sleep hours must be between 0 and 24.")

    if study_hours < 0 or social_hours < 0:
        raise ValueError("Study hours and social hours cannot be negative.")

    return {
        "age": age,
        "gender": gender,
        "part_time_job": part_time_job,
        "study_hours_per_day": study_hours,
        "sleep_hours": total_sleep,
        "total_social_hours": social_hours
    }


def main():
    # Load saved model artifacts
    model = joblib.load("adaptive_planner_model.pkl")
    scaler = joblib.load("scaler.pkl")
    feature_columns = joblib.load("feature_columns.pkl")

    # Example student input
    student_data = create_student_input(
        age=15,
        gender="Female",
        part_time_job="Yes",
        study_hours=2,
        night_sleep=8,
        day_sleep=1,
        social_hours=1
    )

    # Example schedule
    schedule = [
        {"time": "4-5 PM", "status": "occupied"},
        {"time": "6-7 PM", "status": "free"},
        {"time": "8-9 PM", "status": "free"}
    ]

    # Run adaptive planner
    result = adaptive_planner(
        student_data=student_data,
        schedule=schedule,
        scaler=scaler,
        feature_columns=feature_columns,
        model=model,
        missed_count_today=0,
        user_accepts_rest=None
    )

    # JSON output only
    print(json.dumps(result, indent=4))


if __name__ == "__main__":
    main()