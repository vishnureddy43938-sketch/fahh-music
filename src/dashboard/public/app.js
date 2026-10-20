/**
 * HYDRA Dashboard Client Application
 */

let activeGuildId = null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  setupTabs();
  setupControls();
  setupSettingsForm();
});

// Toast notification helper
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderColor = isError ? 'var(--danger-red)' : 'var(--vibrant-cyan)';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

// Authentication Check
async function initAuth() {
  try {
    const res = await fetch('/api/auth/user');
    const data = await res.json();

    const userSection = document.getElementById('userSection');
    const heroSection = document.getElementById('heroSection');
    const dashboardView = document.getElementById('dashboardView');

    if (data.authenticated && data.user) {
      userSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=64" 
               style="width: 36px; height: 36px; border-radius: 50%;" 
               onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <span style="font-weight: 600;">${data.user.username}</span>
          <a href="/api/auth/logout" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Logout</a>
        </div>
      `;

      heroSection.style.display = 'none';
      dashboardView.style.display = 'grid';

      await loadGuilds();
    } else {
      heroSection.style.display = 'block';
      dashboardView.style.display = 'none';
    }
  } catch (err) {
    console.error('Error verifying auth:', err);
  }
}

// Load user's managed servers
async function loadGuilds() {
  const guildList = document.getElementById('guildList');
  try {
    const res = await fetch('/api/guilds');
    const guilds = await res.json();

    if (!Array.isArray(guilds) || guilds.length === 0) {
      guildList.innerHTML = '<div class="empty-state">No servers found where you have Manage Server permissions.</div>';
      return;
    }

    guildList.innerHTML = '';
    guilds.forEach((g, index) => {
      const item = document.createElement('div');
      item.className = 'guild-item' + (index === 0 ? ' active' : '');
      item.dataset.guildId = g.id;

      const iconUrl = g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
        : 'https://cdn.discordapp.com/embed/avatars/1.png';

      item.innerHTML = `
        <img src="${iconUrl}" class="guild-icon" alt="${g.name}">
        <div style="flex: 1; overflow: hidden;">
          <div class="guild-name">${g.name}</div>
          <div class="guild-status-badge">${g.isPlaying ? '🔴 Playing' : 'Idle'}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.guild-item').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
        selectGuild(g.id, g.name);
      });

      guildList.appendChild(item);
    });

    // Select the first server by default
    if (guilds.length > 0) {
      selectGuild(guilds[0].id, guilds[0].name);
    }
  } catch (err) {
    guildList.innerHTML = '<div class="empty-state">Failed to load server list.</div>';
    console.error(err);
  }
}

// Select Guild and fetch live details
async function selectGuild(guildId, guildName) {
  activeGuildId = guildId;
  document.getElementById('currentServerName').textContent = guildName;

  if (pollInterval) clearInterval(pollInterval);
  await refreshGuildData();

  // Poll for player progress and status updates
  pollInterval = setInterval(refreshGuildData, 3000);
}

// Format duration
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

// Refresh guild player and settings
async function refreshGuildData() {
  if (!activeGuildId) return;

  try {
    const res = await fetch(`/api/guilds/${activeGuildId}`);
    const data = await res.json();

    const emptyState = document.getElementById('playerEmptyState');
    const trackView = document.getElementById('activeTrackView');

    if (!data.botInGuild) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = `
        <div class="empty-icon">🤖</div>
        <p>HYDRA is not in this server yet.</p>
        <a href="${data.inviteUrl}" target="_blank" class="btn btn-primary" style="margin-top: 12px;">Add HYDRA to Server</a>
      `;
      trackView.style.display = 'none';
      return;
    }

    // Populate Settings Form
    if (data.settings) {
      document.getElementById('settingVolume').value = data.settings.default_volume || 100;
      document.getElementById('settingIdle').value = data.settings.idle_timeout || 180;
      document.getElementById('setting247').checked = Boolean(data.settings.mode_247);
      document.getElementById('settingAutoplay').checked = Boolean(data.settings.autoplay_enabled);
    }

    // Player State
    if (data.player && data.player.isPlaying && data.player.currentTrack) {
      emptyState.style.display = 'none';
      trackView.style.display = 'flex';

      const track = data.player.currentTrack;
      document.getElementById('trackArtwork').src = track.thumbnail;
      document.getElementById('trackTitle').textContent = track.title;
      document.getElementById('trackArtist').textContent = track.author;

      const pos = data.player.positionMs || 0;
      const dur = data.player.durationMs || 1;
      const pct = Math.min((pos / dur) * 100, 100);

      document.getElementById('progressFill').style.width = `${pct}%`;
      document.getElementById('currentTime').textContent = fmtTime(pos);
      document.getElementById('totalTime').textContent = track.isLive ? 'LIVE' : fmtTime(dur);

      const playBtn = document.getElementById('ctrlPlayPause');
      playBtn.textContent = data.player.isPaused ? '▶️' : '⏸️';

      // Render Queue
      renderQueue(data.player.upcomingTracks);
    } else {
      emptyState.style.display = 'block';
      emptyState.innerHTML = '<div class="empty-icon">🎵</div><p>No active playback. Use <code>/play</code> in Discord to start!</p>';
      trackView.style.display = 'none';
      renderQueue([]);
    }
  } catch (err) {
    console.error('Error refreshing guild:', err);
  }
}

// Render queue list
function renderQueue(tracks) {
  const queueList = document.getElementById('queueList');
  if (!tracks || tracks.length === 0) {
    queueList.innerHTML = '<div class="empty-state">No upcoming tracks in the queue.</div>';
    return;
  }

  queueList.innerHTML = tracks
    .map(
      (t, idx) => `
    <div class="queue-item">
      <div style="display: flex; align-items: center;">
        <span class="queue-index">#${idx + 1}</span>
        <span class="queue-title">${t.title}</span>
      </div>
      <span class="queue-duration">${t.durationFormatted || '00:00'}</span>
    </div>
  `
    )
    .join('');
}

// Player Web Controls
function setupControls() {
  const sendControl = async (action, value = null) => {
    if (!activeGuildId) return;
    try {
      const res = await fetch(`/api/guilds/${activeGuildId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Action executed: ${action}`);
        await refreshGuildData();
      } else {
        showToast(data.error || 'Action failed', true);
      }
    } catch (e) {
      showToast('Control command error', true);
    }
  };

  document.getElementById('ctrlPlayPause').addEventListener('click', () => {
    const isPaused = document.getElementById('ctrlPlayPause').textContent === '▶️';
    sendControl(isPaused ? 'resume' : 'pause');
  });

  document.getElementById('ctrlSkip').addEventListener('click', () => sendControl('skip'));
  document.getElementById('ctrlStop').addEventListener('click', () => sendControl('stop'));
}

// Settings Form
function setupSettingsForm() {
  const form = document.getElementById('settingsForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeGuildId) return;

    const payload = {
      default_volume: document.getElementById('settingVolume').value,
      idle_timeout: document.getElementById('settingIdle').value,
      mode_247: document.getElementById('setting247').checked,
      autoplay_enabled: document.getElementById('settingAutoplay').checked,
    };

    try {
      const res = await fetch(`/api/guilds/${activeGuildId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully!');
      } else {
        showToast(data.error || 'Failed to save settings', true);
      }
    } catch (err) {
      showToast('Network error saving settings', true);
    }
  });
}

// Tabs
function setupTabs() {
  const tabQueueBtn = document.getElementById('tabQueueBtn');
  const tabSettingsBtn = document.getElementById('tabSettingsBtn');
  const queueContent = document.getElementById('queueContent');
  const settingsContent = document.getElementById('settingsContent');

  tabQueueBtn.addEventListener('click', () => {
    tabQueueBtn.classList.add('active');
    tabSettingsBtn.classList.remove('active');
    queueContent.style.display = 'block';
    settingsContent.style.display = 'none';
  });

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active');
    tabQueueBtn.classList.remove('active');
    settingsContent.style.display = 'block';
    queueContent.style.display = 'none';
  });
}
