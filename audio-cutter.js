/* ==========================================================================
   MediaForge — Audio Cutter
   Decodes audio with the Web Audio API, draws a real min/max waveform,
   supports draggable trim handles, in-browser preview playback, and exports
   the trimmed selection as a WAV file — no server, no uploads.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const waveformArea = document.getElementById('waveformArea');
  const waveformWrap = document.getElementById('waveformWrap');
  const canvas = document.getElementById('waveCanvas');
  const trimRegion = document.getElementById('trimRegion');
  const handleStart = document.getElementById('handleStart');
  const handleEnd = document.getElementById('handleEnd');
  const playhead = document.getElementById('playhead');
  const playBtn = document.getElementById('playBtn');
  const playAllBtn = document.getElementById('playAllBtn');
  const exportBtn = document.getElementById('exportBtn');

  const statName = document.getElementById('statName');
  const statDuration = document.getElementById('statDuration');
  const statSampleRate = document.getElementById('statSampleRate');
  const statChannels = document.getElementById('statChannels');
  const selStart = document.getElementById('selStart');
  const selEnd = document.getElementById('selEnd');
  const selDuration = document.getElementById('selDuration');
  const startTimeLabel = document.getElementById('startTimeLabel');
  const endTimeLabel = document.getElementById('endTimeLabel');

  let audioCtx = null;
  let audioBuffer = null;
  let fileMeta = { name: '' };
  let trim = { start: 0, end: 1 }; // fractions of total duration
  let activeSource = null;
  let playheadRAF = null;

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  /* ---------------- Dropzone interactions ---------------- */
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('is-dragover'); }));
  dropzone.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  fileInput.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) handleFile(f); });

  /* ---------------- Load + decode ---------------- */
  function handleFile(file) {
    if (!file.type.startsWith('audio/')) {
      mfToast('Please choose an audio file.', 'danger');
      return;
    }
    stopPlayback();
    fileMeta.name = file.name;
    statName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      getCtx().decodeAudioData(e.target.result.slice(0), (buffer) => {
        audioBuffer = buffer;
        trim = { start: 0, end: 1 };
        waveformArea.classList.remove('d-none');
        statDuration.textContent = mfFormatTime(buffer.duration);
        statSampleRate.textContent = `${buffer.sampleRate.toLocaleString()} Hz`;
        statChannels.textContent = buffer.numberOfChannels === 1 ? 'Mono' : 'Stereo';
        exportBtn.disabled = false;
        requestAnimationFrame(() => { drawWaveform(); updateHandles(); });
      }, () => mfToast('Could not decode that audio file.', 'danger'));
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------------- Waveform drawing (min/max per pixel column) ---------------- */
  function drawWaveform() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const data = audioBuffer.getChannelData(0);
    const w = rect.width, h = rect.height, mid = h / 2;
    const samplesPerPixel = Math.max(1, Math.floor(data.length / w));

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#22D3EE';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const start = x * samplesPerPixel;
      let min = 1.0, max = -1.0;
      for (let i = 0; i < samplesPerPixel; i++) {
        const v = data[start + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(x, mid + min * mid * 0.92);
      ctx.lineTo(x, mid + max * mid * 0.92);
    }
    ctx.stroke();
  }
  window.addEventListener('resize', () => { if (audioBuffer) { drawWaveform(); updateHandles(); } });

  /* ---------------- Trim handles (drag) ---------------- */
  function updateHandles() {
    handleStart.style.left = `${trim.start * 100}%`;
    handleEnd.style.left = `${trim.end * 100}%`;
    trimRegion.style.left = `${trim.start * 100}%`;
    trimRegion.style.width = `${(trim.end - trim.start) * 100}%`;

    const dur = audioBuffer ? audioBuffer.duration : 0;
    const s = trim.start * dur, en = trim.end * dur;
    selStart.textContent = mfFormatTime(s);
    selEnd.textContent = mfFormatTime(en);
    selDuration.textContent = mfFormatTime(en - s);
    startTimeLabel.textContent = mfFormatTime(s);
    endTimeLabel.textContent = mfFormatTime(en);
  }

  function makeDraggable(handle, which) {
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const rect = waveformWrap.getBoundingClientRect();
        let frac = (ev.clientX - rect.left) / rect.width;
        frac = Math.min(1, Math.max(0, frac));
        if (which === 'start') trim.start = Math.min(frac, trim.end - 0.01);
        else trim.end = Math.max(frac, trim.start + 0.01);
        updateHandles();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    handle.addEventListener('keydown', (e) => {
      const step = 0.01;
      if (e.key === 'ArrowLeft') {
        if (which === 'start') trim.start = Math.max(0, trim.start - step);
        else trim.end = Math.max(trim.start + 0.01, trim.end - step);
        updateHandles(); e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        if (which === 'start') trim.start = Math.min(trim.end - 0.01, trim.start + step);
        else trim.end = Math.min(1, trim.end + step);
        updateHandles(); e.preventDefault();
      }
    });
  }
  makeDraggable(handleStart, 'start');
  makeDraggable(handleEnd, 'end');

  /* ---------------- Playback ---------------- */
  function stopPlayback() {
    if (activeSource) { try { activeSource.stop(); } catch (e) {} activeSource = null; }
    cancelAnimationFrame(playheadRAF);
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  function playRange(startFrac, endFrac) {
    if (!audioBuffer) return;
    stopPlayback();
    const ctx = getCtx();
    const dur = audioBuffer.duration;
    const offset = startFrac * dur;
    const length = Math.max(0.02, (endFrac - startFrac) * dur);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0, offset, length);
    activeSource = source;
    playBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';

    const startedAt = ctx.currentTime;
    function animate() {
      const elapsed = ctx.currentTime - startedAt;
      const frac = startFrac + (elapsed / dur);
      playhead.style.left = `${Math.min(endFrac, frac) * 100}%`;
      if (elapsed < length) playheadRAF = requestAnimationFrame(animate);
      else { playhead.style.left = `${startFrac * 100}%`; playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
    }
    animate();
    source.onended = () => { playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; };
  }

  playBtn.addEventListener('click', () => {
    if (activeSource) { stopPlayback(); return; }
    playRange(trim.start, trim.end);
  });
  playAllBtn.addEventListener('click', () => playRange(0, 1));

  /* ---------------- WAV encoding + export ---------------- */
  function extractBuffer(buffer, startFrac, endFrac) {
    const ctx = getCtx();
    const startFrame = Math.floor(startFrac * buffer.length);
    const endFrame = Math.floor(endFrac * buffer.length);
    const frameCount = Math.max(1, endFrame - startFrame);
    const out = ctx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch).subarray(startFrame, endFrame);
      out.copyToChannel(src, ch, 0);
    }
    return out;
  }

  function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numFrames * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    function writeString(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const channelData = [];
    for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = Math.max(-1, Math.min(1, channelData[ch][i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  exportBtn.addEventListener('click', () => {
    if (!audioBuffer) return;
    const trimmed = extractBuffer(audioBuffer, trim.start, trim.end);
    const blob = bufferToWav(trimmed);
    const baseName = (fileMeta.name || 'audio').replace(/\.[^.]+$/, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-trimmed.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    MFHistory.add({
      tool: 'audio-cutter',
      icon: 'fa-scissors',
      color: 'var(--accent-2)',
      name: `${baseName}-trimmed.wav`,
      detail: `${mfFormatTime(trimmed.duration)} clip · ${mfFormatBytes(blob.size)}`,
    });

    mfToast('Trimmed clip downloaded');
  });
});
