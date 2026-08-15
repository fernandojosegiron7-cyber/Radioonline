(() => {
  'use strict';

  const cfg = window.RADIO_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const audio = $('audio');
  const play = $('play');
  const app = $('app');
  const status = $('status');
  const songEl = $('song');
  const artistEl = $('artist');
  const volume = $('volume');
  const volNumber = $('volNumber');
  const mute = $('mute');
  const volDown = $('volDown');
  const volUp = $('volUp');
  const stationNameEl = $('stationName');
  const taglineEl = $('tagline');
  const stationLogo = $('stationLogo');
  const logoFallback = $('logoFallback');

  // ===== Menú lateral, historial, redes y peticiones =====
  const menuToggle = $('menuToggle');
  const menuClose = $('menuClose');
  const menuOverlay = $('menuOverlay');
  const sideMenu = $('sideMenu');
  const menuPanel = $('menuPanel');
  const historyList = $('historyList');
  const clearHistory = $('clearHistory');
  const socialList = $('socialList');
  const requestSong = $('requestSong');
  const requestButton = $('requestButton');
  const requestNote = $('requestNote');
  const HISTORY_KEY = 'aloPaisanoSongHistoryV1';

  function openMenu() {
    sideMenu.classList.add('open');
    sideMenu.setAttribute('aria-hidden', 'false');
    menuOverlay.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    sideMenu.classList.remove('open');
    sideMenu.setAttribute('aria-hidden', 'true');
    menuOverlay.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  menuOverlay?.addEventListener('click', closeMenu);

  document.querySelectorAll('.menu-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-item').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.section;
      document.querySelectorAll('.menu-section').forEach((section) => {
        section.hidden = section.dataset.panel !== target;
      });
    });
  });

  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveHistory(items) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20))); }
  function renderHistory() {
    const items = readHistory();
    if (!items.length) {
      historyList.innerHTML = '<p class="empty-state">El historial aparecerá aquí mientras escuchas.</p>';
      return;
    }
    historyList.innerHTML = items.map(item => {
      const t = new Date(item.at);
      const time = Number.isNaN(t.getTime()) ? '' : t.toLocaleTimeString('es-HN', {hour:'numeric', minute:'2-digit'});
      return `<div class="history-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.artist || stationName)}</span><time>${escapeHtml(time)}</time></div>`;
    }).join('');
  }
  function addToHistory(meta) {
    if (!meta?.title) return;
    const items = readHistory();
    const key = `${meta.artist || ''}|${meta.title}`.toLowerCase();
    const existing = items.findIndex(i => `${i.artist || ''}|${i.title}`.toLowerCase() === key);
    if (existing >= 0) items.splice(existing, 1);
    items.unshift({ title: meta.title, artist: meta.artist || stationName, at: new Date().toISOString() });
    saveHistory(items);
    renderHistory();
  }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  clearHistory?.addEventListener('click', () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); });
  renderHistory();

  const socialLabels = { facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube' };
  const socialEntries = Object.entries(cfg.socials || {}).filter(([,url]) => url);
  socialList.innerHTML = socialEntries.length
    ? socialEntries.map(([name,url]) => `<a class="social-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${socialLabels[name] || escapeHtml(name)}</a>`).join('')
    : '<p class="empty-state">Agrega tus enlaces de redes en config.js.</p>';

  requestButton?.addEventListener('click', () => {
    const text = requestSong.value.trim();
    if (!text) { requestNote.textContent = 'Escribe primero el nombre de la canción.'; return; }
    const phone = String(cfg.requestWhatsApp || '').replace(/\D/g, '');
    if (!phone) { requestNote.textContent = 'Falta configurar el número de WhatsApp en config.js.'; return; }
    const message = `Hola ALÓ PAISANO RADIO, quiero pedir la canción: ${text}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    requestNote.textContent = '';
  });

  const stationName = cfg.stationName || 'Radio Online';
  const streamUrl = cfg.streamUrl || cfg.playlistUrl || '';
  const mount = cfg.zenoMount || extractMount(cfg.playlistUrl || streamUrl);
  let lastVolume = Number(cfg.defaultVolume ?? 80);
  let lastMetadataKey = '';
  let metadataTimer = null;

  document.title = stationName;
  stationNameEl.textContent = stationName;
  taglineEl.textContent = cfg.tagline || '';
  artistEl.textContent = stationName;
  audio.src = streamUrl;

  if (cfg.logoUrl) {
    stationLogo.src = cfg.logoUrl;
    stationLogo.hidden = false;
    logoFallback.hidden = true;
  }

  function extractMount(url) {
    try {
      const u = new URL(url);
      const part = u.pathname.split('/').filter(Boolean).pop() || '';
      return part.replace(/\.(m3u8?|pls|mp3|aac)$/i, '');
    } catch (_) {
      return '';
    }
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function paintVolume(v) {
    volume.style.setProperty('--volume-fill', `${v}%`);
    volNumber.textContent = `${Math.round(v)}%`;
    mute.textContent = v <= 0 ? '🔇' : (v < 45 ? '🔉' : '🔊');
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(100, Number(v)));
    volume.value = String(v);
    if (v > 0) lastVolume = v;
    if (!isIOS()) {
      try { audio.volume = v / 100; } catch (_) {}
    }
    paintVolume(v);
  }

  setVolume(lastVolume);
  volume.addEventListener('input', () => setVolume(volume.value));
  volDown.addEventListener('click', () => setVolume(Number(volume.value) - 10));
  volUp.addEventListener('click', () => setVolume(Number(volume.value) + 10));
  mute.addEventListener('click', () => {
    if (Number(volume.value) > 0) {
      lastVolume = Number(volume.value);
      setVolume(0);
    } else {
      setVolume(lastVolume || 80);
    }
  });

  if (isIOS()) {
    const iosVolumeMessage = () => {
      status.textContent = 'En iPhone/iPad el volumen final se controla con los botones del dispositivo.';
    };
    volume.addEventListener('change', iosVolumeMessage);
    volDown.addEventListener('click', iosVolumeMessage);
    volUp.addEventListener('click', iosVolumeMessage);
  }

  play.addEventListener('click', async () => {
    try {
      if (audio.paused) {
        // Reload the live URL so Play rejoins the current live point.
        if (!audio.src) audio.src = streamUrl;
        await audio.play();
        play.textContent = '❚❚';
        play.setAttribute('aria-label', 'Pausar');
        app.classList.add('playing');
        status.textContent = 'Reproduciendo en vivo';
      } else {
        audio.pause();
        play.textContent = '▶';
        play.setAttribute('aria-label', 'Reproducir');
        app.classList.remove('playing');
        status.textContent = 'Transmisión en pausa';
      }
    } catch (err) {
      console.error(err);
      status.textContent = 'No se pudo iniciar la transmisión.';
    }
  });

  audio.addEventListener('waiting', () => status.textContent = 'Conectando…');
  audio.addEventListener('playing', () => status.textContent = 'Reproduciendo en vivo');
  audio.addEventListener('error', () => {
    status.textContent = 'Error de transmisión. Intenta nuevamente.';
    play.textContent = '▶';
    app.classList.remove('playing');
  });

  function splitArtistTitle(text) {
    text = String(text || '').trim();
    if (!text) return { title: '', artist: '' };
    if (text.includes(' - ')) {
      const parts = text.split(' - ');
      const artist = parts.shift().trim();
      const title = parts.join(' - ').trim();
      return { title, artist };
    }
    return { title: text, artist: '' };
  }

  function normalizeMetadata(payload) {
    if (!payload) return { title: '', artist: '' };
    if (payload.data) payload = payload.data;

    const candidates = [
      payload,
      payload.metadata,
      payload.now_playing,
      payload.now_playing && payload.now_playing.song,
      payload.song
    ].filter(Boolean);

    let title = '';
    let artist = '';
    for (const item of candidates) {
      if (typeof item === 'string') {
        title ||= item;
        continue;
      }
      title ||= item.title || item.streamTitle || item.songtitle || item.text || item.name || '';
      artist ||= item.artist || item.performer || item.author || '';
    }

    if (title && !artist) {
      const parsed = splitArtistTitle(title);
      title = parsed.title;
      artist = parsed.artist;
    }
    return { title: String(title || '').trim(), artist: String(artist || '').trim() };
  }

  function showMetadata(meta) {
    if (!meta || !meta.title) return;
    const key = `${meta.artist}|${meta.title}`;
    if (key === lastMetadataKey) return;
    lastMetadataKey = key;
    songEl.textContent = meta.title;
    artistEl.textContent = meta.artist || stationName;
    addToHistory(meta);
  }

  async function refreshMetadata() {
    if (!mount) {
      songEl.textContent = 'Transmisión en vivo';
      artistEl.textContent = stationName;
      return;
    }
    try {
      const r = await fetch(`/api/metadata?mount=${encodeURIComponent(mount)}&_=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Metadata HTTP ${r.status}`);
      const data = await r.json();
      const meta = normalizeMetadata(data);
      if (meta.title) showMetadata(meta);
    } catch (err) {
      console.debug('Metadata no disponible temporalmente', err);
      if (!lastMetadataKey) {
        songEl.textContent = 'Transmisión en vivo';
        artistEl.textContent = stationName;
      }
    }
  }

  refreshMetadata();
  metadataTimer = window.setInterval(refreshMetadata, 10000);
  window.addEventListener('beforeunload', () => {
    if (metadataTimer) clearInterval(metadataTimer);
  });
})();
