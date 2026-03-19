# app_categorizer.py
# Stage 1: Keyword-based app category scoring

from __future__ import annotations


# Score 0.0 — clearly productive work
_PRODUCTIVE = [
    # code editors & IDEs
    "code", "vscode", "pycharm", "intellij", "webstorm", "clion",
    "devenv", "visual studio", "eclipse", "netbeans", "androidstudio",
    "sublime", "atom", "vim", "nvim", "emacs", "notepad++",
    "idea64", "idea",
    # office / writing
    "winword", "word", "excel", "powerpnt", "onenote", "outlook",
    "libreoffice", "writer", "calc", "impress",
    # dev tools / terminals
    "powershell", "cmd", "terminal", "bash", "wsl", "git", "putty",
    "windowsterminal", "ssms", "dbeaver", "pgadmin", "mysql workbench",
    "postman", "docker", "jupyter", "anaconda", "spyder",
    # design / creative work
    "figma", "xd", "sketch", "blender", "photoshop", "premiere",
    "aftereffects", "illustrator", "davinci",
    # research / documents
    "zotero", "mendeley", "acrobat", "pdf", "evince", "okular",
    # task management
    "notion", "obsidian", "jira", "trello", "asana",
    # video conferencing (productive context)
    "zoom", "teams", "ms-teams", "meet", "webex", "skype",
    # copilot / AI assistants (productive use)
    "m365copilot", "copilot",
    # snipping / screenshots (work-related)
    "snippingtool",
]

# Score 1.0 — clearly entertainment / distraction
_ENTERTAINMENT = [
    # media players
    "kmplayer", "vlc", "player", "mpv", "wmplayer", "mediaplayer",
    "potplayer", "gom", "mpc-hc", "mpc-be", "mspaint",
    # music
    "spotify", "itunes", "winamp", "foobar", "musicbee",
    # streaming apps (desktop clients)
    "netflix", "primevideo", "disneyplus", "hotstar", "crunchyroll",
    "plex", "kodi", "jellyfin",
    # gaming - general
    "steam", "steamwebhelper", "epicgames", "epicgameslauncher",
    "gog", "uplay", "ubisoft", "origin", "battlenet",
    "eadesktop", "ea desktop", "prismlauncher",
    # gaming - specific games
    "roblox", "minecraft", "javaw",
    "valorant", "valorant-win64-shipping",
    "fortnite", "leagueoflegends", "csgo", "cs2",
    "brawlhalla", "titanfall", "titanfall2",
    "gameoverlayui", "playnite",
    # video / short content
    "youtube", "tiktok", "reels",
]

# Score 0.75 — social / communication (often distracting)
_SOCIAL = [
    "discord", "whatsapp", "telegram", "signal", "viber",
    "instagram", "facebook", "twitter", "snapchat", "reddit",
    "messenger", "line", "wechat", "kakaotalk",
    "slack",
]

# Score 0.5 — browsers (neutral until title is checked)
_BROWSERS = [
    "chrome", "firefox", "edge", "msedge", "opera", "brave",
    "safari", "vivaldi", "arc",
]

# Browser title keywords — entertainment
_BROWSER_ENTERTAINMENT_TITLE = [
    "youtube", "netflix", "prime video", "disney", "hotstar",
    "twitch", "tiktok", "instagram", "facebook", "twitter",
    "reddit", "9gag", "buzzfeed", "reels", "shorts",
    "spotify", "soundcloud",
]

# Browser title keywords — productive
_BROWSER_PRODUCTIVE_TITLE = [
    "github", "gitlab", "stackoverflow", "docs.", "documentation",
    "developer", "api ", "tutorial", "learn", "coursera", "udemy",
    "edx", "leetcode", "hackerrank", "arxiv", "scholar",
    "jira", "confluence", "notion", "figma", "vercel", "aws",
    "azure", "gcp", "console", "dashboard", "localhost",
    "chatgpt", "claude", "gemini",
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
        if title and _matches(title, _BROWSER_ENTERTAINMENT_TITLE):
            return 0.9
        if title and _matches(title, _BROWSER_PRODUCTIVE_TITLE):
            return 0.15
        return 0.5

    return 0.5  # unknown apps get neutral score


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


if __name__ == "__main__":
    test_cases = [
        ("Code.exe", "inference.py - Visual Studio Code"),
        ("KMPlayer.exe", "Movie.mp4"),
        ("chrome.exe", "YouTube - Google Chrome"),
        ("chrome.exe", "GitHub - distraction_prediction"),
        ("chrome.exe", "Gmail"),
        ("Discord.exe", ""),
        ("steam.exe", "Steam"),
        ("WINWORD.EXE", "Report.docx"),
        ("VALORANT-Win64-Shipping.exe", ""),
        ("Brawlhalla.exe", ""),
        ("javaw.exe", "Minecraft"),
        ("Zoom.exe", "Meeting"),
        ("ms-teams.exe", ""),
        ("brave.exe", "ChatGPT"),
        ("msedge.exe", "Reddit"),
        ("idea64.exe", "MyProject"),
        ("UnknownApp.exe", ""),
    ]

    print(f"\n{'App':<35} {'Title':<40} {'Score':>6}  {'Label'}")
    print("-" * 95)
    for app, title in test_cases:
        r = categorize_window(app, title)
        print(f"  {app:<33} {title:<40} {r['app_category']:>6.2f}  {r['category_label']}")
