const {
  comment_new: commentNew,
  song_detail: songDetail,
} = require('@neteasecloudmusicapienhanced/api')

const SORT_TYPES = Object.freeze({
  recommended: 99,
  hot: 2,
  newest: 3,
})

class CancelledError extends Error {
  constructor() {
    super('Collection cancelled')
    this.name = 'CancelledError'
  }
}

function parseSongId(input) {
  const value = String(input || '').trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return value

  const patterns = [
    /(?:song\?[^\s#]*?\bid=|song\/)(\d+)/i,
    /[#?&]\s*id=(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match) return match[1]
  }

  return null
}

async function getSong(songId) {
  const result = await songDetail({ ids: String(songId) })
  const body = result.body || {}
  const song = body.songs?.[0]

  if (result.status !== 200 || body.code !== 200 || !song) {
    throw new Error('Song not found or unavailable')
  }

  return {
    id: String(song.id),
    name: song.name,
    artists: (song.ar || []).map((artist) => artist.name).filter(Boolean),
    album: song.al?.name || '',
    coverUrl: song.al?.picUrl ? song.al.picUrl.replace(/^http:/, 'https:') : '',
    durationMs: song.dt || 0,
    sourceUrl: `https://music.163.com/song?id=${song.id}`,
  }
}

function normalizeComment(comment) {
  const timestamp = Number(comment.time)
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : null

  return {
    id: String(comment.commentId),
    content: String(comment.content || ''),
    nickname: String(comment.user?.nickname || ''),
    likedCount: Number(comment.likedCount) || 0,
    replyCount: Number(comment.replyCount) || comment.beReplied?.length || 0,
    publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
    timeText: String(comment.timeStr || ''),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry(operation, options = {}) {
  const retries = options.retries ?? 3
  const delayFn = options.delayFn || sleep
  let lastError

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await delayFn(Math.min(800 * (2 ** attempt), 3200))
    }
  }

  throw lastError
}

async function collectComments(options) {
  const {
    songId,
    count,
    sort,
    onBatch = () => {},
    onProgress = () => {},
    shouldCancel = () => false,
    fetchPage = commentNew,
    delayFn = sleep,
    pageDelayMs = 550,
  } = options

  const sortType = SORT_TYPES[sort]
  if (!sortType) throw new Error('Unsupported comment sort')

  const targetCount = Math.max(1, Math.min(Number(count) || 1, 5000))
  const pageSize = Math.min(50, targetCount)
  const comments = []
  const seen = new Set()
  let pageNo = 1
  let cursor = '0'
  let hasMore = true
  let totalAvailable = null
  let stagnantPages = 0

  while (comments.length < targetCount && hasMore && pageNo <= 300) {
    if (shouldCancel()) throw new CancelledError()

    const result = await withRetry(
      () => fetchPage({
        id: String(songId),
        type: 0,
        pageNo,
        pageSize,
        sortType,
        ...(sortType === 3 ? { cursor } : {}),
      }),
      { delayFn },
    )

    const body = result.body || {}
    const data = body.data || {}
    if (result.status !== 200 || body.code !== 200) {
      throw new Error(`Comment API returned code ${body.code || result.status || 'unknown'}`)
    }

    const batch = []
    for (const rawComment of data.comments || []) {
      const comment = normalizeComment(rawComment)
      if (!comment.id || seen.has(comment.id)) continue
      seen.add(comment.id)
      comments.push(comment)
      batch.push(comment)
      if (comments.length >= targetCount) break
    }

    totalAvailable = Number(data.totalCount) || totalAvailable
    hasMore = Boolean(data.hasMore)
    cursor = String(data.cursor || cursor)
    stagnantPages = batch.length === 0 ? stagnantPages + 1 : 0

    if (batch.length > 0) onBatch(batch)
    onProgress({
      collected: comments.length,
      requested: targetCount,
      totalAvailable,
      page: pageNo,
      hasMore,
    })

    if (stagnantPages >= 2) break
    pageNo += 1

    if (comments.length < targetCount && hasMore) {
      await delayFn(pageDelayMs)
    }
  }

  return {
    comments,
    requested: targetCount,
    totalAvailable,
    hasMore,
    pagesFetched: pageNo,
  }
}

module.exports = {
  CancelledError,
  SORT_TYPES,
  collectComments,
  getSong,
  normalizeComment,
  parseSongId,
  withRetry,
}
