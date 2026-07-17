const elements = {
  songForm: document.querySelector('#song-form'),
  songInput: document.querySelector('#song-input'),
  lookupButton: document.querySelector('#lookup-button'),
  startButton: document.querySelector('#start-button'),
  countInput: document.querySelector('#count-input'),
  songCover: document.querySelector('#song-cover'),
  coverPlaceholder: document.querySelector('#cover-placeholder'),
  songState: document.querySelector('#song-state'),
  songTitle: document.querySelector('#song-title'),
  songArtist: document.querySelector('#song-artist'),
  songAlbum: document.querySelector('#song-album'),
  taskMeta: document.querySelector('#task-meta'),
  taskStatus: document.querySelector('#task-status span:last-child'),
  taskStatusIcon: document.querySelector('#task-status img'),
  progressBar: document.querySelector('#progress-bar'),
  cancelButton: document.querySelector('#cancel-button'),
  csvButton: document.querySelector('#csv-button'),
  jsonButton: document.querySelector('#json-button'),
  resultCount: document.querySelector('#result-count'),
  commentsBody: document.querySelector('#comments-body'),
  toast: document.querySelector('#toast'),
}

const state = {
  song: null,
  songInputValue: '',
  jobId: null,
  pollTimer: null,
  toastTimer: null,
}

const sortLabels = {
  recommended: '推荐',
  hot: '热门',
  newest: '最新',
}

async function requestJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '请求失败')
  return data
}

function showToast(message) {
  clearTimeout(state.toastTimer)
  elements.toast.textContent = message
  elements.toast.hidden = false
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true
  }, 4200)
}

function setLookupBusy(busy) {
  elements.lookupButton.disabled = busy
  elements.lookupButton.lastChild.textContent = busy ? '读取中' : '读取'
}

function resetSong() {
  state.song = null
  elements.songCover.hidden = true
  elements.songCover.removeAttribute('src')
  elements.coverPlaceholder.hidden = false
  elements.songState.textContent = '等待读取'
  elements.songTitle.textContent = '尚未选择歌曲'
  elements.songArtist.textContent = '-'
  elements.songAlbum.textContent = '-'
  elements.startButton.disabled = true
}

function renderSong(song) {
  elements.songState.textContent = `歌曲 ID ${song.id}`
  elements.songTitle.textContent = song.name
  elements.songArtist.textContent = song.artists.join(' / ') || '未知歌手'
  elements.songAlbum.textContent = song.album || '未知专辑'
  if (song.coverUrl) {
    elements.songCover.src = `${song.coverUrl}?param=240y240`
    elements.songCover.alt = `${song.name} 专辑封面`
    elements.songCover.hidden = false
    elements.coverPlaceholder.hidden = true
  }
  elements.startButton.disabled = false
}

async function lookupSong() {
  const input = elements.songInput.value.trim()
  if (!input) throw new Error('请输入歌曲链接或歌曲 ID')

  setLookupBusy(true)
  try {
    const data = await requestJson(`/api/song?input=${encodeURIComponent(input)}`)
    state.song = data.song
    state.songInputValue = input
    renderSong(data.song)
    return data.song
  } finally {
    setLookupBusy(false)
  }
}

function setControlsRunning(running) {
  elements.songInput.disabled = running
  elements.lookupButton.disabled = running
  elements.countInput.disabled = running
  document.querySelectorAll('input[name="sort"]').forEach((input) => {
    input.disabled = running
  })
  elements.startButton.disabled = running || !state.song
  elements.cancelButton.hidden = !running
}

function currentSort() {
  return document.querySelector('input[name="sort"]:checked').value
}

function setStatus(message, icon = 'inbox.svg') {
  elements.taskStatus.textContent = message
  elements.taskStatusIcon.src = `/icons/${icon}`
}

function renderComments(comments) {
  elements.commentsBody.replaceChildren()
  if (!comments.length) {
    const row = document.createElement('tr')
    row.className = 'empty-row'
    const cell = document.createElement('td')
    cell.colSpan = 4
    cell.textContent = '暂无评论'
    row.append(cell)
    elements.commentsBody.append(row)
    return
  }

  const fragment = document.createDocumentFragment()
  for (const comment of comments) {
    const row = document.createElement('tr')
    const values = [
      comment.content,
      comment.nickname || '-',
      comment.likedCount.toLocaleString('zh-CN'),
      formatTime(comment),
    ]
    for (const value of values) {
      const cell = document.createElement('td')
      cell.textContent = value
      row.append(cell)
    }
    fragment.append(row)
  }
  elements.commentsBody.append(fragment)
}

function formatTime(comment) {
  if (!comment.publishedAt) return comment.timeText || '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(comment.publishedAt))
}

function renderJob(job) {
  const percent = Math.min(100, Math.round((job.collected / job.requestedCount) * 100))
  elements.progressBar.style.width = `${percent}%`
  elements.taskMeta.textContent = `${sortLabels[job.sort]} · 目标 ${job.requestedCount.toLocaleString('zh-CN')} 条 · 第 ${job.page || 0} 页`
  elements.resultCount.textContent = `${job.collected.toLocaleString('zh-CN')} 条`
  renderComments(job.comments)

  const running = job.status === 'queued' || job.status === 'running'
  setControlsRunning(running)
  elements.csvButton.hidden = job.collected === 0 || running
  elements.jsonButton.hidden = job.collected === 0 || running

  if (job.status === 'queued') setStatus('任务排队中', 'loader-circle.svg')
  if (job.status === 'running') {
    const total = job.totalAvailable
      ? `，歌曲共 ${job.totalAvailable.toLocaleString('zh-CN')} 条公开评论`
      : ''
    setStatus(`已采集 ${job.collected.toLocaleString('zh-CN')} / ${job.requestedCount.toLocaleString('zh-CN')} 条${total}`, 'loader-circle.svg')
  }
  if (job.status === 'completed') setStatus(`采集完成，共 ${job.collected.toLocaleString('zh-CN')} 条`, 'circle-check.svg')
  if (job.status === 'cancelled') setStatus(`采集已取消，保留 ${job.collected.toLocaleString('zh-CN')} 条`, 'circle-stop.svg')
  if (job.status === 'failed') setStatus(job.error || '采集失败', 'circle-alert.svg')

  return running
}

async function pollJob() {
  if (!state.jobId) return
  try {
    const data = await requestJson(`/api/jobs/${state.jobId}`)
    const running = renderJob(data.job)
    if (running) {
      state.pollTimer = setTimeout(pollJob, 700)
    }
  } catch (error) {
    setControlsRunning(false)
    showToast(error.message)
  }
}

async function startJob() {
  try {
    if (!state.song || state.songInputValue !== elements.songInput.value.trim()) {
      await lookupSong()
    }

    const count = Number(elements.countInput.value)
    if (!Number.isInteger(count) || count < 1 || count > 5000) {
      throw new Error('采集数量必须在 1 到 5000 之间')
    }

    clearTimeout(state.pollTimer)
    elements.csvButton.hidden = true
    elements.jsonButton.hidden = true
    setControlsRunning(true)
    setStatus('正在创建采集任务', 'loader-circle.svg')

    const data = await requestJson('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId: state.song.id,
        sort: currentSort(),
        count,
      }),
    })
    state.jobId = data.job.id
    renderJob(data.job)
    pollJob()
  } catch (error) {
    setControlsRunning(false)
    showToast(error.message)
  }
}

async function cancelJob() {
  if (!state.jobId) return
  elements.cancelButton.disabled = true
  try {
    const data = await requestJson(`/api/jobs/${state.jobId}`, { method: 'DELETE' })
    renderJob(data.job)
  } catch (error) {
    showToast(error.message)
  } finally {
    elements.cancelButton.disabled = false
  }
}

function download(format) {
  if (!state.jobId) return
  window.location.assign(`/api/jobs/${state.jobId}/export?format=${format}`)
}

elements.songForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    await lookupSong()
  } catch (error) {
    resetSong()
    showToast(error.message)
  }
})

elements.songInput.addEventListener('input', () => {
  if (elements.songInput.value.trim() !== state.songInputValue) {
    elements.startButton.disabled = true
  }
})

elements.startButton.addEventListener('click', startJob)
elements.cancelButton.addEventListener('click', cancelJob)
elements.csvButton.addEventListener('click', () => download('csv'))
elements.jsonButton.addEventListener('click', () => download('json'))

const initialSong = new URLSearchParams(window.location.search).get('song')
if (initialSong) {
  elements.songInput.value = initialSong
  lookupSong().catch((error) => showToast(error.message))
}
