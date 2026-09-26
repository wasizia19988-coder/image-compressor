/* ==========================================================================
   MediaForge — Voice Recorder
   Uses getUserMedia + MediaRecorder for real microphone capture, an
   AnalyserNode for the live level meter, and exposes playback/download of
   the resulting Blob. Nothing is transmitted anywhere.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const permissionCard = document.getElementById('permissionCard');
  const recorderCard = document.getElementById('recorderCard');
  const playbackCard = document.getElementById('playbackCard');
  const requestMicBtn = document.getElementById('requestMicBtn');
  const recordBtn = document.getElementById('recordBtn');
  const playRecordingBtn = document.getElementById('playRecordingBtn');
  const recTimer = document.getElementById('recTimer');
  const levelCanvas = document.getElementById('levelCanvas');
  const audioPlayback = document.getElementById('audioPlayback');
  const downloadRecBtn = document.getElementById('downloadRecBtn');

  const statStatus = document.getElementById('statStatus');
  const statRecDuration = document.getElementById('statRecDuration');
  const statRecSize = document.getElementById('statRecSize');
  const statRecFormat = document.getElementById('statRecFormat');

  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let mediaRecorder = null;
  let chunks = [];
  let recordedBlob = null;
  let isRecording = false;
  let startedAt = 0;
  let timerInterval = null;
  let levelRAF = null;

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    permissionCard.innerHTML = `<div class="panel-title"><i class="fa-solid fa-triangle-exclamation"></i> Not supported</div>
      <p style="color:var(--text-dim);font-size:0.87rem;margin:0;">Your browser doesn't support in-browser audio recording. Try the latest Chrome, Edge or Firefox.</p>`;
    return;
  }

  requestMicBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionCard.classList.add('d-none');
      recorderCard.classList.remove('d-none');
      setupAnalyser();
      drawIdleLevel();
      mfToast('Microphone connected');
    } catch (err) {
      mfToast('Microphone access was denied.', 'danger');
    }
  });

  function setupAnalyser() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
  }

  /* ---------------- Live level meter ---------------- */
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = levelCanvas.getBoundingClientRect();
    levelCanvas.width = rect.width * dpr;
    levelCanvas.height = rect.height * dpr;
    const ctx = levelCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function drawIdleLevel() {
    const { ctx, w, h } = sizeCanvas();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(145,153,172,.25)';
    for (let x = 0; x < w; x += 6) ctx.fillRect(x, h / 2 - 1, 3, 2);
  }

  function drawLevelFrame() {
    const { ctx, w, h } = sizeCanvas();
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = isRecording ? '#FF6B35' : '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sliceWidth = w / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    levelRAF = requestAnimationFrame(drawLevelFrame);
  }

  /* ---------------- Record / stop ---------------- */
  recordBtn.addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  function pickMimeType() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function startRecording() {
    chunks = [];
    const mimeType = pickMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStop;
    mediaRecorder.start();

    isRecording = true;
    startedAt = Date.now();
    recordBtn.classList.add('is-recording');
    recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    recordBtn.setAttribute('aria-label', 'Stop recording');
    statStatus.textContent = 'Recording…';
    playbackCard.classList.add('d-none');
    downloadRecBtn.disabled = true;
    playRecordingBtn.disabled = true;

    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      recTimer.textContent = mfFormatTime(elapsed);
      statRecDuration.textContent = mfFormatTime(elapsed);
    }, 200);

    cancelAnimationFrame(levelRAF);
    drawLevelFrame();
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    isRecording = false;
    clearInterval(timerInterval);
    recordBtn.classList.remove('is-recording');
    recordBtn.innerHTML = '<i class="fa-solid fa-circle"></i>';
    recordBtn.setAttribute('aria-label', 'Start recording');
    statStatus.textContent = 'Stopped';
  }

  function onRecordingStop() {
    const mimeType = mediaRecorder.mimeType || 'audio/webm';
    recordedBlob = new Blob(chunks, { type: mimeType });

    const url = URL.createObjectURL(recordedBlob);
    audioPlayback.src = url;
    playbackCard.classList.remove('d-none');

    statRecSize.textContent = mfFormatBytes(recordedBlob.size);
    statRecFormat.textContent = mimeType.split(';')[0].split('/')[1].toUpperCase();
    downloadRecBtn.disabled = false;
    playRecordingBtn.disabled = false;
  }

  playRecordingBtn.addEventListener('click', () => {
    if (!audioPlayback.src) return;
    if (audioPlayback.paused) { audioPlayback.play(); playRecordingBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }
    else { audioPlayback.pause(); playRecordingBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
  });
  audioPlayback.addEventListener('ended', () => { playRecordingBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; });

  downloadRecBtn.addEventListener('click', () => {
    if (!recordedBlob) return;
    const ext = (mediaRecorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a'
      : (mediaRecorder.mimeType || '').includes('ogg') ? 'ogg' : 'webm';
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-recording-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    MFHistory.add({
      tool: 'voice-recorder',
      icon: 'fa-microphone',
      color: 'var(--success)',
      name: `voice-recording.${ext}`,
      detail: `${statRecDuration.textContent} · ${mfFormatBytes(recordedBlob.size)}`,
    });

    mfToast('Recording downloaded');
  });

  window.addEventListener('resize', () => { if (!isRecording && analyser) drawIdleLevel(); });
});
