# 2026 Masters Pick Scoreboard

Static scoreboard site built for GitHub Pages. No build step, no backend, and all pool data lives in JSON files that are easy to edit.

## What it does

- Shows a pool standings table for your Masters picks
- Tracks each participant's golfers in card view
- Calculates scores using the best 4 of 6 golfers
- Applies configurable bonus strokes for champion, top 10 finishes, and made cuts
- Lets you paste updated leaderboard JSON into the browser for quick event-week refreshes

## Files to edit

- `data/picks.json`: your pool participants and their golfer selections
- `data/leaderboard.json`: current tournament leaderboard
- `data/config.json`: event title, dates, and scoring rules

## GitHub Pages setup

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open `Settings` -> `Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose your main branch and `/ (root)`.
6. Save, then wait for the Pages URL to publish.

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
      "status": "Round 2",
      "madeCut": true,
      "isChampion": false
    }
  ]
}
```

## Notes

- The included picks and leaderboard are sample data.
- The official 2026 Masters tournament dates are April 9-12, 2026.
- If you want live automatic scoring from a data feed later, we can add a lightweight backend or GitHub Action next.
