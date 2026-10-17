# Daymark Study Planner

A small, browser-only planner that brings classes, assignment deadlines, tests and exams into one course timeline, then schedules study blocks around fixed class times and your daily study-hour limits.

## Run it

Open `index.html` in a modern browser. No installation, build step, account or API key is needed. Your timeline and preferences are stored in that browser's local storage.

## Publish it

This project is ready for GitHub Pages through `.github/workflows/pages.yml`. To publish it, create a public GitHub repository for these files, push the project to its `main` branch, then open **Settings → Pages** and set the source to **GitHub Actions**. The workflow deploys on each push to `main`; its first successful run provides the public URL in the Actions run details. There is no live URL until the project is connected to a GitHub repository. A public repository also makes the source code public; student events and Canvas feed links are not included in the source.

## Use it

- Add classes and assessments with **Add event**.
- Set the daily study limit under **Study hours**.
- Choose **Build my plan** to schedule estimated study time before each deadline. Class events are treated as fixed commitments.
- Switch between timetable and list views, or inspect all source events under **Course timeline**.
- Import a CSV with these headers: `date,type,title,course,startTime,endTime,effortHours`. Dates use `YYYY-MM-DD`; types are `class`, `assignment`, `test`, or `exam`. Classes need start and end times. Other events use an effort estimate in hours.
- Import a Canvas `.ics` file or paste a Canvas Calendar Feed URL from **Import timeline**. Timed events are treated as classes unless their title identifies an assignment, quiz, test or exam. Course names and study estimates may need review after importing.

Calendar files are read locally in your browser. Feed links are fetched directly without credentials and are never saved. Canvas or the browser may block direct feed access with cross-origin rules; if that happens, download the `.ics` file from Canvas and import the file instead. Re-imported feed events are deduplicated. The planner is a first-pass heuristic; review and adjust its sessions to match your workload and preferences.
