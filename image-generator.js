/* ==========================================================================
   MediaForge — Image Generator (Gemini "Nano Banana")
   Sends the user's prompt to the Gemini 2.5 Flash Image model with the
   user's own Google AI Studio key, displays the returned image, and offers
   a download. The key is never stored.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

  const promptInput = document.getElementById('promptInput');
  const apiKeyInput = document.getElementById('apiKey');
  const generateBtn = document.getElementById('generateBtn');
  const resultImage = document.getElementById('resultImage');
  const placeholderIcon = document.getElementById('placeholderIcon');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusMessage = document.getElementById('statusMessage');
  let isGenerating = false;
  let generatedDataUrl = null;
  let generatedMime = 'image/png';

  function updateGenerateButton() {
    generateBtn.disabled = !promptInput.value.trim() || !apiKeyInput.value.trim() || isGenerating;
  }

  promptInput.addEventListener('input', updateGenerateButton);
  apiKeyInput.addEventListener('input', updateGenerateButton);

  promptInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !generateBtn.disabled) {
      generateBtn.click();
    }
  });

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    if (!prompt || !apiKey || isGenerating) return;

    isGenerating = true;
    generateBtn.setAttribute('aria-busy', 'true');
    generateBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Generating…';
    statusMessage.textContent = 'Sending your prompt to Gemini…';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error?.message || `Gemini returned an error (${response.status}).`;
        throw new Error(message);
      }

      const parts = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((part) => part.inlineData && part.inlineData.data);
      if (!imagePart) {
        throw new Error('The response did not contain an image. Try rephrasing your prompt.');
      }

      generatedMime = imagePart.inlineData.mimeType || 'image/png';
      generatedDataUrl = `data:${generatedMime};base64,${imagePart.inlineData.data}`;
      resultImage.src = generatedDataUrl;
      resultImage.hidden = false;
      placeholderIcon.style.display = 'none';
      downloadBtn.disabled = false;

      const shortName = prompt.length > 42 ? prompt.slice(0, 42) + '…' : prompt;
      MFHistory.add({
        tool: 'image-generator',
        name: shortName,
        detail: 'Generated with Gemini'
      });
      statusMessage.textContent = 'Image ready. Use the download button to save it.';
    } catch (error) {
      statusMessage.textContent = error instanceof TypeError
        ? 'Could not connect to Google. Check your internet connection and browser access to the Gemini API.'
        : `Generation failed: ${error.message}`;
    } finally {
      isGenerating = false;
      generateBtn.removeAttribute('aria-busy');
      generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate image';
      updateGenerateButton();
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!generatedDataUrl) return;
    const extension = generatedMime.includes('jpeg') ? 'jpg' : 'png';
    const link = document.createElement('a');
    link.href = generatedDataUrl;
    link.download = `mediaforge-image-${Date.now()}.${extension}`;
    link.click();
  });
});
