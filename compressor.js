/* ==========================================================================
   MediaForge — Image Compressor
   Real client-side compression via <canvas>.toBlob(). No uploads: the file
   never leaves this tab. Re-runs compression whenever a setting changes.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewArea = document.getElementById('previewArea');
  const resultPreview = document.getElementById('resultPreview');
  const formatSwitch = document.getElementById('formatSwitch');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityLabel = document.getElementById('qualityLabel');
  const widthSlider = document.getElementById('widthSlider');
  const widthLabel = document.getElementById('widthLabel');
  const downloadBtn = document.getElementById('downloadBtn');

  const statName = document.getElementById('statName');
  const statDims = document.getElementById('statDims');
  const statOriginal = document.getElementById('statOriginal');
  const statCompressed = document.getElementById('statCompressed');
  const statSavings = document.getElementById('statSavings');

  let state = {
    originalFile: null,
    originalImage: null, // HTMLImageElement
    format: 'image/webp',
    compressedBlob: null,
  };

  /* ---------------- Dropzone interactions ---------------- */
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); dropzone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); dropzone.classList.remove('is-dragover');
  }));
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  /* ---------------- Load file ---------------- */
  function handleFile(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      mfToast('Please choose a JPG, PNG or WebP image.', 'danger');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      mfToast('That file is larger than 20MB.', 'danger');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.originalFile = file;
      state.originalImage = img;
      previewArea.classList.remove('d-none');
      widthSlider.max = Math.max(img.naturalWidth, 320);
      widthSlider.value = img.naturalWidth;
      widthLabel.textContent = `${img.naturalWidth}px (original)`;
      statName.textContent = file.name;
      statDims.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      statOriginal.textContent = mfFormatBytes(file.size);
      compress();
    };
    img.onerror = () => mfToast('Could not read that image file.', 'danger');
    img.src = url;
  }

  /* ---------------- Format switch ---------------- */
  formatSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    formatSwitch.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.format = btn.dataset.format;
    const isPng = state.format === 'image/png';
    qualitySlider.disabled = isPng;
    qualitySlider.parentElement.style.opacity = isPng ? .45 : 1;
    compress();
  });

  qualitySlider.addEventListener('input', () => {
    qualityLabel.textContent = `${qualitySlider.value}%`;
    compress();
  });

  widthSlider.addEventListener('input', () => {
    const atMax = Number(widthSlider.value) >= state.originalImage?.naturalWidth;
    widthLabel.textContent = atMax ? `${widthSlider.value}px (original)` : `${widthSlider.value}px`;
    compress();
  });

  /* ---------------- Compression pipeline ---------------- */
  let compressTimer = null;
  function compress() {
    if (!state.originalImage) return;
    clearTimeout(compressTimer);
    compressTimer = setTimeout(runCompress, 120); // light debounce for slider drags
  }

  function runCompress() {
    const img = state.originalImage;
    const targetWidth = Math.min(Number(widthSlider.value), img.naturalWidth);
    const scale = targetWidth / img.naturalWidth;
    const targetHeight = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const quality = Number(qualitySlider.value) / 100;

    canvas.toBlob((blob) => {
      if (!blob) { mfToast('Compression failed for this format.', 'danger'); return; }
      state.compressedBlob = blob;

      const url = URL.createObjectURL(blob);
      resultPreview.innerHTML = `<img src="${url}" alt="Compressed preview">`;

      statCompressed.textContent = mfFormatBytes(blob.size);
      const savingsPct = state.originalFile.size > 0
        ? Math.max(0, Math.round((1 - blob.size / state.originalFile.size) * 100))
        : 0;
      statSavings.textContent = blob.size < state.originalFile.size ? `−${savingsPct}%` : 'No reduction';
      downloadBtn.disabled = false;
    }, state.format, state.format === 'image/png' ? undefined : quality);
  }

  /* ---------------- Download ---------------- */
  downloadBtn.addEventListener('click', () => {
    if (!state.compressedBlob) return;
    const ext = state.format === 'image/webp' ? 'webp' : (state.format === 'image/png' ? 'png' : 'jpg');
    const baseName = (state.originalFile.name || 'image').replace(/\.[^.]+$/, '');
    const url = URL.createObjectURL(state.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-optimized.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    MFHistory.add({
      tool: 'compressor',
      icon: 'fa-file-zipper',
      color: 'var(--accent)',
      name: `${baseName}-optimized.${ext}`,
      detail: `${mfFormatBytes(state.originalFile.size)} → ${mfFormatBytes(state.compressedBlob.size)}`,
    });

    mfToast('Optimized file downloaded');
  });
});
