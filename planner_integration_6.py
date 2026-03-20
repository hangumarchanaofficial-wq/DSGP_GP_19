import pandas as pd
from feedback_module_5 import generate_feedback, generate_social_alert


def prepare_input(student_data, scaler, feature_columns):
    input_df = pd.DataFrame([student_data])

    # One-hot encode categorical variables
    input_df = pd.get_dummies(input_df, columns=['gender', 'part_time_job'], drop_first=True)

    # Match training columns exactly
    input_df = input_df.reindex(columns=feature_columns, fill_value=0)

    # Scale numeric columns
    num_cols = ['age', 'study_hours_per_day', 'sleep_hours', 'total_social_hours']
    input_df[num_cols] = scaler.transform(input_df[num_cols])

    return input_df


def find_next_available_slot(schedule):
    for slot in schedule:
        if slot["status"] == "free":
            return slot["time"]
    return "Next Day"


def adaptive_planner(
    student_data,
    schedule,
    scaler,
    feature_columns,
    model,
    missed_count_today=0,
    user_accepts_rest=None
):
    prepared_input = prepare_input(student_data, scaler, feature_columns)

    # Predict using trained model
    p_complete = float(model.predict_proba(prepared_input)[0][1])
    prediction = int(model.predict(prepared_input)[0])

    # Default outputs
    planner_decision = None
    new_slot = None

    # -----------------------------
    # Adaptive scheduling logic
    # -----------------------------
    if p_complete >= 0.60:
        planner_decision = "Continue current task"
        new_slot = None

    elif 0.40 <= p_complete < 0.60:
        planner_decision = "Continue with shorter focus blocks"
        new_slot = None

    else:
        # Low probability: ask the user whether to rest and reschedule
        if user_accepts_rest is True:
            planner_decision = "Reschedule task to next free slot"
            new_slot = find_next_available_slot(schedule)
        elif user_accepts_rest is False:
            planner_decision = "Keep current task with recovery support"
            new_slot = None
        else:
            planner_decision = "Ask user whether to rest and reschedule"
            new_slot = None

    # -----------------------------
    # Feedback generation
    # -----------------------------
    feedback = generate_feedback(
        p_complete=p_complete,
        sleep_hours=student_data["sleep_hours"],
        total_social_hours=student_data["total_social_hours"],
        study_hours=student_data["study_hours_per_day"],
        missed_count_today=missed_count_today,
        user_accepts_rest=user_accepts_rest
    )

    # -----------------------------
    # Social media alert
    # -----------------------------
    social_minutes = student_data.get("total_social_hours", 0) * 60
    social_alert = generate_social_alert(social_minutes)

    return {
        "prediction": prediction,
        "task_completion_probability": round(p_complete, 3),
        "planner_decision": planner_decision,
        "new_slot": new_slot,
        "feedback": feedback,
        "social_alert": social_alert
    }