# 2026 Masters Pick Scoreboard

Static scoreboard site built for GitHub Pages. No build step, no backend, and all pool data lives in JSON files that are easy to edit.

## What it does

- Shows a pool standings table for your Masters picks
- Shows drafted golfers on an Augusta-style leaderboard
- Calculates pool standings using the best 4 golfers when nobody drafted the Masters winner
- Automatically gives the pool win to any entry that drafted the actual Masters champion
- Lets you import CSV or pasted leaderboard updates in the browser during tournament week
- Can publish refreshed shared data files for GitHub Pages

## Files to edit

- `data/picks.json`: your pool participants and their golfer selections
- `data/leaderboard.json`: current tournament leaderboard
- `data/leaderboard.js`: browser-ready copy of the current tournament leaderboard
- `data/config.json`: event title, dates, and scoring rules

## GitHub Pages setup

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open `Settings` -> `Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose your main branch and `/ (root)`.
6. Save, then wait for the Pages URL to publish.

## Live update workflow

1. Open the site on desktop.
2. Click `Update Data`.
3. Import a CSV or paste leaderboard rows.
4. Click `Publish data files`.
5. Save over:
   - `data/leaderboard.json`
   - `data/leaderboard.js`
6. Run:

```powershell
.\publish-scoreboard.ps1
```

That stages the two leaderboard files, creates a commit, and pushes to your current Git branch.

For a simpler Windows shortcut, you can also double-click:

```text
publish-scoreboard.bat
```

## CSV format

The importer recognizes `PLAYER` plus any of these columns:

- `TEE TIME`
- `POS`
- `TO PAR`
- `TODAY`
- `THRU`
- `STATUS`

Example:

```csv
PLAYER,TEE TIME,POS,TO PAR,TODAY,THRU,STATUS
Rory McIlroy,10:31 AM,1,-11,-3,F,Final
Scottie Scheffler,1:44 PM,T2,-9,-2,F,Final
```
## Leaderboard JSON format

```json
{
  "lastUpdated": "April 10, 2026 at 8:05 PM CT",
  "players": [
    {
      "name": "Scottie Scheffler",
      "position": "1",
      "toPar": "-8",
      "today": "-4",
      "thru": "F",
      "teeTime": "1:44 PM",
      "status": "Round 2",
      "madeCut": true,
      "isChampion": false
    }
  ]
}
```

## Notes

- The included leaderboard is set to a clean pre-tournament state.
- The official 2026 Masters tournament dates are April 9-12, 2026.
- If you want live automatic scoring from a data feed later, we can add a lightweight backend or GitHub Action next.
