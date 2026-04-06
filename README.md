# SDPPS

Smart Student Distraction Prediction and Prevention System.

This repository combines a Windows desktop agent, Flask APIs, a React/Vite frontend, a distraction prediction pipeline, a content classifier, and an adaptive planning service.

## What is in this repo

- `desktop_agent/`: Windows runtime that collects desktop activity, scores distraction, and controls blocking.
- `frontend/`: React + Vite dashboard running on port `3000`.
- `auth_server.py`: authentication API on port `5001` backed by `common/users.db`.
- `simulation_server.py`: fake agent API on port `5000` for demos and frontend development.
- `adaptive_planner/`: task planning, productivity profiling, trends, streaks, and saved planner models.
- `content_classification/`: content classifier service and training assets.
- `distraction_prediction/`: data pipeline, feature generation, and saved distraction model artifacts.
- `common/`: shared runtime state such as blocked apps, blocker settings, and the auth database.

## Main runtime

The normal local stack has 3 processes:

1. Auth server: `http://127.0.0.1:5001`
2. Agent API: `http://127.0.0.1:5000`
3. Frontend: `http://127.0.0.1:3000`

There are 2 agent modes:

- Real mode: runs `desktop_agent.agent` and uses the Windows collectors/blocker.
- Simulation mode: runs `simulation_server.py` and serves realistic fake distraction data.

## Quick start

### Windows launcher

The simplest way to run the project on Windows is:

```bat
StartSDPPS.bat
```

Simulation mode:

```bat
StartSDPPS.bat --sim
```

What the launcher does:

- creates `.venv` if needed
- installs `requirements.txt`
- installs `frontend` npm dependencies if missing
- frees ports `5000`, `5001`, and `3000`
- starts auth, agent/simulation, and frontend in separate terminals

## Manual setup

### Prerequisites

- Python `3.10+`
- Node.js + npm
- Windows for the real desktop agent and blocker features

### Python

```powershell
py -3 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Frontend

```powershell
Set-Location frontend
npm install
```

## Manual run commands

### Auth server

```powershell
.venv\Scripts\activate
python auth_server.py
```

### Real desktop agent

```powershell
.venv\Scripts\activate
python -m desktop_agent.agent
```

### Simulation server

```powershell
.venv\Scripts\activate
python simulation_server.py
```

### Frontend

```powershell
Set-Location frontend
npm run dev
```

## Important endpoints

### Auth API

- `GET /auth/health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/verify`

Base URL: `http://127.0.0.1:5001`

### Agent API

- `GET /api/status`
- `GET /api/predict`
- `GET /api/features`
- `GET /api/history`

Base URL: `http://127.0.0.1:5000`

### Content classifier

If you run the classifier service directly:

```powershell
python content_classification\backend.py
```

Key endpoints:

- `GET /api/content/health`
- `POST /api/content/check`

Default URL: `http://127.0.0.1:5000` when run standalone.

## Data and models

- Desktop agent model: `distraction_prediction/models/saved_models/best_model.pt`
- Scaler config: `distraction_prediction/data/processed/windows/scaler_zscore.json`
- Feature columns: `distraction_prediction/data/processed/windows/feature_columns.json`
- Adaptive planner data: `adaptive_planner/data/`
- Shared blocker/auth state: `common/`

## Notes

- The real desktop agent is Windows-specific because it depends on desktop input/process APIs and blocking behavior.
- `common/users.db` and `common/blocker_settings.json` are runtime files and may change during local use.
- The root `package.json` is not the frontend app entry point; use `frontend/package.json`.

## Testing

Run Python tests with:

```powershell
.venv\Scripts\activate
pytest
```
