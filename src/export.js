const CSV_COLUMNS = [
  ['comment_id', 'id'],
  ['content', 'content'],
  ['nickname', 'nickname'],
  ['liked_count', 'likedCount'],
  ['reply_count', 'replyCount'],
  ['published_at', 'publishedAt'],
  ['time_text', 'timeText'],
]

function escapeCsv(value) {
  const text = String(value ?? '')
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function commentsToCsv(comments) {
  const rows = [CSV_COLUMNS.map(([heading]) => heading).join(',')]

  for (const comment of comments) {
    rows.push(
      CSV_COLUMNS
        .map(([, key]) => escapeCsv(comment[key]))
        .join(','),
    )
  }

  return `\uFEFF${rows.join('\r\n')}\r\n`
}

function createJsonExport(job) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    song: job.song,
    sort: job.sort,
    requestedCount: job.requestedCount,
    exportedCount: job.comments.length,
    totalAvailable: job.totalAvailable,
    comments: job.comments,
  }, null, 2)
}

function safeFilename(value) {
  const name = String(value || 'comments')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return name.slice(0, 80) || 'comments'
}

module.exports = {
  commentsToCsv,
  createJsonExport,
  escapeCsv,
  safeFilename,
}
