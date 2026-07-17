const path = require('node:path')
const express = require('express')
const { commentsToCsv, createJsonExport, safeFilename } = require('./export')
const { JobManager } = require('./jobs')
const { collectComments, getSong, parseSongId, SORT_TYPES } = require('./netease')

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT) || 4317
const publicDir = path.join(__dirname, '..', 'public')
const iconDir = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons')

const app = express()
const jobs = new JobManager({ collector: collectComments })

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))
app.use('/icons', express.static(iconDir, { maxAge: '7d', immutable: true }))
app.use(express.static(publicDir))

app.get('/api/health', (request, response) => {
  response.json({ ok: true })
})

app.get('/api/song', async (request, response, next) => {
  try {
    const songId = parseSongId(request.query.input)
    if (!songId) {
      return response.status(400).json({ error: '请输入有效的歌曲链接或歌曲 ID' })
    }

    const song = await getSong(songId)
    return response.json({ song })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/jobs', async (request, response, next) => {
  try {
    const songId = parseSongId(request.body.songId)
    const sort = String(request.body.sort || '')
    const requestedCount = Number(request.body.count)

    if (!songId) {
      return response.status(400).json({ error: '歌曲 ID 无效' })
    }
    if (!Object.hasOwn(SORT_TYPES, sort)) {
      return response.status(400).json({ error: '评论排序方式无效' })
    }
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 5000) {
      return response.status(400).json({ error: '采集数量必须在 1 到 5000 之间' })
    }

    const song = await getSong(songId)
    const job = jobs.create({ song, sort, requestedCount })
    return response.status(202).json({ job })
  } catch (error) {
    return next(error)
  }
})

app.get('/api/jobs/:jobId', (request, response) => {
  const job = jobs.get(request.params.jobId)
  if (!job) return response.status(404).json({ error: '采集任务不存在或已过期' })
  return response.json({ job: jobs.toPublic(job) })
})

app.delete('/api/jobs/:jobId', (request, response) => {
  const job = jobs.cancel(request.params.jobId)
  if (!job) return response.status(404).json({ error: '采集任务不存在或已过期' })
  return response.json({ job })
})

app.get('/api/jobs/:jobId/export', (request, response) => {
  const job = jobs.get(request.params.jobId)
  if (!job) return response.status(404).json({ error: '采集任务不存在或已过期' })
  if (job.comments.length === 0) {
    return response.status(409).json({ error: '当前任务没有可导出的评论' })
  }

  const format = request.query.format === 'json' ? 'json' : 'csv'
  const baseName = safeFilename(`${job.song.name}-${job.sort}-${job.comments.length}`)
  const encodedName = encodeURIComponent(`${baseName}.${format}`)
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)

  if (format === 'json') {
    response.type('application/json; charset=utf-8')
    return response.send(createJsonExport(job))
  }

  response.type('text/csv; charset=utf-8')
  return response.send(commentsToCsv(job.comments))
})

app.use('/api', (request, response) => {
  response.status(404).json({ error: '接口不存在' })
})

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  console.error(error)
  const message = error.message === 'Song not found or unavailable'
    ? '未找到这首歌曲'
    : '请求失败，请稍后重试'
  return response.status(502).json({ error: message })
})

app.listen(PORT, HOST, () => {
  console.log(`NetEase Comment Exporter: http://${HOST}:${PORT}`)
})
