import Chart from 'chart.js/auto';
import { fetchRealCountStats, subscribeToRealtimeChanges } from './supabase.js';

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
  // DOM ELEMENTS & STATS BINDINGS
  // -------------------------------------------------------------
  const statTotalVoters = document.getElementById('stat-total-voters');
  const statVotedCount = document.getElementById('stat-voted-count');
  const statTurnoutPercent = document.getElementById('stat-turnout-percent');
  const statUnvotedCount = document.getElementById('stat-unvoted-count');
  const statUnvotedPercent = document.getElementById('stat-unvoted-percent');

  const statSiswaVoted = document.getElementById('stat-siswa-voted');
  const statSiswaPercent = document.getElementById('stat-siswa-percent');
  const statSiswaBar = document.getElementById('stat-siswa-bar');
  const statSiswaUnvoted = document.getElementById('stat-siswa-unvoted');

  const statGuruVoted = document.getElementById('stat-guru-voted');
  const statGuruPercent = document.getElementById('stat-guru-percent');
  const statGuruBar = document.getElementById('stat-guru-bar');
  const statGuruUnvoted = document.getElementById('stat-guru-unvoted');

  const compareSiswaRate = document.getElementById('compare-siswa-rate');
  const compareGuruRate = document.getElementById('compare-guru-rate');
  const lastUpdatedTime = document.getElementById('last-updated-time');

  const btnRefresh = document.getElementById('btn-refresh');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // Chart Type State
  let currentChartType = 'bar'; // 'bar' or 'doughnut'
  const btnChartBar = document.getElementById('chart-type-bar');
  const btnChartDoughnut = document.getElementById('chart-type-doughnut');

  // Stage Display Mode State (Dark Projector)
  const btnStageMode = document.getElementById('btn-stage-mode');
  const stageModeIcon = document.getElementById('stage-mode-icon');
  let isStageMode = localStorage.getItem('rc_stage_mode') === 'true';

  // Category View State ('all', 'turnout', 'osis', 'ambalan')
  let currentActiveView = 'all';
  const viewTurnout = document.getElementById('view-turnout');
  const viewOsis = document.getElementById('view-osis');
  const viewAmbalan = document.getElementById('view-ambalan');

  const tabButtons = {
    all: document.getElementById('btn-view-all'),
    turnout: document.getElementById('btn-view-turnout'),
    osis: document.getElementById('btn-view-osis'),
    ambalan: document.getElementById('btn-view-ambalan')
  };

  // Auto-Slide (Presentation Slideshow Mode) State
  const btnAutoSlide = document.getElementById('btn-auto-slide');
  const autoSlideIcon = document.getElementById('auto-slide-icon');
  const autoSlideLabel = document.getElementById('auto-slide-label');
  const autoSlideProgressContainer = document.getElementById('auto-slide-progress-container');
  const autoSlideProgressBar = document.getElementById('auto-slide-progress-bar');

  let isAutoSlideActive = false;
  let autoSlideTimer = null;
  let autoSlideProgressAnim = null;
  const SLIDE_DURATION = 10000; // 10 seconds per slide
  const ROTATION_VIEWS = ['turnout', 'osis', 'ambalan'];
  let currentRotationIndex = 0;

  // Chart Instances Map
  const chartInstances = {
    osis: null,
    ambalan_putra: null,
    ambalan_putri: null,
    siswa_donut: null,
    guru_donut: null,
    turnout_compare: null
  };

  let cachedCandidates = [];
  let cachedSummary = null;

  // -------------------------------------------------------------
  // 1. STAGE DISPLAY MODE (DARK / LIGHT PROYEKTORE THEME)
  // -------------------------------------------------------------
  function applyStageMode(active) {
    isStageMode = active;
    localStorage.setItem('rc_stage_mode', active ? 'true' : 'false');
    
    if (active) {
      document.body.classList.add('stage-mode');
      if (stageModeIcon) stageModeIcon.setAttribute('data-lucide', 'sun');
      if (btnStageMode) {
        btnStageMode.classList.add('bg-slate-800', 'text-amber-300', 'border-slate-700');
        btnStageMode.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      }
    } else {
      document.body.classList.remove('stage-mode');
      if (stageModeIcon) stageModeIcon.setAttribute('data-lucide', 'moon');
      if (btnStageMode) {
        btnStageMode.classList.remove('bg-slate-800', 'text-amber-300', 'border-slate-700');
        btnStageMode.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      }
    }

    if (window.lucide) window.lucide.createIcons();
    rebuildAllCharts();
  }

  if (btnStageMode) {
    btnStageMode.addEventListener('click', () => {
      applyStageMode(!isStageMode);
    });
  }

  // Initial stage mode check
  if (isStageMode) {
    applyStageMode(true);
  }

  // -------------------------------------------------------------
  // 2. CATEGORY VIEW SWITCHER LOGIC
  // -------------------------------------------------------------
  function setActiveView(viewKey, isManualClick = false) {
    currentActiveView = viewKey;

    // Update Tab Styles
    Object.keys(tabButtons).forEach(key => {
      const btn = tabButtons[key];
      if (!btn) return;
      if (key === viewKey) {
        btn.classList.add('active', 'bg-[#007979]', 'text-white', 'shadow-xs');
        btn.classList.remove('text-slate-600', 'hover:text-slate-900');
      } else {
        btn.classList.remove('active', 'bg-[#007979]', 'text-white', 'shadow-xs');
        btn.classList.add('text-slate-600', 'hover:text-slate-900');
      }
    });

    // Toggle Section Visibility
    if (viewKey === 'all') {
      if (viewTurnout) { viewTurnout.classList.remove('view-hidden'); viewTurnout.classList.add('view-visible'); }
      if (viewOsis) { viewOsis.classList.remove('view-hidden'); viewOsis.classList.add('view-visible'); }
      if (viewAmbalan) { viewAmbalan.classList.remove('view-hidden'); viewAmbalan.classList.add('view-visible'); }
    } else if (viewKey === 'turnout') {
      if (viewTurnout) { viewTurnout.classList.remove('view-hidden'); viewTurnout.classList.add('view-visible'); }
      if (viewOsis) { viewOsis.classList.add('view-hidden'); viewOsis.classList.remove('view-visible'); }
      if (viewAmbalan) { viewAmbalan.classList.add('view-hidden'); viewAmbalan.classList.remove('view-visible'); }
    } else if (viewKey === 'osis') {
      if (viewTurnout) { viewTurnout.classList.add('view-hidden'); viewTurnout.classList.remove('view-visible'); }
      if (viewOsis) { viewOsis.classList.remove('view-hidden'); viewOsis.classList.add('view-visible'); }
      if (viewAmbalan) { viewAmbalan.classList.add('view-hidden'); viewAmbalan.classList.remove('view-visible'); }
    } else if (viewKey === 'ambalan') {
      if (viewTurnout) { viewTurnout.classList.add('view-hidden'); viewTurnout.classList.remove('view-visible'); }
      if (viewOsis) { viewOsis.classList.add('view-hidden'); viewOsis.classList.remove('view-visible'); }
      if (viewAmbalan) { viewAmbalan.classList.remove('view-hidden'); viewAmbalan.classList.add('view-visible'); }
    }

    // Resize active visible charts so canvas fills perfectly
    setTimeout(() => {
      Object.keys(chartInstances).forEach(k => {
        if (chartInstances[k]) {
          try { chartInstances[k].resize(); } catch (e) {}
        }
      });
    }, 100);

    // If manual click while auto slide is active, sync rotation index
    if (isManualClick && isAutoSlideActive) {
      const idx = ROTATION_VIEWS.indexOf(viewKey);
      if (idx !== -1) {
        currentRotationIndex = idx;
      }
      resetAutoSlideTimer();
    }
  }

  // Bind tab click events
  if (tabButtons.all) tabButtons.all.addEventListener('click', () => setActiveView('all', true));
  if (tabButtons.turnout) tabButtons.turnout.addEventListener('click', () => setActiveView('turnout', true));
  if (tabButtons.osis) tabButtons.osis.addEventListener('click', () => setActiveView('osis', true));
  if (tabButtons.ambalan) tabButtons.ambalan.addEventListener('click', () => setActiveView('ambalan', true));

  // -------------------------------------------------------------
  // 3. AUTO-SLIDE ENGINE (SLIDESHOW UNTUK LAYAR PANGGUNG)
  // -------------------------------------------------------------
  function startAutoSlide() {
    isAutoSlideActive = true;
    if (autoSlideIcon) autoSlideIcon.setAttribute('data-lucide', 'pause');
    if (autoSlideLabel) autoSlideLabel.textContent = 'Jeda Putar';
    if (btnAutoSlide) {
      btnAutoSlide.classList.add('bg-teal-50', 'border-teal-300', 'text-[#007979]');
      btnAutoSlide.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
    }
    if (autoSlideProgressContainer) autoSlideProgressContainer.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    // If starting from 'all', default to first rotation item
    if (currentActiveView === 'all') {
      currentRotationIndex = 0;
      setActiveView(ROTATION_VIEWS[currentRotationIndex]);
    } else {
      const curIdx = ROTATION_VIEWS.indexOf(currentActiveView);
      currentRotationIndex = curIdx !== -1 ? curIdx : 0;
    }

    resetAutoSlideTimer();
  }

  function stopAutoSlide() {
    isAutoSlideActive = false;
    if (autoSlideIcon) autoSlideIcon.setAttribute('data-lucide', 'play');
    if (autoSlideLabel) autoSlideLabel.textContent = 'Putar Otomatis';
    if (btnAutoSlide) {
      btnAutoSlide.classList.remove('bg-teal-50', 'border-teal-300', 'text-[#007979]');
      btnAutoSlide.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
    }
    if (autoSlideProgressContainer) autoSlideProgressContainer.classList.add('hidden');
    if (autoSlideProgressBar) {
      autoSlideProgressBar.style.width = '0%';
      autoSlideProgressBar.style.transition = 'none';
    }
    if (autoSlideTimer) {
      clearTimeout(autoSlideTimer);
      autoSlideTimer = null;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function resetAutoSlideTimer() {
    if (!isAutoSlideActive) return;

    if (autoSlideTimer) clearTimeout(autoSlideTimer);

    if (autoSlideProgressBar) {
      autoSlideProgressBar.style.transition = 'none';
      autoSlideProgressBar.style.width = '0%';
      // Force reflow
      void autoSlideProgressBar.offsetWidth;
      autoSlideProgressBar.style.transition = `width ${SLIDE_DURATION}ms linear`;
      autoSlideProgressBar.style.width = '100%';
    }

    autoSlideTimer = setTimeout(() => {
      if (!isAutoSlideActive) return;
      currentRotationIndex = (currentRotationIndex + 1) % ROTATION_VIEWS.length;
      const nextView = ROTATION_VIEWS[currentRotationIndex];
      setActiveView(nextView);
      resetAutoSlideTimer();
    }, SLIDE_DURATION);
  }

  if (btnAutoSlide) {
    btnAutoSlide.addEventListener('click', () => {
      if (isAutoSlideActive) {
        stopAutoSlide();
      } else {
        startAutoSlide();
      }
    });
  }

  // -------------------------------------------------------------
  // 4. CHART TYPE TOGGLE (BAR / DOUGHNUT)
  // -------------------------------------------------------------
  if (btnChartBar && btnChartDoughnut) {
    btnChartBar.addEventListener('click', () => {
      if (currentChartType === 'bar') return;
      currentChartType = 'bar';
      btnChartBar.className = 'px-2.5 py-1 rounded-lg font-bold bg-[#007979] text-white shadow-xs transition-all flex items-center space-x-1 font-heading cursor-pointer';
      btnChartDoughnut.className = 'px-2.5 py-1 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 font-heading cursor-pointer';
      rebuildAllCharts();
      if (window.lucide) window.lucide.createIcons();
    });

    btnChartDoughnut.addEventListener('click', () => {
      if (currentChartType === 'doughnut') return;
      currentChartType = 'doughnut';
      btnChartDoughnut.className = 'px-2.5 py-1 rounded-lg font-bold bg-[#007979] text-white shadow-xs transition-all flex items-center space-x-1 font-heading cursor-pointer';
      btnChartBar.className = 'px-2.5 py-1 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1 font-heading cursor-pointer';
      rebuildAllCharts();
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // -------------------------------------------------------------
  // 5. DATA ENGINE & DASHBOARD UPDATE
  // -------------------------------------------------------------
  async function updateDashboard() {
    try {
      const data = await fetchRealCountStats();
      const { candidates, summary } = data;
      cachedCandidates = candidates;
      cachedSummary = summary;

      // 1. Update Participation Metrics (Kategori 1)
      if (statTotalVoters) statTotalVoters.textContent = summary.totalVoters.toLocaleString('id-ID');
      if (statVotedCount) statVotedCount.textContent = summary.votedCount.toLocaleString('id-ID');
      if (statTurnoutPercent) statTurnoutPercent.textContent = `${summary.turnoutPercent}%`;

      const unvotedCount = Math.max(0, summary.totalVoters - summary.votedCount);
      const unvotedPercent = summary.totalVoters > 0 ? ((unvotedCount / summary.totalVoters) * 100).toFixed(1) : 0;
      if (statUnvotedCount) statUnvotedCount.textContent = unvotedCount.toLocaleString('id-ID');
      if (statUnvotedPercent) statUnvotedPercent.textContent = `(${unvotedPercent}%)`;

      // Siswa Details
      const unvotedSiswa = Math.max(0, summary.totalSiswa - summary.votedSiswa);
      if (statSiswaVoted) statSiswaVoted.textContent = `${summary.votedSiswa} / ${summary.totalSiswa}`;
      if (statSiswaPercent) statSiswaPercent.textContent = `${summary.siswaPercent}%`;
      if (statSiswaBar) statSiswaBar.style.width = `${summary.siswaPercent}%`;
      if (statSiswaUnvoted) statSiswaUnvoted.textContent = `${unvotedSiswa} Siswa`;

      // Guru / Pembina Details
      const unvotedGuru = Math.max(0, summary.totalGuru - summary.votedGuru);
      if (statGuruVoted) statGuruVoted.textContent = `${summary.votedGuru} / ${summary.totalGuru}`;
      if (statGuruPercent) statGuruPercent.textContent = `${summary.guruPercent}%`;
      if (statGuruBar) statGuruBar.style.width = `${summary.guruPercent}%`;
      if (statGuruUnvoted) statGuruUnvoted.textContent = `${unvotedGuru} Pembina`;

      // Comparative Rates
      if (compareSiswaRate) compareSiswaRate.textContent = `${summary.siswaPercent}%`;
      if (compareGuruRate) compareGuruRate.textContent = `${summary.guruPercent}%`;

      if (lastUpdatedTime) lastUpdatedTime.textContent = summary.lastUpdated;

      // 2. Render Turnout Sub-Charts (Siswa & Guru Donut + Comparison)
      renderTurnoutDonutChart('chart-siswa-donut', 'siswa_donut', summary.votedSiswa, unvotedSiswa, '#007979', 'Siswa');
      renderTurnoutDonutChart('chart-guru-donut', 'guru_donut', summary.votedGuru, unvotedGuru, '#D97706', 'Pembina');
      renderTurnoutComparisonChart(summary.siswaPercent, summary.guruPercent);

      // 3. Render Candidate Charts (Kategori 2 & 3)
      const osisPalette = ['#007979', '#0284C7', '#0D9488', '#009688', '#005F5F', '#20B2AA'];
      const ambalanPaPalette = ['#D97706', '#EA580C', '#CA8A04', '#B45309', '#C2410C', '#A16207'];
      const ambalanPiPalette = ['#E11D48', '#DB2777', '#9333EA', '#BE185D', '#C026D3', '#9F1239'];

      updateOrRenderCandidateChart('osis', 'chart-osis', 'chart-total-osis', candidates, osisPalette);
      updateOrRenderCandidateChart('ambalan_putra', 'chart-pa', 'chart-total-pa', candidates, ambalanPaPalette);
      updateOrRenderCandidateChart('ambalan_putri', 'chart-pi', 'chart-total-pi', candidates, ambalanPiPalette);

      // 4. Render Candidate Cards
      renderCategoryCards('osis', candidates, 'realcount-grid-osis', 'total-osis-votes-badge', osisPalette);
      renderCategoryCards('ambalan_putra', candidates, 'realcount-grid-pa', 'total-pa-votes-badge', ambalanPaPalette);
      renderCategoryCards('ambalan_putri', candidates, 'realcount-grid-pi', 'total-pi-votes-badge', ambalanPiPalette);

      if (window.lucide) {
        window.lucide.createIcons();
      }

    } catch (err) {
      console.error('Failed to load real count stats:', err);
    }
  }

  // -------------------------------------------------------------
  // 6. CHARTS BUILDER & RENDERERS
  // -------------------------------------------------------------
  function getThemeColors() {
    if (isStageMode) {
      return {
        textColor: '#cbd5e1',
        titleColor: '#f8fafc',
        gridColor: 'rgba(255, 255, 255, 0.08)',
        emptySlice: '#334155'
      };
    }
    return {
      textColor: '#475569',
      titleColor: '#0f172a',
      gridColor: 'rgba(226, 232, 240, 0.9)',
      emptySlice: '#e2e8f0'
    };
  }

  function rebuildAllCharts() {
    // Destroy all existing charts
    Object.keys(chartInstances).forEach(k => {
      if (chartInstances[k]) {
        try { chartInstances[k].destroy(); } catch (e) {}
        chartInstances[k] = null;
      }
    });

    if (cachedSummary) {
      const unvotedSiswa = Math.max(0, cachedSummary.totalSiswa - cachedSummary.votedSiswa);
      const unvotedGuru = Math.max(0, cachedSummary.totalGuru - cachedSummary.votedGuru);
      renderTurnoutDonutChart('chart-siswa-donut', 'siswa_donut', cachedSummary.votedSiswa, unvotedSiswa, '#007979', 'Siswa');
      renderTurnoutDonutChart('chart-guru-donut', 'guru_donut', cachedSummary.votedGuru, unvotedGuru, '#D97706', 'Pembina');
      renderTurnoutComparisonChart(cachedSummary.siswaPercent, cachedSummary.guruPercent);
    }

    if (cachedCandidates.length > 0) {
      const osisPalette = ['#007979', '#0284C7', '#0D9488', '#009688', '#005F5F', '#20B2AA'];
      const ambalanPaPalette = ['#D97706', '#EA580C', '#CA8A04', '#B45309', '#C2410C', '#A16207'];
      const ambalanPiPalette = ['#E11D48', '#DB2777', '#9333EA', '#BE185D', '#C026D3', '#9F1239'];

      updateOrRenderCandidateChart('osis', 'chart-osis', 'chart-total-osis', cachedCandidates, osisPalette);
      updateOrRenderCandidateChart('ambalan_putra', 'chart-pa', 'chart-total-pa', cachedCandidates, ambalanPaPalette);
      updateOrRenderCandidateChart('ambalan_putri', 'chart-pi', 'chart-total-pi', cachedCandidates, ambalanPiPalette);
    }
  }

  // Mini Donut Chart for Siswa / Pembina
  function renderTurnoutDonutChart(canvasId, instanceKey, voted, unvoted, activeColor, labelRole) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = getThemeColors();
    const total = voted + unvoted;
    const pct = total > 0 ? ((voted / total) * 100).toFixed(1) : 0;

    if (chartInstances[instanceKey]) {
      chartInstances[instanceKey].data.datasets[0].data = [voted, unvoted];
      chartInstances[instanceKey].data.datasets[0].backgroundColor = [activeColor, theme.emptySlice];
      chartInstances[instanceKey].update();
      return;
    }

    const ctx = canvas.getContext('2d');
    chartInstances[instanceKey] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sudah Memilih', 'Belum Memilih'],
        datasets: [{
          data: [voted, unvoted],
          backgroundColor: [activeColor, theme.emptySlice],
          borderWidth: 0,
          cutout: '72%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: "'Poppins', sans-serif", size: 10, weight: '600' },
              boxWidth: 10,
              padding: 8
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            bodyFont: { family: "'Inter', sans-serif" },
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const p = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${val.toLocaleString('id-ID')} ${labelRole} (${p}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Comparison Bar Chart for Siswa vs Pembina Turnout
  function renderTurnoutComparisonChart(siswaPct, guruPct) {
    const canvas = document.getElementById('chart-turnout-compare');
    if (!canvas) return;

    const theme = getThemeColors();
    const sVal = parseFloat(siswaPct) || 0;
    const gVal = parseFloat(guruPct) || 0;

    if (chartInstances.turnout_compare) {
      chartInstances.turnout_compare.data.datasets[0].data = [sVal, gVal];
      chartInstances.turnout_compare.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    chartInstances.turnout_compare = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Siswa', 'Guru & Pembina'],
        datasets: [{
          label: 'Partisipasi (%)',
          data: [sVal, gVal],
          backgroundColor: ['#007979', '#D97706'],
          borderRadius: 8,
          borderWidth: 0,
          barThickness: 28
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` Partisipasi: ${ctx.raw}%`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: (val) => `${val}%`
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: theme.textColor,
              font: { family: "'Poppins', sans-serif", size: 11, weight: 'bold' }
            }
          }
        }
      }
    });
  }

  // OSIS & Ambalan Main Charts
  function updateOrRenderCandidateChart(posKey, canvasId, totalLabelId, allCandidates, palette) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const list = allCandidates
      .filter(c => c.position === posKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    const totalVotes = list.reduce((acc, c) => acc + (c.vote_count || 0), 0);
    const totalEl = document.getElementById(totalLabelId);
    if (totalEl) totalEl.textContent = `${totalVotes.toLocaleString('id-ID')} suara`;

    const labels = list.map(c => `#${String(c.candidate_number).padStart(2, '0')} ${c.name.split('&')[0].trim().substring(0, 16)}`);
    const dataValues = list.map(c => c.vote_count || 0);
    const backgroundColors = list.map((_, idx) => palette[idx % palette.length]);

    const theme = getThemeColors();

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
          borderColor: currentChartType === 'bar' ? backgroundColors : (isStageMode ? '#0f172a' : '#ffffff'),
          borderWidth: currentChartType === 'bar' ? 0 : 3,
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
              color: theme.textColor,
              font: { family: "'Poppins', sans-serif", size: 11, weight: '600' },
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
              color: theme.textColor,
              font: { family: "'Poppins', sans-serif", size: 10, weight: '600' }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: "'Inter', sans-serif", size: 10 },
              precision: 0
            }
          }
        } : {}
      }
    };

    chartInstances[posKey] = new Chart(ctx, chartConfig);
  }

  // -------------------------------------------------------------
  // 7. CANDIDATE CARDS RENDERER
  // -------------------------------------------------------------
  function renderCategoryCards(posKey, allCandidates, containerId, totalBadgeId, palette = []) {
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
      if (candidates.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-8 text-center text-slate-400">
            <p class="text-xs">Belum ada kandidat terdaftar untuk kategori ini.</p>
          </div>
        `;
        return;
      }

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
              ? 'border-teal-500 ring-2 ring-teal-500/30 shadow-md' 
              : 'border-slate-200 shadow-xs'
          }">
            
            <!-- Leader Ribbon with Crown -->
            ${isLeader ? `
              <div class="absolute -top-6 -right-6 w-24 h-24 overflow-hidden pointer-events-none z-10">
                <div class="absolute transform rotate-45 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] py-1.5 right-[-32px] top-[22px] w-[130px] text-center shadow-sm uppercase tracking-wider font-heading flex items-center justify-center space-x-1">
                  <span>👑</span>
                  <span>UNGGUL</span>
                </div>
              </div>
            ` : ''}

            <div>
              <!-- Top Candidate Row with Portrait Photo -->
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

  // -------------------------------------------------------------
  // 8. REALTIME ENGINE & SINKRONISASI
  // -------------------------------------------------------------
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
    stopAutoSlide();
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

  // Initial Check
  checkAdminAccess();

  window.addEventListener('beforeunload', () => {
    stopRealtimeEngine();
    Object.keys(chartInstances).forEach(k => {
      if (chartInstances[k]) chartInstances[k].destroy();
    });
  });
});
