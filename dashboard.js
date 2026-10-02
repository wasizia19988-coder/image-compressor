/* ==========================================================================
   MediaForge — Dashboard
   Reads the demo profile (localStorage) and the shared MFHistory log that
   the tool pages write to, and renders stats + a recent activity table.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('mf_user')); } catch (e) { profile = null; }

  if (!profile || !profile.name) {
    window.location.href = 'login.html';
    return;
  }

  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  document.getElementById('dashAvatar').textContent = initials || '?';
  document.getElementById('dashName').textContent = profile.name;
  document.getElementById('welcomeName').textContent = `, ${profile.name.split(' ')[0]}`;

  function signOut() {
    try { localStorage.removeItem('mf_user'); } catch (e) {}
    window.location.href = 'login.html';
  }
  document.getElementById('signOutBtn').addEventListener('click', signOut);
  document.getElementById('mobileSignOut').addEventListener('click', (e) => { e.preventDefault(); signOut(); });

  const TOOL_META = {
    'compressor':     { label: 'Image Compressor', icon: 'fa-file-zipper', color: 'var(--accent)',  bg: 'var(--accent-soft)' },
    'audio-cutter':   { label: 'Audio Cutter',      icon: 'fa-scissors',   color: 'var(--accent-2)', bg: 'var(--accent-2-soft)' },
    'audio-transcript': { label: 'Audio to Transcript', icon: 'fa-file-lines', color: 'var(--accent-2)', bg: 'var(--accent-2-soft)' },
    'voice-recorder': { label: 'Voice Recorder',    icon: 'fa-microphone', color: 'var(--success)',  bg: 'var(--success-soft)' },
    'image-generator': { label: 'Image Generator',  icon: 'fa-wand-magic-sparkles', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  };

  function renderDashboard() {
    const history = MFHistory.all();

    document.getElementById('statTotal').textContent = history.length;
    document.getElementById('statImages').textContent = history.filter(h => h.tool === 'compressor').length;
    document.getElementById('statAudio').textContent = history.filter(h => h.tool === 'audio-cutter' || h.tool === 'audio-transcript').length;
    document.getElementById('statRecordings').textContent = history.filter(h => h.tool === 'voice-recorder').length;

    const body = document.getElementById('historyBody');
    if (!history.length) {
      body.innerHTML = `<tr><td colspan="4">
        <div class="empty-state" style="padding:30px 10px;">
          <i class="fa-solid fa-inbox" style="font-size:2rem;color:var(--text-faint);display:block;margin-bottom:10px;"></i>
          <p style="color:var(--text-dim);margin:0;">Nothing processed yet — try the <a href="compressor.html" style="color:var(--accent-2);">Image Compressor</a> or another tool.</p>
        </div>
      </td></tr>`;
      return;
    }

    body.innerHTML = history.map(h => {
      const meta = TOOL_META[h.tool] || { label: h.tool, icon: 'fa-file', color: 'var(--text-dim)', bg: 'var(--surface-raised)' };
      return `
      <tr>
        <td class="h-name"><span class="h-icon" style="background:${meta.bg};color:${meta.color};"><i class="fa-solid ${meta.icon}"></i></span>${h.name}</td>
        <td>${meta.label}</td>
        <td>${h.detail || '—'}</td>
        <td>${mfTimeAgo(h.when)}</td>
      </tr>`;
    }).join('');
  }

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (!MFHistory.all().length) return;
    if (window.confirm('Clear all recorded activity? This only affects data stored in this browser.')) {
      MFHistory.clear();
      renderDashboard();
      mfToast('History cleared');
    }
  });

  renderDashboard();
});
