const test = require('node:test')
const assert = require('node:assert/strict')
const {
  CancelledError,
  collectComments,
  normalizeComment,
  parseSongId,
  withRetry,
} = require('../src/netease')

test('parseSongId accepts IDs and common song links', () => {
  assert.equal(parseSongId('186016'), '186016')
  assert.equal(parseSongId('https://music.163.com/song?id=186016'), '186016')
  assert.equal(parseSongId('https://music.163.com/#/song?id=186016'), '186016')
  assert.equal(parseSongId('分享歌曲 https://y.music.163.com/m/song?id=186016'), '186016')
  assert.equal(parseSongId('not a song'), null)
})

test('normalizeComment keeps only export fields', () => {
  assert.deepEqual(normalizeComment({
    commentId: 42,
    content: 'A "quoted" comment',
    user: { nickname: 'tester', userId: 99, avatarUrl: 'private' },
    likedCount: 12,
    replyCount: 3,
    time: Date.UTC(2026, 0, 2, 3, 4),
    timeStr: '1月2日',
  }), {
    id: '42',
    content: 'A "quoted" comment',
    nickname: 'tester',
    likedCount: 12,
    replyCount: 3,
    publishedAt: '2026-01-02T03:04:00.000Z',
    timeText: '1月2日',
  })
})

test('withRetry retries transient failures', async () => {
  let attempts = 0
  const result = await withRetry(async () => {
    attempts += 1
    if (attempts < 3) throw new Error('temporary')
    return 'ok'
  }, { delayFn: async () => {} })

  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
})

test('collectComments follows newest cursor and removes duplicates', async () => {
  const calls = []
  const pages = [
    {
      comments: [comment(1), comment(2)],
      totalCount: 100,
      hasMore: true,
      cursor: 'cursor-2',
    },
    {
      comments: [comment(2), comment(3)],
      totalCount: 100,
      hasMore: true,
      cursor: 'cursor-3',
    },
  ]

  const result = await collectComments({
    songId: '186016',
    count: 3,
    sort: 'newest',
    pageDelayMs: 0,
    delayFn: async () => {},
    fetchPage: async (query) => {
      calls.push(query)
      return { status: 200, body: { code: 200, data: pages[calls.length - 1] } }
    },
  })

  assert.deepEqual(result.comments.map((item) => item.id), ['1', '2', '3'])
  assert.equal(calls[0].cursor, '0')
  assert.equal(calls[1].cursor, 'cursor-2')
  assert.equal(calls[1].pageNo, 2)
})

test('collectComments stops before a request when cancelled', async () => {
  await assert.rejects(
    collectComments({
      songId: '186016',
      count: 10,
      sort: 'recommended',
      shouldCancel: () => true,
      fetchPage: async () => assert.fail('fetchPage should not run'),
    }),
    CancelledError,
  )
})

function comment(id) {
  return {
    commentId: id,
    content: `comment ${id}`,
    user: { nickname: `user ${id}` },
    likedCount: id,
    replyCount: 0,
    time: Date.UTC(2026, 0, id),
    timeStr: `day ${id}`,
  }
}
