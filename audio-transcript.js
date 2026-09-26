document.addEventListener('DOMContentLoaded', () => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const allowedExtensions = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']);
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePrompt = document.getElementById('filePrompt');
  const apiKeyInput = document.getElementById('apiKey');
  const transcribeBtn = document.getElementById('transcribeBtn');
  const transcriptOutput = document.getElementById('transcriptOutput');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusMessage = document.getElementById('statusMessage');
  let selectedFile = null;
  let isTranscribing = false;

  function updateTranscribeButton() {
    transcribeBtn.disabled = !selectedFile || !apiKeyInput.value.trim() || isTranscribing;
  }

  function selectFile(file) {
    if (!file) return;
    selectedFile = null;
    transcriptOutput.value = '';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    filePrompt.textContent = 'or click to browse · MP3, MP4, M4A, WAV, WEBM up to 25 MB';
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.has(extension)) {
      statusMessage.textContent = 'Choose an MP3, MP4, MPEG, MPGA, M4A, WAV, or WEBM audio file.';
    } else if (file.size > MAX_FILE_SIZE) {
      statusMessage.textContent = 'This file is larger than the 25 MB limit.';
    } else {
      selectedFile = file;
      filePrompt.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      statusMessage.textContent = apiKeyInput.value.trim()
        ? 'Audio selected. Ready to transcribe.'
        : 'Audio selected. Add your API key to start transcription.';
    }
    updateTranscribeButton();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));
  fileInput.addEventListener('change', () => {
    selectFile(fileInput.files[0]);
    fileInput.value = '';
  });
  apiKeyInput.addEventListener('input', updateTranscribeButton);

  transcribeBtn.addEventListener('click', async () => {
    if (!selectedFile || isTranscribing) return;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      statusMessage.textContent = 'Enter your OpenAI API key to continue.';
      apiKeyInput.focus();
      return;
    }

    isTranscribing = true;
    transcribeBtn.setAttribute('aria-busy', 'true');
    transcribeBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Transcribing…';
    statusMessage.textContent = 'Uploading audio to OpenAI for transcription…';
    updateTranscribeButton();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      formData.append('model', 'gpt-4o-mini-transcribe');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error?.message || `OpenAI returned an error (${response.status}).`;
        throw new Error(message);
      }
      if (!result || typeof result.text !== 'string') {
        throw new Error('The transcription response did not contain text.');
      }

      transcriptOutput.value = result.text;
      copyBtn.disabled = !result.text;
      downloadBtn.disabled = !result.text;
      MFHistory.add({
        tool: 'audio-transcript',
        name: selectedFile.name,
        detail: 'Transcribed with OpenAI'
      });
      statusMessage.textContent = result.text ? 'Transcription complete.' : 'Transcription completed, but no speech was detected.';
    } catch (error) {
      statusMessage.textContent = error instanceof TypeError
        ? 'Could not connect to OpenAI. Check your internet connection and browser access to the API.'
        : `Transcription failed: ${error.message}`;
    } finally {
      isTranscribing = false;
      transcribeBtn.removeAttribute('aria-busy');
      transcribeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Transcribe audio';
      updateTranscribeButton();
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(transcriptOutput.value);
      statusMessage.textContent = 'Transcript copied to clipboard.';
    } catch (error) {
      statusMessage.textContent = 'Could not access the clipboard. Select and copy the transcript manually.';
    }
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([transcriptOutput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedFile.name.replace(/\.[^.]+$/, '') || 'transcript'}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});
