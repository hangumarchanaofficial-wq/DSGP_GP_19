# SDPPS

Smart Student Distraction Prediction and Prevention System.

## Desktop app

Existing PySide desktop app lives in `sdpps_app/`.

## New web stack

A new web implementation is available in `web/`:

- `web/backend` - Flask API (reuses existing SQLite + services)
- `web/frontend` - React app (login, analytics, settings)

See `web/README.md` for run steps.
