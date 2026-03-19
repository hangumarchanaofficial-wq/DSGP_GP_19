"""
app_categorizer.py — Keyword-based app/window category scoring (v2)
Used by predictor.py to blend BiLSTM + app context
Now with expanded browser title detection for academic content.
"""

from __future__ import annotations

_PRODUCTIVE = [
    "code", "vscode", "pycharm", "intellij", "webstorm", "clion",
    "devenv", "visual studio", "eclipse", "netbeans", "androidstudio",
    "sublime", "atom", "vim", "nvim", "emacs", "notepad++",
    "idea64", "idea",
    "winword", "word", "excel", "powerpnt", "onenote", "outlook",
    "libreoffice", "writer", "calc", "impress",
    "powershell", "cmd", "terminal", "bash", "wsl", "git", "putty",
    "windowsterminal", "ssms", "dbeaver", "pgadmin", "mysql workbench",
    "postman", "docker", "jupyter", "anaconda", "spyder",
    "figma", "xd", "sketch", "blender", "photoshop", "premiere",
    "aftereffects", "illustrator", "davinci",
    "zotero", "mendeley", "acrobat", "pdf", "evince", "okular",
    "notion", "obsidian", "jira", "trello", "asana",
    "zoom", "teams", "ms-teams", "meet", "webex", "skype",
    "m365copilot", "copilot", "snippingtool",
]

_ENTERTAINMENT = [
    "kmplayer", "vlc", "player", "mpv", "wmplayer", "mediaplayer",
    "potplayer", "gom", "mpc-hc", "mpc-be", "mspaint",
    "spotify", "itunes", "winamp", "foobar", "musicbee",
    "netflix", "primevideo", "disneyplus", "hotstar", "crunchyroll",
    "plex", "kodi", "jellyfin",
    "steam", "steamwebhelper", "epicgames", "epicgameslauncher",
    "gog", "uplay", "ubisoft", "origin", "battlenet",
    "eadesktop", "ea desktop", "prismlauncher",
    "roblox", "minecraft", "javaw",
    "valorant", "valorant-win64-shipping",
    "fortnite", "leagueoflegends", "csgo", "cs2",
    "brawlhalla", "titanfall", "titanfall2",
    "gameoverlayui", "playnite",
    "youtube", "tiktok", "reels",
]

_SOCIAL = [
    "discord", "whatsapp", "telegram", "signal", "viber",
    "instagram", "facebook", "twitter", "snapchat", "reddit",
    "messenger", "line", "wechat", "kakaotalk", "slack",
]

_BROWSERS = [
    "chrome", "firefox", "edge", "msedge", "opera", "brave",
    "safari", "vivaldi", "arc",
]

_BROWSER_ENTERTAINMENT_TITLE = [
    "youtube", "netflix", "prime video", "disney", "hotstar",
    "twitch", "tiktok", "instagram", "facebook", "twitter",
    "reddit", "9gag", "buzzfeed", "reels", "shorts",
    "spotify", "soundcloud",
]

_BROWSER_PRODUCTIVE_TITLE = [
    # Developer / coding
    "github", "gitlab", "stackoverflow", "docs.", "documentation",
    "developer", "api ", "tutorial", "learn",
    # Academic / learning platforms
    "coursera", "udemy", "edx", "leetcode", "hackerrank",
    "arxiv", "scholar", "researchgate", "sciencedirect",
    "ieee", "springer", "wiley", "elsevier", "jstor",
    # Project management / tools
    "jira", "confluence", "notion", "figma", "vercel", "aws",
    "azure", "gcp", "console", "dashboard", "localhost",
    # AI assistants
    "chatgpt", "claude", "gemini", "copilot",
    # Documents / academic content in browser
    ".pdf", "pdf -", ".docx", ".xlsx", ".pptx",
    "document", "assignment", "coursework", "homework",
    "lecture", "syllabus", "research", "paper", "thesis",
    "slide", "presentation", "report",
    # Google productivity
    "google docs", "google sheets", "google slides",
    "google drive", "google classroom", "google scholar",
    # Office online
    "word online", "excel online", "powerpoint online",
    "office.com", "onedrive", "sharepoint",
    # Other academic / productivity
    "overleaf", "latex", "grammarly", "turnitin",
    "canvas", "moodle", "blackboard", "brightspace",
    "piazza", "gradescope", "edstem",
    "w3schools", "mdn web docs", "geeksforgeeks",
    "kaggle", "colab", "notebook",
]


def _matches(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def categorize_app(app_name: str, window_title: str = "") -> float:
    name = app_name.lower().replace(".exe", "").replace(" ", "")
    title = window_title.lower()

    if _matches(name, _PRODUCTIVE):
        return 0.0
    if _matches(name, _ENTERTAINMENT):
        return 1.0
    if _matches(name, _SOCIAL):
        return 0.75
    if _matches(name, _BROWSERS):
        # Check entertainment FIRST (higher priority for mixed signals)
        if title and _matches(title, _BROWSER_ENTERTAINMENT_TITLE):
            # But if title ALSO matches productive, prefer productive
            # e.g. "YouTube - Python Tutorial" should be productive
            if _matches(title, _BROWSER_PRODUCTIVE_TITLE):
                return 0.25
            return 0.9
        if title and _matches(title, _BROWSER_PRODUCTIVE_TITLE):
            return 0.15
        return 0.5
    return 0.5


def categorize_window(app_name: str, window_title: str = "") -> dict:
    score = categorize_app(app_name, window_title)
    if score <= 0.1:
        label = "productive"
    elif score <= 0.3:
        label = "mostly-productive"
    elif score <= 0.6:
        label = "neutral"
    elif score <= 0.8:
        label = "social/distracting"
    else:
        label = "entertainment"
    return {
        "app_name": app_name,
        "window_title": window_title,
        "app_category": round(score, 3),
        "category_label": label,
    }


def window_category_score(app_names: list[str],
                          window_titles: list[str] | None = None) -> float:
    if window_titles is None:
        window_titles = [""] * len(app_names)
    scores = [categorize_app(a, t) for a, t in zip(app_names, window_titles)]
    return round(sum(scores) / len(scores), 4) if scores else 0.5
