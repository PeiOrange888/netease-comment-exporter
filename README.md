# NetEase Comment Exporter

Local web tool for collecting public NetEase Cloud Music song comments and exporting them as CSV or JSON.

This is an unofficial project. It uses a third-party implementation of NetEase Cloud Music's non-public interfaces, which may change without notice. Collect only public comments, keep request volume reasonable, and follow applicable platform terms and privacy requirements.

## Requirements

- Node.js 22 or newer

## Run

```bash
npm install
npm start
```

Open `http://127.0.0.1:4317`.

## Data handling

- The server binds to localhost by default.
- No account password or Cookie is required for public comments.
- Jobs are kept in memory and expire automatically.
- CSV exports contain a UTF-8 BOM for spreadsheet compatibility.
