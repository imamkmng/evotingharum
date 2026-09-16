import Chart from 'chart.js/auto';
import confetti from 'canvas-confetti';
import { fetchRealCountStats, subscribeToRealtimeChanges, saveElectionSettings } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  // Sync custom school background image if set
  try {
    const customBg = localStorage.getItem('custom_bg_school');
    const bgImgEl = document.getElementById('school-bg-image');
    if (customBg && bgImgEl) {
      bgImgEl.src = customBg;
    }
  } catch (e) { }

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
  let unsubscribeRealtime = () => { };

  function checkAdminAccess() {
    let hasUrlBypass = false;
    try {
      const params = new URLSearchParams(window.location.search);
      hasUrlBypass = params.get('admin') === '1' || params.get('locked') === 'true' || params.get('preview') === '1' || params.get('kunci') === '1' || params.get('ceremony') === '1' || params.get('pengumuman') === '1';
    } catch (e) { }

    const isLogged = hasUrlBypass || sessionStorage.getItem('evote_admin_logged') === 'true' || localStorage.getItem('evote_admin_logged') === 'true';
    if (isLogged) {
      sessionStorage.setItem('evote_admin_logged', 'true');
      if (authGate) authGate.classList.add('hidden');
      if (mainContainer) mainContainer.classList.remove('hidden');
      startRealtimeEngine();

      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ceremony') === '1' || params.get('pengumuman') === '1') {
          setTimeout(() => {
            openCeremonyModal();
          }, 500);
        }
      } catch (e) { }
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
      if (pass === 'harumjayajayajaya' || pass === 'harumjayajayajaya') {
        sessionStorage.setItem('evote_admin_logged', 'true');
        localStorage.setItem('evote_admin_logged', 'true');
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
      localStorage.removeItem('evote_admin_logged');
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
          try { chartInstances[k].resize(); } catch (e) { }
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

      // Handle Lock Election Display & Padlock Status
      const isVotingActive = summary.isVotingActive !== false;
      const bannerElectionClosed = document.getElementById('banner-election-closed');
      const rcLiveBadge = document.getElementById('rc-live-badge');
      const rcLockBadge = document.getElementById('rc-lock-badge');
      const rcHeaderTitle = document.getElementById('rc-header-title');

      const btnRcToggleLock = document.getElementById('btn-rc-toggle-election-lock');
      const btnRcLockIcon = document.getElementById('btn-rc-lock-icon');
      const btnRcLockText = document.getElementById('btn-rc-lock-text');

      const noticeElectionLive = document.getElementById('notice-election-live');

      if (!isVotingActive) {
        if (noticeElectionLive) noticeElectionLive.classList.add('hidden');
        if (bannerElectionClosed) bannerElectionClosed.classList.remove('hidden');
        if (rcLiveBadge) rcLiveBadge.classList.add('hidden');
        if (rcLockBadge) rcLockBadge.classList.remove('hidden');
        if (rcHeaderTitle) rcHeaderTitle.textContent = 'HASIL AKHIR PEMILIHAN (TERKUNCI)';

        if (btnRcToggleLock) {
          btnRcToggleLock.className = 'px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-bold font-heading flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer';
          btnRcToggleLock.title = 'Buka Kembali Pemilihan';
        }
        if (btnRcLockIcon) {
          btnRcLockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>';
        }
        if (btnRcLockText) btnRcLockText.textContent = 'Buka Pemilihan';
      } else {
        if (noticeElectionLive) noticeElectionLive.classList.remove('hidden');
        if (bannerElectionClosed) bannerElectionClosed.classList.add('hidden');
        if (rcLiveBadge) rcLiveBadge.classList.remove('hidden');
        if (rcLockBadge) rcLockBadge.classList.add('hidden');
        if (rcHeaderTitle) rcHeaderTitle.textContent = 'LIVE REAL COUNT (ADMIN)';

        if (btnRcToggleLock) {
          btnRcToggleLock.className = 'px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white text-xs font-bold font-heading flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer';
          btnRcToggleLock.title = 'Tutup & Kunci Pemilihan';
        }
        if (btnRcLockIcon) {
          btnRcLockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
        }
        if (btnRcLockText) btnRcLockText.textContent = 'Kunci Pemilihan';
      }

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
      renderCategoryCards('osis', candidates, 'realcount-grid-osis', 'total-osis-votes-badge', osisPalette, isVotingActive);
      renderCategoryCards('ambalan_putra', candidates, 'realcount-grid-pa', 'total-pa-votes-badge', ambalanPaPalette, isVotingActive);
      renderCategoryCards('ambalan_putri', candidates, 'realcount-grid-pi', 'total-pi-votes-badge', ambalanPiPalette, isVotingActive);

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
        try { chartInstances[k].destroy(); } catch (e) { }
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
              label: function (context) {
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
  function renderCategoryCards(posKey, allCandidates, containerId, totalBadgeId, palette = [], isVotingActive = true) {
    const container = document.getElementById(containerId);
    const badge = document.getElementById(totalBadgeId);

    const candidates = allCandidates
      .filter(c => c.position === posKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    const totalVotes = candidates.reduce((acc, c) => acc + (c.vote_count || 0), 0);
    if (badge) {
      if (!isVotingActive) {
        badge.className = 'px-3 py-1 rounded-full text-xs font-black bg-rose-50 border border-rose-200 text-rose-700 inline-flex items-center space-x-1.5 font-heading shadow-2xs';
        badge.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span>Hasil Terkunci: ${totalVotes.toLocaleString('id-ID')} Suara</span>`;
      } else {
        badge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 border border-slate-200 text-slate-700 font-heading';
        badge.textContent = `Total: ${totalVotes.toLocaleString('id-ID')} Suara`;
      }
    }

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

        const ribbonText = !isVotingActive ? '🔒 TERPILIH' : '👑 UNGGUL';
        const ribbonBg = !isVotingActive
          ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-md'
          : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950';

        return `
          <div class="white-card rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${isLeader
            ? (!isVotingActive ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg' : 'border-teal-500 ring-2 ring-teal-500/30 shadow-md')
            : 'border-slate-200 shadow-xs'
          }">
            
            <!-- Leader / Winner Ribbon -->
            ${isLeader ? `
              <div class="absolute -top-6 -right-6 w-24 h-24 overflow-hidden pointer-events-none z-10">
                <div class="absolute transform rotate-45 ${ribbonBg} font-black text-[9px] py-1.5 right-[-32px] top-[22px] w-[130px] text-center shadow-sm uppercase tracking-wider font-heading flex items-center justify-center space-x-1">
                  <span>${ribbonText}</span>
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

  // -------------------------------------------------------------
  // 9. KONTROL KUNCI PEMILIHAN DARI REAL COUNT
  // -------------------------------------------------------------
  let isTogglingLock = false;

  async function handleToggleElectionLock(targetState) {
    if (isTogglingLock) return;

    const currentClosed = localStorage.getItem('evote_election_closed') === 'true';
    const currentActive = cachedSummary ? (cachedSummary.isVotingActive !== false) : !currentClosed;
    const willLock = targetState !== undefined ? !targetState : currentActive;

    const confirmMsg = willLock
      ? '⚠️ PERINGATAN: Apakah Anda yakin ingin MENUTUP & MENGUNCI pemilihan sekarang?\n\n' +
      '• Layar Real Count akan menampilkan tanda GEMBOK dan Hasil Akhir Resmi Terkunci.\n' +
      '• Akses bilik suara siswa dan guru akan dinonaktifkan.'
      : 'Konfirmasi: Apakah Anda ingin MEMBUKA KEMBALI pemungutan suara?\n\n' +
      '• Bilik suara akan kembali aktif menerima suara.\n' +
      '• Layar Real Count akan kembali berstatus LIVE.';

    if (!confirm(confirmMsg)) return;

    isTogglingLock = true;
    try {
      // 1. Update UI secara instan (0ms) tanpa menunggu network
      localStorage.setItem('evote_election_closed', willLock ? 'true' : 'false');
      if (cachedSummary) {
        cachedSummary.isVotingActive = !willLock;
      }

      const noticeElectionLive = document.getElementById('notice-election-live');
      const bannerElectionClosed = document.getElementById('banner-election-closed');
      const rcLiveBadge = document.getElementById('rc-live-badge');
      const rcLockBadge = document.getElementById('rc-lock-badge');
      const rcHeaderTitle = document.getElementById('rc-header-title');
      const btnRcToggleLock = document.getElementById('btn-rc-toggle-election-lock');
      const btnRcLockIcon = document.getElementById('btn-rc-lock-icon');
      const btnRcLockText = document.getElementById('btn-rc-lock-text');

      if (willLock) {
        if (noticeElectionLive) noticeElectionLive.classList.add('hidden');
        if (bannerElectionClosed) bannerElectionClosed.classList.remove('hidden');
        if (rcLiveBadge) rcLiveBadge.classList.add('hidden');
        if (rcLockBadge) rcLockBadge.classList.remove('hidden');
        if (rcHeaderTitle) rcHeaderTitle.textContent = 'HASIL AKHIR PEMILIHAN (TERKUNCI)';

        if (btnRcToggleLock) {
          btnRcToggleLock.className = 'px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-bold font-heading flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer';
          btnRcToggleLock.title = 'Buka Kembali Pemilihan';
        }
        if (btnRcLockIcon) {
          btnRcLockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>';
        }
        if (btnRcLockText) btnRcLockText.textContent = 'Buka Pemilihan';
      } else {
        if (noticeElectionLive) noticeElectionLive.classList.remove('hidden');
        if (bannerElectionClosed) bannerElectionClosed.classList.add('hidden');
        if (rcLiveBadge) rcLiveBadge.classList.remove('hidden');
        if (rcLockBadge) rcLockBadge.classList.add('hidden');
        if (rcHeaderTitle) rcHeaderTitle.textContent = 'LIVE REAL COUNT (ADMIN)';

        if (btnRcToggleLock) {
          btnRcToggleLock.className = 'px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white text-xs font-bold font-heading flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer';
          btnRcToggleLock.title = 'Tutup & Kunci Pemilihan';
        }
        if (btnRcLockIcon) {
          btnRcLockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
        }
        if (btnRcLockText) btnRcLockText.textContent = 'Kunci Pemilihan';
      }

      // 2. Simpan dan broadcast
      await saveElectionSettings({ is_voting_active: !willLock });
      await updateDashboard();

      alert(willLock
        ? '🔒 Pemilihan berhasil DITUTUP dan DIKUNCI!\n\nLayar Real Count kini menampilkan tanda GEMBOK dan Hasil Akhir Resmi Terkunci.'
        : '🔓 Pemilihan berhasil DIBUKA KEMBALI!\n\nBilik suara kini aktif menerima pemilih.');
    } catch (err) {
      alert('Gagal mengubah status pemilihan: ' + err.message);
    } finally {
      isTogglingLock = false;
    }
  }

  const btnRcToggleLock = document.getElementById('btn-rc-toggle-election-lock');
  if (btnRcToggleLock) {
    btnRcToggleLock.addEventListener('click', () => handleToggleElectionLock());
  }

  const btnBannerUnlock = document.getElementById('btn-banner-unlock');
  if (btnBannerUnlock) {
    btnBannerUnlock.addEventListener('click', () => handleToggleElectionLock(true));
  }

  const btnQuickLockNotice = document.getElementById('btn-quick-lock-notice');
  if (btnQuickLockNotice) {
    btnQuickLockNotice.addEventListener('click', () => handleToggleElectionLock(false));
  }

  // =========================================================================
  // DRAMATIC REVEAL CEREMONY SYSTEM (STAGE SHOW, WEB AUDIO & CONFETTI)
  // =========================================================================
  const ceremonyModal = document.getElementById('ceremony-modal');
  const ceremonyCanvas = document.getElementById('ceremony-confetti-canvas');
  const flashOverlay = document.getElementById('ceremony-flash-overlay');

  const btnOpenCeremony = document.getElementById('btn-open-ceremony');
  const btnBannerCeremony = document.getElementById('btn-banner-ceremony');
  const btnCloseCeremony = document.getElementById('btn-close-ceremony');
  const btnCeremonySoundToggle = document.getElementById('btn-ceremony-sound-toggle');
  const ceremonySoundIcon = document.getElementById('ceremony-sound-icon');
  const ceremonySoundText = document.getElementById('ceremony-sound-text');
  const btnCeremonyFullscreen = document.getElementById('btn-ceremony-fullscreen');

  // Screens
  const screenSetup = document.getElementById('ceremony-screen-setup');
  const screenCountdown = document.getElementById('ceremony-screen-countdown');
  const screenStage = document.getElementById('ceremony-screen-stage');

  // Screen 1: Setup Elements
  const btnStartCeremonyRun = document.getElementById('btn-start-ceremony-run');
  const countdownSelect = document.getElementById('ceremony-countdown-select');
  const raceDurationSelect = document.getElementById('ceremony-race-duration-select');

  // Screen 2: Countdown Elements
  const countdownCategoryLabel = document.getElementById('ceremony-countdown-category-label');
  const countdownNumberEl = document.getElementById('ceremony-countdown-number');

  // Screen 3: Stage Elements
  const stageBadgeIcon = document.getElementById('ceremony-stage-badge-icon');
  const stageCategoryName = document.getElementById('ceremony-stage-category-name');
  const stageTotalVotes = document.getElementById('ceremony-stage-total-votes');
  const winnerBanner = document.getElementById('ceremony-winner-banner');
  const winnerCongratsText = document.getElementById('ceremony-winner-congrats-text');
  const winnerNameText = document.getElementById('ceremony-winner-name-text');
  const candidatesGrid = document.getElementById('ceremony-candidates-grid');

  // Stage Bottom Controls
  const btnCeremonyReplay = document.getElementById('btn-ceremony-replay');
  const btnCeremonyChooseOther = document.getElementById('btn-ceremony-choose-other');
  const btnCeremonyNextCat = document.getElementById('btn-ceremony-next-cat');
  const ceremonyNextCatLabel = document.getElementById('ceremony-next-cat-label');
  const btnCeremonyFinishExit = document.getElementById('btn-ceremony-finish-exit');

  // State
  let audioCtx = null;
  let isCeremonySoundEnabled = true;
  let ceremonyConfetti = null;
  let countdownInterval = null;
  let raceAnimId = null;

  let ceremonyCurrentCatKey = 'osis';
  let isSequentialCeremony = true;

  if (ceremonyCanvas && confetti) {
    try {
      ceremonyConfetti = confetti.create(ceremonyCanvas, { resize: true, useWorker: true });
    } catch (e) {
      console.warn('Canvas confetti setup error:', e);
    }
  }

  const CEREMONY_CATEGORIES = {
    osis: {
      key: 'osis',
      name: 'Ketua OSIS',
      title: 'Hasil Pemilihan Ketua OSIS',
      congrats: 'Selamat Kepada Ketua OSIS Terpilih!',
      badgeIcon: '🎖️',
      palette: ['#007979', '#0284c7', '#0d9488', '#009688', '#005f5f'],
      next: 'ambalan_putra'
    },
    ambalan_putra: {
      key: 'ambalan_putra',
      name: 'Pradana Ambalan Putra',
      title: 'Hasil Pemilihan Pradana Putra',
      congrats: 'Selamat Kepada Pradana Putra Terpilih!',
      badgeIcon: '🏕️',
      palette: ['#d97706', '#ea580c', '#ca8a04', '#b45309', '#c2410c'],
      next: 'ambalan_putri'
    },
    ambalan_putri: {
      key: 'ambalan_putri',
      name: 'Pradana Ambalan Putri',
      title: 'Hasil Pemilihan Pradana Putri',
      congrats: 'Selamat Kepada Pradana Putri Terpilih!',
      badgeIcon: '🌸',
      palette: ['#e11d48', '#db2777', '#9333ea', '#be185d', '#c026d3'],
      next: null
    }
  };

  // -------------------------------------------------------------
  // Web Audio API Synthesizer (Heartbeat, Tension Riser, Fanfare)
  // -------------------------------------------------------------
  function getCeremonyAudioCtx() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playHeartbeatSound() {
    if (!isCeremonySoundEnabled) return;
    try {
      const ctx = getCeremonyAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Lub
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.exponentialRampToValueAtTime(35, now + 0.12);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Dub
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(70, now + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(30, now + 0.32);
      gain2.gain.setValueAtTime(0.35, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.33);
    } catch (e) { }
  }

  function playCountdownTickSound(count) {
    if (!isCeremonySoundEnabled) return;
    try {
      const ctx = getCeremonyAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = 450 + (10 - Math.min(count, 10)) * 65;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.09);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) { }
  }

  let activeTensionTimer = null;
  let activeTensionOsc = null;

  function stopTensionSound() {
    if (activeTensionTimer) {
      clearInterval(activeTensionTimer);
      activeTensionTimer = null;
    }
    if (activeTensionOsc) {
      try {
        activeTensionOsc.stop();
        activeTensionOsc.disconnect();
      } catch (e) { }
      activeTensionOsc = null;
    }
  }

  function playTensionRiserSound(durationSec = 20) {
    if (!isCeremonySoundEnabled) return;
    stopTensionSound();
    try {
      const ctx = getCeremonyAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + durationSec);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + durationSec);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + durationSec * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.05);
      activeTensionOsc = osc;

      // Accelerated rhythmic heartbeat pulses during the race
      const startTimeMs = performance.now();
      const totalMs = durationSec * 1000;
      const pulseInterval = durationSec >= 15 ? 1200 : (durationSec >= 8 ? 850 : 550);

      activeTensionTimer = setInterval(() => {
        const elapsed = performance.now() - startTimeMs;
        if (elapsed >= totalMs) {
          clearInterval(activeTensionTimer);
          activeTensionTimer = null;
          return;
        }
        playHeartbeatSound();
      }, pulseInterval);
    } catch (e) { }
  }

  function playVictoryFanfareSound() {
    if (!isCeremonySoundEnabled) return;
    try {
      const ctx = getCeremonyAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      function playBrassNote(freq, startTime, duration, vol = 0.26) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3.2, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.04);
        gain.gain.setValueAtTime(vol * 0.85, startTime + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      }

      // Fanfare notes: Ta - Ta - Ta - Taaa!
      const t = now + 0.05;
      playBrassNote(261.63, t, 0.16, 0.28);        // C4
      playBrassNote(329.63, t + 0.18, 0.16, 0.28); // E4
      playBrassNote(392.00, t + 0.36, 0.16, 0.30); // G4

      // Grand sustained chord
      const chordTime = t + 0.55;
      const chordDur = 2.2;
      playBrassNote(261.63, chordTime, chordDur, 0.26); // C4
      playBrassNote(329.63, chordTime, chordDur, 0.24); // E4
      playBrassNote(392.00, chordTime, chordDur, 0.24); // G4
      playBrassNote(523.25, chordTime, chordDur, 0.32); // C5
      playBrassNote(659.25, chordTime, chordDur, 0.22); // E5
    } catch (e) { }
  }

  // -------------------------------------------------------------
  // Confetti Show Launcher
  // -------------------------------------------------------------
  function launchCeremonyConfetti() {
    if (!ceremonyConfetti) return;

    // Cannon Left
    ceremonyConfetti({
      particleCount: 85,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.85 },
      colors: ['#f59e0b', '#fbbf24', '#007979', '#38bdf8', '#ffffff', '#ec4899']
    });

    // Cannon Right
    ceremonyConfetti({
      particleCount: 85,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.85 },
      colors: ['#f59e0b', '#fbbf24', '#007979', '#38bdf8', '#ffffff', '#ec4899']
    });

    // Center Golden Blast
    setTimeout(() => {
      ceremonyConfetti({
        particleCount: 130,
        spread: 110,
        origin: { x: 0.5, y: 0.35 },
        colors: ['#ffd700', '#f59e0b', '#ffffff', '#00e5ff', '#a855f7']
      });
    }, 380);

    // Continuous sparkles for 3.5s
    const endTime = Date.now() + 3500;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        return;
      }
      ceremonyConfetti({
        particleCount: 25,
        spread: 85,
        origin: { x: Math.random(), y: Math.random() * 0.25 },
        colors: ['#ffd700', '#f59e0b', '#007979', '#38bdf8']
      });
    }, 320);
  }

  // -------------------------------------------------------------
  // Ceremony View Orchestrator
  // -------------------------------------------------------------
  function showCeremonyScreen(screenKey) {
    if (screenSetup) screenSetup.classList.toggle('hidden', screenKey !== 'setup');
    if (screenCountdown) screenCountdown.classList.toggle('hidden', screenKey !== 'countdown');
    if (screenStage) screenStage.classList.toggle('hidden', screenKey !== 'stage');
  }

  function triggerCeremonyFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.remove('animate-ceremony-flash');
    void flashOverlay.offsetWidth; // force browser reflow
    flashOverlay.classList.add('animate-ceremony-flash');
  }

  function openCeremonyModal() {
    getCeremonyAudioCtx();
    if (ceremonyModal) {
      ceremonyModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    showCeremonyScreen('setup');
  }

  function closeCeremonyModal() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (raceAnimId) cancelAnimationFrame(raceAnimId);
    stopTensionSound();
    if (ceremonyModal) {
      ceremonyModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // Dramatic easing designed specifically for 20-second suspenseful race
  function dramaticRaceEasing(t) {
    if (t < 0.2) {
      return 0.15 * Math.pow(t / 0.2, 1.4);
    } else if (t < 0.8) {
      const midT = (t - 0.2) / 0.6;
      return 0.15 + 0.72 * midT;
    } else {
      const endT = (t - 0.8) / 0.2;
      return 0.87 + 0.13 * (1 - Math.pow(1 - endT, 2));
    }
  }

  // Helper: easeOutCubic
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  async function startCeremonyCategory(catKey) {
    ceremonyCurrentCatKey = catKey;
    const meta = CEREMONY_CATEGORIES[catKey] || CEREMONY_CATEGORIES.osis;

    // 1. Prepare Countdown Screen
    if (countdownCategoryLabel) {
      countdownCategoryLabel.textContent = `PENGUMUMAN: ${meta.name.toUpperCase()}`;
    }

    const durationSec = parseInt(countdownSelect ? countdownSelect.value : '5', 10) || 5;
    let currentCountdown = durationSec;

    showCeremonyScreen('countdown');

    function renderCountdownNumber(num) {
      if (!countdownNumberEl) return;
      countdownNumberEl.textContent = num;
      countdownNumberEl.classList.remove('animate-countdown-pop');
      void countdownNumberEl.offsetWidth; // trigger reflow
      countdownNumberEl.classList.add('animate-countdown-pop');
      playCountdownTickSound(num);
      playHeartbeatSound();
    }

    renderCountdownNumber(currentCountdown);

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      currentCountdown -= 1;
      if (currentCountdown > 0) {
        renderCountdownNumber(currentCountdown);
      } else {
        clearInterval(countdownInterval);
        triggerCeremonyFlash();
        launchStageRace(catKey);
      }
    }, 1000);
  }

  async function launchStageRace(catKey) {
    const meta = CEREMONY_CATEGORIES[catKey] || CEREMONY_CATEGORIES.osis;

    // Ensure candidate data is fresh
    if (!cachedCandidates || cachedCandidates.length === 0) {
      try {
        const fresh = await fetchRealCountStats();
        cachedCandidates = fresh.candidates || [];
      } catch (e) { }
    }

    const list = (cachedCandidates || [])
      .filter(c => c.position === catKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    const totalVotes = list.reduce((acc, c) => acc + (c.vote_count || 0), 0);
    const maxVotes = Math.max(...list.map(c => c.vote_count || 0), 0);

    // Update Stage Headings
    if (stageBadgeIcon) stageBadgeIcon.textContent = meta.badgeIcon;
    if (stageCategoryName) stageCategoryName.textContent = meta.title.toUpperCase();
    if (stageTotalVotes) stageTotalVotes.textContent = totalVotes.toLocaleString('id-ID');

    // Hide Winner Banner initially
    if (winnerBanner) {
      winnerBanner.classList.add('hidden');
      winnerBanner.classList.remove('opacity-100', 'scale-100');
      winnerBanner.classList.add('opacity-0', 'scale-95');
    }

    // Render Candidate Race Cards Structure
    if (candidatesGrid) {
      if (list.length === 0) {
        candidatesGrid.innerHTML = `
          <div class="col-span-full py-12 text-center text-slate-400">
            <p class="text-sm">Belum ada data kandidat untuk kategori ${meta.name}.</p>
          </div>
        `;
      } else {
        candidatesGrid.innerHTML = list.map((c, idx) => {
          const numFormatted = String(c.candidate_number).padStart(2, '0');
          const candColor = meta.palette[idx % meta.palette.length] || '#007979';
          const fallbackImg = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
          const photoSrc = c.image_url || fallbackImg;

          return `
            <div id="race-card-${c.id}" class="race-candidate-card relative rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 transition-all duration-500 overflow-hidden flex flex-col justify-between shadow-lg">
              
              <!-- Ambient Subtle Cand Color Top Edge -->
              <div class="absolute top-0 inset-x-0 h-1.5" style="background-color: ${candColor};"></div>

              <!-- Winner Crown Ribbon (Hidden during race) -->
              <div class="race-crown-badge hidden absolute -top-4 -right-4 w-28 h-28 overflow-hidden pointer-events-none z-20">
                <div class="absolute transform rotate-45 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] py-1.5 right-[-32px] top-[24px] w-[140px] text-center shadow-lg uppercase tracking-wider font-heading flex items-center justify-center space-x-1">
                  <span>👑 TERPILIH</span>
                </div>
              </div>

              <div>
                <!-- Candidate Info & Portrait -->
                <div class="flex items-center space-x-4 mb-4">
                  <div class="relative w-18 h-22 sm:w-20 sm:h-24 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-md flex-shrink-0">
                    <img 
                      src="${photoSrc}" 
                      alt="${c.name}" 
                      class="w-full h-full object-cover object-top"
                      onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&auto=format&fit=crop&q=80'"
                    />
                  </div>

                  <div class="flex-1 min-w-0 pr-1">
                    <div class="flex items-center space-x-2">
                      <span class="px-2 py-0.5 rounded text-[11px] font-black font-mono text-white font-heading" style="background-color: ${candColor};">
                        #${numFormatted}
                      </span>
                      <span class="text-xs font-semibold text-slate-400 truncate">${c.class_grade || 'Kandidat'}</span>
                    </div>
                    <h3 class="text-base sm:text-lg font-extrabold text-white leading-tight truncate mt-1.5 font-heading">
                      ${c.name}
                    </h3>
                  </div>
                </div>

                <!-- Animated Progress Bar Track -->
                <div class="space-y-1.5 mb-4">
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-400 font-heading text-[11px]">Perolehan Suara:</span>
                    <span id="race-pct-${c.id}" class="font-mono font-black text-amber-300 text-sm">0.0%</span>
                  </div>
                  <div class="w-full bg-slate-800/90 rounded-xl h-5 sm:h-6 p-0.5 border border-slate-700/60 overflow-hidden relative shadow-inner">
                    <div 
                      id="race-bar-${c.id}" 
                      class="h-full rounded-lg transition-none w-0 animate-bar-shine shadow-xs"
                      style="background: linear-gradient(90deg, ${candColor}, #f59e0b); width: 0%;">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Vote Counter -->
              <div class="pt-3 border-t border-slate-800 flex items-baseline justify-between">
                <span class="text-xs text-slate-400 font-heading">Jumlah Suara Sah:</span>
                <div>
                  <span id="race-count-${c.id}" class="font-mono font-black text-2xl sm:text-3xl text-white">0</span>
                  <span class="text-xs text-slate-400 font-sans ml-1">suara</span>
                </div>
              </div>

            </div>
          `;
        }).join('');
      }
    }

    // Switch to stage view
    showCeremonyScreen('stage');

    // Next Category Button Setup
    if (btnCeremonyNextCat) {
      if (isSequentialCeremony && meta.next && CEREMONY_CATEGORIES[meta.next]) {
        const nextMeta = CEREMONY_CATEGORIES[meta.next];
        btnCeremonyNextCat.classList.remove('hidden');
        if (ceremonyNextCatLabel) {
          ceremonyNextCatLabel.textContent = `Lanjut: ${nextMeta.name} ➔`;
        }
      } else {
        btnCeremonyNextCat.classList.add('hidden');
      }
    }

    // Start Rising Tension Sound with selected duration (Default: 20 Detik)
    const RACE_DURATION = parseInt(raceDurationSelect ? raceDurationSelect.value : '20000', 10) || 20000;
    playTensionRiserSound(RACE_DURATION / 1000);

    const startTime = performance.now();

    function frameStep(currentTime) {
      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(1, elapsed / RACE_DURATION);
      const easedProgress = dramaticRaceEasing(rawProgress);

      list.forEach(c => {
        const finalCount = c.vote_count || 0;
        const finalPct = totalVotes > 0 ? (finalCount / totalVotes) * 100 : 0;

        const currentPct = easedProgress * finalPct;
        const currentCount = Math.floor(easedProgress * finalCount);

        const barEl = document.getElementById(`race-bar-${c.id}`);
        const pctEl = document.getElementById(`race-pct-${c.id}`);
        const countEl = document.getElementById(`race-count-${c.id}`);

        if (barEl) barEl.style.width = `${currentPct.toFixed(1)}%`;
        if (pctEl) pctEl.textContent = `${currentPct.toFixed(1)}%`;
        if (countEl) countEl.textContent = currentCount.toLocaleString('id-ID');
      });

      if (rawProgress < 1) {
        raceAnimId = requestAnimationFrame(frameStep);
      } else {
        // Ensure final exact values
        list.forEach(c => {
          const finalCount = c.vote_count || 0;
          const finalPct = totalVotes > 0 ? ((finalCount / totalVotes) * 100).toFixed(1) : '0.0';
          const barEl = document.getElementById(`race-bar-${c.id}`);
          const pctEl = document.getElementById(`race-pct-${c.id}`);
          const countEl = document.getElementById(`race-count-${c.id}`);

          if (barEl) barEl.style.width = `${finalPct}%`;
          if (pctEl) pctEl.textContent = `${finalPct}%`;
          if (countEl) countEl.textContent = finalCount.toLocaleString('id-ID');
        });

        // Coronation Delay for Suspense
        setTimeout(() => {
          coronateWinner(list, maxVotes, meta);
        }, 500);
      }
    }

    if (raceAnimId) cancelAnimationFrame(raceAnimId);
    raceAnimId = requestAnimationFrame(frameStep);
  }

  function coronateWinner(list, maxVotes, meta) {
    stopTensionSound();
    triggerCeremonyFlash();
    playVictoryFanfareSound();
    launchCeremonyConfetti();

    const winners = list.filter(c => (c.vote_count || 0) === maxVotes && maxVotes > 0);

    // Apply Winner Card Glowing & Crown Ribbon
    list.forEach(c => {
      const cardEl = document.getElementById(`race-card-${c.id}`);
      if (!cardEl) return;

      const isWinner = maxVotes > 0 && (c.vote_count || 0) === maxVotes;
      if (isWinner) {
        cardEl.classList.add('animate-winner-glow', 'border-amber-400', 'scale-[1.03]', 'z-10');
        cardEl.classList.remove('border-slate-800');
        const badge = cardEl.querySelector('.race-crown-badge');
        if (badge) {
          badge.classList.remove('hidden');
          badge.classList.add('animate-crown-bounce');
        }
      } else {
        cardEl.classList.add('opacity-60', 'scale-[0.98]');
      }
    });

    // Reveal Winner Banner
    if (winnerBanner) {
      winnerBanner.classList.remove('hidden');
      if (winnerCongratsText) winnerCongratsText.textContent = meta.congrats;
      if (winnerNameText) {
        if (winners.length > 0) {
          winnerNameText.textContent = winners.map(w => `${w.name} (${w.class_grade || 'Kandidat'})`).join(' & ');
        } else {
          winnerNameText.textContent = 'Belum ada suara yang masuk.';
        }
      }

      setTimeout(() => {
        winnerBanner.classList.remove('opacity-0', 'scale-95');
        winnerBanner.classList.add('opacity-100', 'scale-100');
      }, 50);
    }
  }

  // -------------------------------------------------------------
  // Ceremony Event Listeners Binding
  // -------------------------------------------------------------
  if (btnOpenCeremony) {
    btnOpenCeremony.addEventListener('click', () => openCeremonyModal());
  }

  if (btnBannerCeremony) {
    btnBannerCeremony.addEventListener('click', () => openCeremonyModal());
  }

  if (btnCloseCeremony) {
    btnCloseCeremony.addEventListener('click', () => closeCeremonyModal());
  }

  if (btnCeremonyFinishExit) {
    btnCeremonyFinishExit.addEventListener('click', () => closeCeremonyModal());
  }

  if (btnCeremonyChooseOther) {
    btnCeremonyChooseOther.addEventListener('click', () => showCeremonyScreen('setup'));
  }

  if (btnCeremonyReplay) {
    btnCeremonyReplay.addEventListener('click', () => startCeremonyCategory(ceremonyCurrentCatKey));
  }

  if (btnCeremonyNextCat) {
    btnCeremonyNextCat.addEventListener('click', () => {
      const meta = CEREMONY_CATEGORIES[ceremonyCurrentCatKey];
      if (meta && meta.next) {
        startCeremonyCategory(meta.next);
      }
    });
  }

  if (btnStartCeremonyRun) {
    btnStartCeremonyRun.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="ceremony_category"]:checked');
      const chosenValue = selectedRadio ? selectedRadio.value : 'all';

      if (chosenValue === 'all') {
        isSequentialCeremony = true;
        startCeremonyCategory('osis');
      } else {
        isSequentialCeremony = false;
        startCeremonyCategory(chosenValue);
      }
    });
  }

  if (btnCeremonySoundToggle) {
    btnCeremonySoundToggle.addEventListener('click', () => {
      isCeremonySoundEnabled = !isCeremonySoundEnabled;
      if (ceremonySoundIcon) ceremonySoundIcon.textContent = isCeremonySoundEnabled ? '🔊' : '🔇';
      if (ceremonySoundText) ceremonySoundText.textContent = isCeremonySoundEnabled ? 'SFX: Aktif' : 'SFX: Bisu';
      getCeremonyAudioCtx();
    });
  }

  if (btnCeremonyFullscreen) {
    btnCeremonyFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      } else {
        document.exitFullscreen().catch(() => { });
      }
    });
  }

  // Keyboard Escape listener to close ceremony
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ceremonyModal && !ceremonyModal.classList.contains('hidden')) {
      closeCeremonyModal();
    }
  });

  // Initial Check
  checkAdminAccess();

  window.addEventListener('beforeunload', () => {
    stopRealtimeEngine();
    Object.keys(chartInstances).forEach(k => {
      if (chartInstances[k]) chartInstances[k].destroy();
    });
  });
});
