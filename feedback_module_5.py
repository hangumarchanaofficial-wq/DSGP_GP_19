import random
from datetime import datetime

FEEDBACK_MESSAGES = {
    "continue_encourage": [
        "You’re doing well. Keep going with the current task.",
        "Great focus so far — continue this task steadily.",
        "You are likely to finish this task. Stay consistent."
    ],
    "continue_support": [
        "You can still complete this task. Try a shorter focus session.",
        "Keep the task for now, but work in smaller steps.",
        "You’re close — stay with the task and reduce distractions."
    ],
    "offer_rest": [
        "Your completion chance looks low right now. Would you like to take a short rest and move this task to the next free slot?",
        "You seem a bit tired. Would you like to rest first and reschedule this task?",
        "It may be better to pause now. Would you like to move this task to a later free slot?"
    ],
    "reschedule_confirmed": [
        "The task has been moved to the next free slot. Take a short rest and continue later.",
        "Your schedule has been updated. Use this time to recover and restart with better focus.",
        "The task was rescheduled successfully. Come back with fresh energy."
    ],
    "recovery": [
        "Your energy seems low today. Try a lighter task and take a short break.",
        "Sleep looks a bit low — start with a smaller task and recover your rhythm.",
        "A short reset may help. Continue with an easier task first."
    ],
    "missed_support": [
        "No worries — the missed task can be moved to the next available slot.",
        "You missed a slot, so the plan can be adjusted to keep it manageable.",
        "It’s okay to miss sometimes — the task can be rescheduled smoothly."
    ],
    "refocus": [
        "Try reducing distractions and focus on one short task first.",
        "A quick reset may help — complete one focused block now.",
        "Close distractions for a while and continue with a smaller goal."
    ],
    "praise": [
        "Good job — your productivity looks strong right now.",
        "You’re on track. Keep following the current plan.",
        "Your current pattern looks productive — continue as planned."
    ],
    "encourage": [
        "You’re doing okay. Keep working steadily on the next task.",
        "Small progress matters — continue with the next step.",
        "Stay consistent and complete one task at a time."
    ],
    "social_alert": [
    "You have spent 15 minutes on social media. Please return to your task.",
    "Your social media usage is increasing. Try to refocus on your current task.",
    "You have been distracted for a while. It is time to continue your study task."
]
}

SUGGESTED_ACTIONS = {
    "continue_encourage": "Continue current task",
    "continue_support": "Continue with shorter focus blocks",
    "offer_rest": "Ask user whether to rest and reschedule",
    "reschedule_confirmed": "Task moved to next free slot",
    "recovery": "Switch to a lighter task",
    "missed_support": "Reschedule task to next available slot",
    "refocus": "Start a short focus session",
    "praise": "Continue with the current task",
    "encourage": "Proceed with the next planned task",
    "social_alert": "Return to the current task"
}


def choose_feedback_type(
    p_complete,
    sleep_hours,
    total_social_hours,
    study_hours,
    missed_count_today=0,
    user_accepts_rest=None
):
    # If user already accepted rest, confirm reschedule
    if user_accepts_rest is True:
        return "reschedule_confirmed"

    # Missed tasks
    if missed_count_today >= 1:
        return "missed_support"

    # Very low probability → ask for rest and reschedule
    if p_complete < 0.4:
        return "offer_rest"

    # Low sleep or too much study → recovery
    if sleep_hours < 6 or study_hours >= 6:
        return "recovery"

    # High distraction + low-medium probability → refocus
    if p_complete < 0.5 and total_social_hours >= 4:
        return "refocus"

    # High probability → keep encouraging
    if p_complete >= 0.75:
        return "continue_encourage"

    # Medium probability → continue with support
    if 0.5 <= p_complete < 0.75:
        return "continue_support"

    return "encourage"


def generate_feedback(
    p_complete,
    sleep_hours,
    total_social_hours,
    study_hours,
    missed_count_today=0,
    user_accepts_rest=None
):
    feedback_type = choose_feedback_type(
        p_complete=p_complete,
        sleep_hours=sleep_hours,
        total_social_hours=total_social_hours,
        study_hours=study_hours,
        missed_count_today=missed_count_today,
        user_accepts_rest=user_accepts_rest
    )

    message = random.choice(FEEDBACK_MESSAGES[feedback_type])

    return {
        "feedback_type": feedback_type,
        "message": message,
        "suggested_action": SUGGESTED_ACTIONS[feedback_type],
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }



def generate_social_alert(social_media_minutes):
    alert_count = int(social_media_minutes // 15)

    if alert_count >= 1:
        message = random.choice(FEEDBACK_MESSAGES["social_alert"])
        return {
            "feedback_type": "social_alert",
            "message": message.replace("15 minutes", f"{round(social_media_minutes, 1)} minutes"),
            "suggested_action": SUGGESTED_ACTIONS["social_alert"],
            "alert_count": alert_count
        }
    return None

def check_social_media_alert(social_media_minutes):
    if social_media_minutes >= 15:
        return social_media_minutes // 15
    return 0