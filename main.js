/* ==========================================================================
   MediaForge — main.js
   Shared across every page: mobile nav, active-link highlighting, scroll
   reveal, toast helper, and a tiny localStorage-backed activity history that
   the tool pages write to and the dashboard reads from.
   ========================================================================== */

/* ---------------- Toast helper (global) ---------------- */
function mfToast(message, type = 'success') {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = `mf-toast ${type === 'danger' ? 'toast-danger' : ''}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'danger' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${message}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* ---------------- Shared activity history (used by dashboard) ---------------- */
const MFHistory = {
  KEY: 'mf_history',

  all() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch (e) { return []; }
  },

  add(entry) {
    const list = this.all();
    list.unshift({ ...entry, id: 'h_' + Date.now(), when: new Date().toISOString() });
    try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* storage unavailable */ }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* noop */ }
  }
};

function mfFormatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function mfFormatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function mfTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ---------------- Nav / reveal / init (runs on every page) ---------------- */
document.addEventListener('DOMContentLoaded', () => {

  /* Mobile nav toggle */
  const burger = document.getElementById('navBurger');
  const mobileNav = document.getElementById('mobileNav');
  if (burger && mobileNav) {
    burger.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      mobileNav.setAttribute('aria-hidden', String(!open));
      burger.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      mobileNav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }));
  }

  /* Highlight the current page's nav link */
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.endsWith(currentFile) && currentFile !== 'index.html') {
      a.style.color = 'var(--text)';
    }
  });

  /* Sticky nav shadow on scroll */
  const nav = document.getElementById('siteNav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.boxShadow = window.scrollY > 8 ? 'var(--shadow-sm)' : 'none';
    }, { passive: true });
  }

  /* Scroll reveal */
  const targets = document.querySelectorAll('.reveal');
  if (targets.length) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      targets.forEach(t => observer.observe(t));
    } else {
      targets.forEach(t => t.classList.add('is-visible'));
    }
  }

  /* Password visibility toggles (auth pages) */
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = `<i class="fa-solid ${showing ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
    });
  });
});
