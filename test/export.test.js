const test = require('node:test')
const assert = require('node:assert/strict')
const { commentsToCsv, escapeCsv, safeFilename } = require('../src/export')

test('escapeCsv quotes commas, quotes, and line breaks', () => {
  assert.equal(escapeCsv('plain'), 'plain')
  assert.equal(escapeCsv('a,b'), '"a,b"')
  assert.equal(escapeCsv('a"b'), '"a""b"')
  assert.equal(escapeCsv('a\nb'), '"a\nb"')
})

test('commentsToCsv includes a UTF-8 BOM and stable headings', () => {
  const csv = commentsToCsv([{
    id: '1',
    content: '你好,世界',
    nickname: '用户',
    likedCount: 8,
    replyCount: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    timeText: '1月1日',
  }])

  assert.ok(csv.startsWith('\uFEFFcomment_id,content,nickname'))
  assert.match(csv, /"你好,世界"/)
})

test('safeFilename removes filesystem separators', () => {
  assert.equal(safeFilename('a/b:c*?'), 'a-b-c--')
})
