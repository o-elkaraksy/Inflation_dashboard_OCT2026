# Egypt CPI Inflation Dashboard

A responsive static dashboard that fetches the CPI CSV directly from GitHub.

## Files
- `index.html` — structure and external library imports
- `style.css` — responsive design and styling
- `script.js` — data loading, CPI calculations, cards and charts

## Run locally
Because browsers can restrict fetching remote data from a file opened with `file://`, use a local static server, for example:
- VS Code: install/use Live Server and open `index.html`
- Python: run `python -m http.server 8000` in this folder, then open `http://localhost:8000`

## Publish with GitHub Pages
Upload these three files to the same repository as the CSV, then enable Pages in repository Settings → Pages. The dashboard uses this public CSV URL:
`https://raw.githubusercontent.com/o-elkaraksy/Inflation_dashboard_OCT2026/refs/heads/main/dashboard_data.csv`

## Data assumptions
- CSV columns are expected in this order: `category family`, `Category`, `Weights Rebased`, followed by monthly columns named like `Jan-21`.
- `category family` values should follow the existing hierarchy convention: `main category 1`, `sub category 1.1`, `sub item 1.1`, etc.
- The latest month is detected from the final parseable monthly column.
- YoY and MoM are calculated from CPI index points.
- Contributions are weight-based analytical allocations reconciled to the relevant aggregate. They are not official contribution decompositions. For publication-grade exact decomposition, verify the national CPI aggregation methodology and source weights first.
- The first version uses a slide-over/modal historical panel rather than a new tab, for a better mobile experience.

## Monthly update
Add the next month column to the CSV, preserve the first three metadata columns and category hierarchy, commit the file, then refresh the dashboard. No source observations are hardcoded in JavaScript.
