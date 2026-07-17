const { randomUUID } = require('node:crypto')
const { CancelledError } = require('./netease')

class JobManager {
  constructor(options) {
    this.collector = options.collector
    this.jobs = new Map()
    this.ttlMs = options.ttlMs || 60 * 60 * 1000
    this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  create({ song, sort, requestedCount }) {
    const now = new Date().toISOString()
    const job = {
      id: randomUUID(),
      song,
      sort,
      requestedCount,
      status: 'queued',
      comments: [],
      collected: 0,
      totalAvailable: null,
      page: 0,
      hasMore: true,
      cancelRequested: false,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }

    this.jobs.set(job.id, job)
    queueMicrotask(() => this.run(job))
    return this.toPublic(job)
  }

  async run(job) {
    job.status = 'running'
    this.touch(job)

    try {
      const result = await this.collector({
        songId: job.song.id,
        count: job.requestedCount,
        sort: job.sort,
        shouldCancel: () => job.cancelRequested,
        onBatch: (batch) => {
          job.comments.push(...batch)
          job.collected = job.comments.length
          this.touch(job)
        },
        onProgress: (progress) => {
          job.collected = progress.collected
          job.totalAvailable = progress.totalAvailable
          job.page = progress.page
          job.hasMore = progress.hasMore
          this.touch(job)
        },
      })

      job.comments = result.comments
      job.collected = result.comments.length
      job.totalAvailable = result.totalAvailable
      job.hasMore = result.hasMore
      job.status = job.cancelRequested ? 'cancelled' : 'completed'
    } catch (error) {
      if (error instanceof CancelledError || job.cancelRequested) {
        job.status = 'cancelled'
      } else {
        job.status = 'failed'
        job.error = error.message || 'Collection failed'
      }
    }

    job.completedAt = new Date().toISOString()
    this.touch(job)
  }

  get(id) {
    return this.jobs.get(id)
  }

  cancel(id) {
    const job = this.get(id)
    if (!job) return null
    if (job.status === 'queued' || job.status === 'running') {
      job.cancelRequested = true
      this.touch(job)
    }
    return this.toPublic(job)
  }

  toPublic(job) {
    return {
      id: job.id,
      song: job.song,
      sort: job.sort,
      requestedCount: job.requestedCount,
      status: job.status,
      collected: job.collected,
      totalAvailable: job.totalAvailable,
      page: job.page,
      hasMore: job.hasMore,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      comments: job.comments.slice(-100).reverse(),
    }
  }

  touch(job) {
    job.updatedAt = new Date().toISOString()
  }

  cleanup() {
    const cutoff = Date.now() - this.ttlMs
    for (const [id, job] of this.jobs) {
      if (new Date(job.updatedAt).getTime() < cutoff) this.jobs.delete(id)
    }
  }
}

module.exports = { JobManager }
