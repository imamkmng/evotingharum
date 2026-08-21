import Chart from 'chart.js/auto';
import { fetchRealCountStats, subscribeToRealtimeChanges, fetchElectionSettings } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  // Sync custom school background image if set
  try {
    const customBg = localStorage.getItem('custom_bg_school');
    const bgImgEl = document.getElementById('school-bg-image');
    if (customBg && bgImgEl) {
      bgImgEl.src = customBg;
    }
  } catch (e) {}

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // ADMIN AUTHENTICATION GUARD (Real Count is Admin-Only)
  // -------------------------------------------------------------
  const authGate = document.getElementById('realcount-auth-gate');
  const mainContainer = document.getElementById('realcount-main-container');
  const formAuth = document.getElementById('form-realcount-auth');
  const rcPasswordInput = document.getElementById('rc-password');
  const rcAuthError = document.getElementById('rc-auth-error');
  const btnRcLogout = document.getElementById('btn-rc-logout');

  let intervalId = null;
  let unsubscribeRealtime = () => {};

  function checkAdminAccess() {
    const isLogged = sessionStorage.getItem('evote_admin_logged') === 'true';
    if (isLogged) {
      if (authGate) authGate.classList.add('hidden');
      if (mainContainer) mainContainer.classList.remove('hidden');
      startRealtimeEngine();
    } else {
      if (authGate) authGate.classList.remove('hidden');
      if (mainContainer) mainContainer.classList.add('hidden');
      stopRealtimeEngine();
    }
  }

  if (formAuth) {
    formAuth.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = rcPasswordInput.value.trim();
      if (pass === 'admin123' || pass === 'admin') {
        sessionStorage.setItem('evote_admin_logged', 'true');
        if (rcAuthError) rcAuthError.classList.add('hidden');
        checkAdminAccess();
      } else {
        if (rcAuthError) rcAuthError.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  if (btnRcLogout) {
    btnRcLogout.addEventListener('click', () => {
      sessionStorage.removeItem('evote_admin_logged');
      checkAdminAccess();
    });
  }

  // -------------------------------------------------------------
  // DASHBOARD & CHARTS LOGIC
  // -------------------------------------------------------------
  const statTotalVoters = document.getElementById('stat-total-voters');
  const statVotedCount = document.getElementById('stat-voted-count');
  const statTurnoutPercent = document.getElementById('stat-turnout-percent');
  const statSiswaVoted = document.getElementById('stat-siswa-voted');
  const statSiswaPercent = document.getElementById('stat-siswa-percent');
  const statSiswaBar = document.getElementById('stat-siswa-bar');
  const statGuruVoted = document.getElementById('stat-guru-voted');
  const statGuruPercent = document.getElementById('stat-guru-percent');
  const statGuruBar = document.getElementById('stat-guru-bar');
  const lastUpdatedTime = document.getElementById('last-updated-time');

  const btnRefresh = document.getElementById('btn-refresh');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // Chart Type State
  let currentChartType = 'bar'; // 'bar' or 'doughnut'
  const btnChartBar = document.getElementById('chart-type-bar');
  const btnChartDoughnut = document.getElementById('chart-type-doughnut');

  // Chart Instances
  const chartInstances = {
    osis: null,
    ambalan_putra: null,
    ambalan_putri: null
  };

  let cachedCandidates = [];

  // Switch Chart Types
  if (btnChartBar && btnChartDoughnut) {
    btnChartBar.addEventListener('click', () => {
      if (currentChartType === 'bar') return;
      currentChartType = 'bar';
      btnChartBar.className = 'px-3 py-1.5 rounded-lg font-bold bg-[#007979] text-white shadow-xs transition-all flex items-center space-x-1 font-heading cursor-pointer';
      btnChartDoughnut.className = 'px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 font-heading cursor-pointer';
      rebuildAllCharts();
      if (window.lucide) window.lucide.createIcons();
    });

    btnChartDoughnut.addEventListener('click', () => {
      if (currentChartType === 'doughnut') return;
      currentChartType = 'doughnut';
      btnChartDoughnut.className = 'px-3 py-1.5 rounded-lg font-bold bg-[#007979] text-white shadow-xs transition-all flex items-center space-x-1 font-heading cursor-pointer';
      btnChartBar.className = 'px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 font-heading cursor-pointer';
      rebuildAllCharts();
      if (window.lucide) window.lucide.createIcons();
    });
  }

  async function updateDashboard() {
    try {
      const data = await fetchRealCountStats();
      const { candidates, summary } = data;
      cachedCandidates = candidates;

      // 1. Update Participation Summary
      if (statTotalVoters) statTotalVoters.textContent = summary.totalVoters.toLocaleString('id-ID');
      if (statVotedCount) statVotedCount.textContent = summary.votedCount.toLocaleString('id-ID');
      if (statTurnoutPercent) statTurnoutPercent.textContent = `(${summary.turnoutPercent}%)`;
      
      if (statSiswaVoted) statSiswaVoted.textContent = `${summary.votedSiswa} / ${summary.totalSiswa}`;
      if (statSiswaPercent) statSiswaPercent.textContent = `${summary.siswaPercent}%`;
      if (statSiswaBar) statSiswaBar.style.width = `${summary.siswaPercent}%`;

      if (statGuruVoted) statGuruVoted.textContent = `${summary.votedGuru} / ${summary.totalGuru}`;
      if (statGuruPercent) statGuruPercent.textContent = `${summary.guruPercent}%`;
      if (statGuruBar) statGuruBar.style.width = `${summary.guruPercent}%`;

      if (lastUpdatedTime) lastUpdatedTime.textContent = summary.lastUpdated;

      // 2. Render / Update Charts with distinct candidate colors
      const osisPalette = ['#007979', '#0284C7', '#0D9488', '#009688', '#005F5F', '#20B2AA'];
      const ambalanPaPalette = ['#D97706', '#EA580C', '#CA8A04', '#B45309', '#C2410C', '#A16207'];
      const ambalanPiPalette = ['#E11D48', '#DB2777', '#9333EA', '#BE185D', '#C026D3', '#9F1239'];

      updateOrRenderChart('osis', 'chart-osis', 'chart-total-osis', candidates, osisPalette);
      updateOrRenderChart('ambalan_putra', 'chart-pa', 'chart-total-pa', candidates, ambalanPaPalette);
      updateOrRenderChart('ambalan_putri', 'chart-pi', 'chart-total-pi', candidates, ambalanPiPalette);

      // 3. Render Cards
      renderCategoryCards('osis', candidates, 'realcount-grid-osis', 'total-osis-votes-badge', 'teal', osisPalette);
      renderCategoryCards('ambalan_putra', candidates, 'realcount-grid-pa', 'total-pa-votes-badge', 'amber', ambalanPaPalette);
      renderCategoryCards('ambalan_putri', candidates, 'realcount-grid-pi', 'total-pi-votes-badge', 'rose', ambalanPiPalette);

      if (window.lucide) {
        window.lucide.createIcons();
      }

    } catch (err) {
      console.error('Failed to load real count stats:', err);
    }
  }

  function rebuildAllCharts() {
    if (cachedCandidates.length === 0) return;
    ['osis', 'ambalan_putra', 'ambalan_putri'].forEach(k => {
      if (chartInstances[k]) {
        chartInstances[k].destroy();
        chartInstances[k] = null;
      }
    });

    const osisPalette = ['#007979', '#0284C7', '#0D9488', '#009688', '#005F5F', '#20B2AA'];
    const ambalanPaPalette = ['#D97706', '#EA580C', '#CA8A04', '#B45309', '#C2410C', '#A16207'];
    const ambalanPiPalette = ['#E11D48', '#DB2777', '#9333EA', '#BE185D', '#C026D3', '#9F1239'];

    updateOrRenderChart('osis', 'chart-osis', 'chart-total-osis', cachedCandidates, osisPalette);
    updateOrRenderChart('ambalan_putra', 'chart-pa', 'chart-total-pa', cachedCandidates, ambalanPaPalette);
    updateOrRenderChart('ambalan_putri', 'chart-pi', 'chart-total-pi', cachedCandidates, ambalanPiPalette);
  }

  function updateOrRenderChart(posKey, canvasId, totalLabelId, allCandidates, palette) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const list = allCandidates
      .filter(c => c.position === posKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    const totalVotes = list.reduce((acc, c) => acc + (c.vote_count || 0), 0);
    const totalEl = document.getElementById(totalLabelId);
    if (totalEl) totalEl.textContent = `${totalVotes.toLocaleString('id-ID')} suara`;

    const labels = list.map(c => `#${String(c.candidate_number).padStart(2, '0')} ${c.name.split('&')[0].trim().substring(0, 14)}`);
    const dataValues = list.map(c => c.vote_count || 0);
    const backgroundColors = list.map((_, idx) => palette[idx % palette.length]);

    // If chart already exists with matching type, update data directly
    if (chartInstances[posKey] && chartInstances[posKey].config.type === currentChartType) {
      chartInstances[posKey].data.labels = labels;
      chartInstances[posKey].data.datasets[0].data = dataValues;
      chartInstances[posKey].data.datasets[0].backgroundColor = backgroundColors;
      chartInstances[posKey].update();
      return;
    }

    // Destroy existing chart if type changed
    if (chartInstances[posKey]) {
      chartInstances[posKey].destroy();
    }

    const ctx = canvas.getContext('2d');

    const chartConfig = {
      type: currentChartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Perolehan Suara',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: currentChartType === 'bar' ? backgroundColors : '#ffffff',
          borderWidth: currentChartType === 'bar' ? 0 : 2,
          borderRadius: currentChartType === 'bar' ? 8 : 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: currentChartType === 'doughnut',
            position: 'bottom',
            labels: {
              color: '#334155',
              font: { family: "'Poppins', 'Inter', sans-serif", size: 11, weight: '600' },
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#ffffff',
            titleFont: { family: "'Poppins', sans-serif", weight: 'bold' },
            bodyColor: '#cbd5e1',
            bodyFont: { family: "'Inter', sans-serif" },
            padding: 10,
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const pct = totalVotes > 0 ? ((val / totalVotes) * 100).toFixed(1) : 0;
                return ` ${val.toLocaleString('id-ID')} suara (${pct}%)`;
              }
            }
          }
        },
        scales: currentChartType === 'bar' ? {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#475569',
              font: { family: "'Poppins', 'Inter', sans-serif", size: 10, weight: '600' }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.9)' },
            ticks: {
              color: '#475569',
              font: { family: "'Inter', sans-serif", size: 10 },
              precision: 0
            }
          }
        } : {}
      }
    };

    chartInstances[posKey] = new Chart(ctx, chartConfig);
  }

  function renderCategoryCards(posKey, allCandidates, containerId, totalBadgeId, colorTheme, palette = []) {
    const container = document.getElementById(containerId);
    const badge = document.getElementById(totalBadgeId);

    const candidates = allCandidates
      .filter(c => c.position === posKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    const totalVotes = candidates.reduce((acc, c) => acc + (c.vote_count || 0), 0);
    if (badge) badge.textContent = `Total: ${totalVotes.toLocaleString('id-ID')} Suara`;

    // Find highest vote count for leader badge
    const maxVotes = Math.max(...candidates.map(c => c.vote_count || 0), 0);

    if (container) {
      container.innerHTML = candidates.map((c, idx) => {
        const count = c.vote_count || 0;
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
        const isLeader = maxVotes > 0 && count === maxVotes;
        const numFormatted = String(c.candidate_number).padStart(2, '0');
        const fallbackImg = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
        const photoSrc = c.image_url || fallbackImg;
        const candColor = palette[idx % palette.length] || '#007979';

        return `
          <div class="white-card rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
            isLeader 
              ? 'border-[#007979] ring-2 ring-[#007979]/20 shadow-md bg-white' 
              : 'border-slate-200 bg-white shadow-xs'
          }">
            
            <!-- Leader Ribbon -->
            ${isLeader ? `
              <div class="absolute -top-6 -right-6 w-20 h-20 overflow-hidden pointer-events-none">
                <div class="absolute transform rotate-45 bg-amber-400 text-slate-950 font-black text-[9px] py-1 right-[-35px] top-[18px] w-[120px] text-center shadow-xs uppercase tracking-wider font-heading">
                  UNGGUL
                </div>
              </div>
            ` : ''}

            <div>
              <!-- Top Candidate Row with Clear Portrait Photo -->
              <div class="flex items-center space-x-3.5 mb-4">
                <div class="relative w-16 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs flex-shrink-0">
                  <img 
                    src="${photoSrc}" 
                    alt="${c.name}" 
                    class="w-full h-full object-cover object-top"
                    onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&auto=format&fit=crop&q=80'"
                  />
                </div>

                <div class="flex-1 min-w-0 pr-2">
                  <div class="flex items-center space-x-1.5">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono text-white font-heading" style="background-color: ${candColor};">
                      #${numFormatted}
                    </span>
                    <span class="text-[11px] font-semibold text-slate-500 truncate">${c.class_grade || 'Kandidat'}</span>
                  </div>
                  <h3 class="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate mt-1.5 font-heading">${c.name}</h3>
                </div>
              </div>

              <!-- Vote Numbers -->
              <div class="bg-slate-50 rounded-xl p-3.5 border border-slate-200 mb-3 flex items-baseline justify-between">
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-heading">Perolehan Suara</span>
                  <span class="text-xl sm:text-2xl font-black text-slate-900 font-heading">${count.toLocaleString('id-ID')}</span>
                  <span class="text-xs text-slate-500 font-sans">suara</span>
                </div>
                <div class="text-right">
                  <span class="text-xl sm:text-2xl font-black font-heading" style="color: ${candColor};">${percentage}%</span>
                </div>
              </div>
            </div>

            <!-- Animated Progress Bar -->
            <div>
              <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div 
                  class="h-full rounded-full transition-all duration-700" 
                  style="width: ${percentage}%; background-color: ${candColor};"
                ></div>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  function startRealtimeEngine() {
    updateDashboard();

    if (!unsubscribeRealtime || typeof unsubscribeRealtime !== 'function') {
      unsubscribeRealtime = subscribeToRealtimeChanges(() => {
        updateDashboard();
      });
    }

    if (!intervalId) {
      intervalId = setInterval(updateDashboard, 5000);
    }
  }

  function stopRealtimeEngine() {
    if (unsubscribeRealtime && typeof unsubscribeRealtime === 'function') {
      unsubscribeRealtime();
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Manual Refresh
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.classList.add('animate-spin');
      updateDashboard().finally(() => {
        setTimeout(() => btnRefresh.classList.remove('animate-spin'), 500);
      });
    });
  }

  // Fullscreen Mode
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFull = !!document.fullscreenElement;
      btnFullscreen.innerHTML = isFull
        ? `<i data-lucide="minimize" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Keluar Layar Penuh</span>`
        : `<i data-lucide="maximize" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Layar Penuh</span>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Initial Auth Check
  checkAdminAccess();

  window.addEventListener('beforeunload', () => {
    stopRealtimeEngine();
    ['osis', 'ambalan_putra', 'ambalan_putri'].forEach(k => {
      if (chartInstances[k]) chartInstances[k].destroy();
    });
  });
});
