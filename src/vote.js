import { fetchCandidates, submitVotes, fetchElectionSettings, getSchoolBackground } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Sync school background image from Supabase / cache
  getSchoolBackground().then(bg => {
    const bgImgEl = document.getElementById('school-bg-image');
    if (bg && bgImgEl) {
      bgImgEl.src = bg;
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 1. Check Voter Session Guard
  const voterDataRaw = sessionStorage.getItem('evote_current_voter');
  if (!voterDataRaw) {
    window.location.href = '/index.html';
    return;
  }

  let voter;
  try {
    voter = JSON.parse(voterDataRaw);
  } catch (e) {
    window.location.href = '/index.html';
    return;
  }

  // Render voter details in header
  const voterNameEl = document.getElementById('voter-name');
  const voterIdEl = document.getElementById('voter-id');
  const voterRoleBadge = document.getElementById('voter-role-badge');
  const voterIcon = document.getElementById('voter-icon');

  voterNameEl.textContent = voter.name || 'Pemilih';
  voterIdEl.textContent = voter.role === 'guru' ? `NIP/NIY: ${voter.id_number}` : `NISN: ${voter.id_number}`;
  
  if (voter.role === 'guru') {
    voterRoleBadge.textContent = 'GURU';
    voterRoleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (voterIcon) voterIcon.classList.replace('text-blue-400', 'text-amber-400');
  } else {
    voterRoleBadge.textContent = 'SISWA';
    voterRoleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30';
  }

  // Cancel / Logout
  document.getElementById('btn-cancel-vote').addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar dari bilik suara? Pilihan Anda saat ini belum tersimpan.')) {
      sessionStorage.removeItem('evote_current_voter');
      window.location.href = '/index.html';
    }
  });

  // 2. State & Selections
  let allCandidates = [];
  let activeCategories = ['osis', 'ambalan_putra', 'ambalan_putri'];
  const selectedVotes = {
    osis: null,         // candidate object
    ambalan_putra: null,
    ambalan_putri: null
  };

  let activeModalCandidate = null;

  // 3. Fetch Settings and Candidates
  try {
    const [settingsData, candidatesData] = await Promise.all([
      fetchElectionSettings().catch(e => { console.warn(e); return null; }),
      fetchCandidates().catch(e => { console.warn(e); return []; })
    ]);

    if (settingsData && settingsData.active_categories && settingsData.active_categories.length > 0) {
      activeCategories = settingsData.active_categories;
    } else {
      activeCategories = ['osis', 'ambalan_putra', 'ambalan_putri'];
    }

    allCandidates = (candidatesData && candidatesData.length > 0) ? candidatesData : [];
    renderAllCategories();
  } catch (err) {
    console.error('Failed to fetch data:', err);
    renderAllCategories();
  }

  function renderAllCategories() {
    // OSIS Section
    const sectionOsis = document.getElementById('section-osis');
    if (activeCategories.includes('osis')) {
      sectionOsis.classList.remove('hidden');
      renderCategory('osis', 'grid-osis', 'section-osis');
    } else {
      sectionOsis.classList.add('hidden');
    }

    // Ambalan Pa Section
    const sectionPa = document.getElementById('section-ambalan-pa');
    if (activeCategories.includes('ambalan_putra')) {
      sectionPa.classList.remove('hidden');
      renderCategory('ambalan_putra', 'grid-ambalan-pa', 'section-ambalan-pa');
    } else {
      sectionPa.classList.add('hidden');
    }

    // Ambalan Pi Section
    const sectionPi = document.getElementById('section-ambalan-pi');
    if (activeCategories.includes('ambalan_putri')) {
      sectionPi.classList.remove('hidden');
      renderCategory('ambalan_putri', 'grid-ambalan-pi', 'section-ambalan-pi');
    } else {
      sectionPi.classList.add('hidden');
    }

    updateSummaryBar();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderCategory(positionKey, gridId, sectionId) {
    const grid = document.getElementById(gridId);
    const candidates = allCandidates
      .filter(c => c.position === positionKey)
      .sort((a, b) => (a.candidate_number || 0) - (b.candidate_number || 0));

    if (candidates.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          <p class="text-sm">Belum ada kandidat terdaftar untuk kategori ini.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = candidates.map(candidate => {
      const isSelected = selectedVotes[positionKey]?.id === candidate.id;
      const numFormatted = String(candidate.candidate_number).padStart(2, '0');
      const fallbackImage = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`;
      const photoSrc = candidate.image_url || fallbackImage;

      // Color scheme based on position
      const isOsis = positionKey === 'osis';
      const isPa = positionKey === 'ambalan_putra';
      const accentBg = isOsis ? 'bg-blue-800' : (isPa ? 'bg-amber-600' : 'bg-rose-700');
      const accentText = isOsis ? 'text-blue-800' : (isPa ? 'text-amber-700' : 'text-rose-700');
      const accentBorder = isOsis ? 'border-blue-800' : (isPa ? 'border-amber-600' : 'border-rose-700');
      const accentRing = isOsis ? 'ring-blue-800/40' : (isPa ? 'ring-amber-600/40' : 'ring-rose-700/40');

      return `
        <div 
          id="card-${candidate.id}"
          class="candidate-card group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer ${
            isSelected 
              ? `bg-white ${accentBorder} ring-2 ${accentRing} shadow-xl scale-[1.02]` 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-lg hover:-translate-y-1'
          }"
          data-id="${candidate.id}"
          data-position="${positionKey}"
        >
          <!-- Top Badge & Checkmark -->
          <div class="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
            <span class="px-2.5 py-1 rounded-xl text-xs font-black tracking-wider ${accentBg} text-white shadow-md font-heading">
              #${numFormatted}
            </span>
            
            <div class="selection-indicator w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              isSelected 
                ? 'bg-amber-400 text-slate-950 shadow-md scale-100' 
                : 'bg-white/80 text-slate-400 border border-slate-200 scale-90 opacity-80'
            }">
              <i data-lucide="check" class="w-4 h-4 font-bold"></i>
            </div>
          </div>

          <!-- Candidate Photo Container (Tall, Clear, Sharp with Click to Zoom) -->
          <div class="relative w-full h-72 sm:h-80 overflow-hidden bg-slate-100 border-b border-slate-200 group/photo cursor-zoom-in cand-photo-wrap" data-id="${candidate.id}" title="Klik untuk perbesar foto">
            <img 
              src="${photoSrc}" 
              alt="${candidate.name}" 
              class="w-full h-full object-cover object-top group-hover/photo:scale-105 transition-transform duration-500"
              onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&auto=format&fit=crop&q=80'"
            />
            <!-- Subtle bottom gradient -->
            <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none"></div>
            
            <!-- Hover Zoom Pill Button -->
            <div class="absolute top-12 right-3 z-10 opacity-0 group-hover/photo:opacity-100 transition-opacity">
              <button type="button" class="btn-preview-photo px-2.5 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 text-slate-900 text-[11px] font-bold font-heading flex items-center space-x-1 shadow-md hover:bg-blue-800 hover:text-white transition-all cursor-pointer" data-id="${candidate.id}">
                <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
                <span>Lihat Foto</span>
              </button>
            </div>

            <!-- Candidate Class Badge -->
            <div class="absolute bottom-2.5 inset-x-3 text-left pointer-events-none">
              <span class="text-[11px] font-bold text-white bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-sm font-heading">
                ${candidate.class_grade || 'Calon Pemimpin'}
              </span>
            </div>
          </div>

          <!-- Card Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
            <div>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900 leading-snug group-hover:${accentText} transition-colors line-clamp-2 font-heading">
                ${candidate.name}
              </h3>
              <p class="text-xs text-slate-600 mt-2 line-clamp-2 italic font-normal">
                "${candidate.vision}"
              </p>
            </div>

            <!-- Card Actions -->
            <div class="pt-3 border-t border-slate-100 flex items-center space-x-2">
              <button 
                type="button" 
                class="btn-view-vision flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center space-x-1.5 cursor-pointer font-heading"
                data-id="${candidate.id}"
              >
                <i data-lucide="eye" class="w-3.5 h-3.5 text-slate-500"></i>
                <span>Visi & Misi</span>
              </button>

              <button 
                type="button" 
                class="btn-select-candidate py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer font-heading ${
                  isSelected 
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm' 
                    : `${accentBg} hover:opacity-90 text-white`
                }"
                data-id="${candidate.id}"
                data-position="${positionKey}"
              >
                <span>${isSelected ? 'Terpilih' : 'Pilih'}</span>
                <i data-lucide="${isSelected ? 'check-circle-2' : 'chevron-right'}" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');

    // Attach listeners
    grid.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // If clicked on view vision button or photo zoom button, don't trigger selection
        if (e.target.closest('.btn-view-vision') || e.target.closest('.btn-preview-photo') || e.target.closest('.cand-photo-wrap')) return;
        const id = card.getAttribute('data-id');
        const pos = card.getAttribute('data-position');
        selectCandidate(pos, id);
      });
    });

    grid.querySelectorAll('.cand-photo-wrap, .btn-preview-photo').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        openPhotoPreviewModal(id);
      });
    });

    grid.querySelectorAll('.btn-view-vision').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openVisionModal(id);
      });
    });
  }

  function selectCandidate(positionKey, candidateId) {
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    selectedVotes[positionKey] = candidate;
    renderCategory(positionKey, getGridId(positionKey), getSectionId(positionKey));
    updateCategoryStatusBadge(positionKey);
    updateSummaryBar();
    if (window.lucide) window.lucide.createIcons();
  }

  function getGridId(pos) {
    if (pos === 'osis') return 'grid-osis';
    if (pos === 'ambalan_putra') return 'grid-ambalan-pa';
    return 'grid-ambalan-pi';
  }

  function getSectionId(pos) {
    if (pos === 'osis') return 'section-osis';
    if (pos === 'ambalan_putra') return 'section-ambalan-pa';
    return 'section-ambalan-pi';
  }

  function updateCategoryStatusBadge(positionKey) {
    let badgeEl;
    const selected = selectedVotes[positionKey];

    if (positionKey === 'osis') badgeEl = document.getElementById('status-badge-osis');
    else if (positionKey === 'ambalan_putra') badgeEl = document.getElementById('status-badge-ambalan-pa');
    else badgeEl = document.getElementById('status-badge-ambalan-pi');

    if (!badgeEl) return;

    if (selected) {
      const num = String(selected.candidate_number).padStart(2, '0');
      badgeEl.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 self-start sm:self-auto flex items-center space-x-1.5 font-heading shadow-2xs';
      badgeEl.innerHTML = `
        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i>
        <span>Pilihan: #${num} - ${selected.name.split('&')[0].trim().substring(0, 16)}</span>
      `;
    } else {
      badgeEl.className = 'text-xs font-bold px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 self-start sm:self-auto flex items-center space-x-1.5 font-heading';
      badgeEl.innerHTML = `
        <i data-lucide="circle-dashed" class="w-3.5 h-3.5 text-slate-500"></i>
        <span>Belum Memilih</span>
      `;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function updateSummaryBar() {
    const summaryOsis = document.getElementById('summary-osis');
    const summaryPa = document.getElementById('summary-ambalan-pa');
    const summaryPi = document.getElementById('summary-ambalan-pi');
    const btnSubmit = document.getElementById('btn-open-confirm');
    const countEl = document.getElementById('selected-count');

    let count = 0;
    const requiredCount = activeCategories.length;

    // OSIS Chip
    if (activeCategories.includes('osis')) {
      summaryOsis.classList.remove('hidden');
      if (selectedVotes.osis) {
        count++;
        const num = String(selectedVotes.osis.candidate_number).padStart(2, '0');
        const shortName = selectedVotes.osis.name.split('&')[0].trim().substring(0, 14);
        summaryOsis.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-blue-800 border border-blue-900 text-white font-heading font-bold shadow-xs transition-all';
        summaryOsis.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>OSIS: <strong class="text-amber-300">#${num}</strong> <span class="font-normal text-blue-100">(${shortName})</span></span>
        `;
      } else {
        summaryOsis.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 font-heading font-semibold transition-all';
        summaryOsis.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>OSIS: <strong class="text-slate-500 italic">Belum Dipilih</strong></span>
        `;
      }
    } else {
      summaryOsis.classList.add('hidden');
    }

    // Ambalan Pa Chip
    if (activeCategories.includes('ambalan_putra')) {
      summaryPa.classList.remove('hidden');
      if (selectedVotes.ambalan_putra) {
        count++;
        const num = String(selectedVotes.ambalan_putra.candidate_number).padStart(2, '0');
        const shortName = selectedVotes.ambalan_putra.name.split(' ')[0].trim();
        summaryPa.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-amber-600 border border-amber-700 text-white font-heading font-bold shadow-xs transition-all';
        summaryPa.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-white"></span>
          <span>Ambalan Pa: <strong class="text-amber-200">#${num}</strong> <span class="font-normal text-amber-100">(${shortName})</span></span>
        `;
      } else {
        summaryPa.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 font-heading font-semibold transition-all';
        summaryPa.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>Ambalan Pa: <strong class="text-slate-500 italic">Belum Dipilih</strong></span>
        `;
      }
    } else {
      summaryPa.classList.add('hidden');
    }

    // Ambalan Pi Chip
    if (activeCategories.includes('ambalan_putri')) {
      summaryPi.classList.remove('hidden');
      if (selectedVotes.ambalan_putri) {
        count++;
        const num = String(selectedVotes.ambalan_putri.candidate_number).padStart(2, '0');
        const shortName = selectedVotes.ambalan_putri.name.split(' ')[0].trim();
        summaryPi.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-rose-600 border border-rose-700 text-white font-heading font-bold shadow-xs transition-all';
        summaryPi.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-white"></span>
          <span>Ambalan Pi: <strong class="text-rose-200">#${num}</strong> <span class="font-normal text-rose-100">(${shortName})</span></span>
        `;
      } else {
        summaryPi.className = 'flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 font-heading font-semibold transition-all';
        summaryPi.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>Ambalan Pi: <strong class="text-slate-500 italic">Belum Dipilih</strong></span>
        `;
      }
    } else {
      summaryPi.classList.add('hidden');
    }

    if (countEl) {
      countEl.textContent = count;
    }
    const totalEl = document.getElementById('required-count');
    if (totalEl) {
      totalEl.textContent = requiredCount;
    }

    btnSubmit.disabled = count < requiredCount;
  }

  // 4. Modal Visi & Misi Handler
  const modalVision = document.getElementById('modal-vision');
  const modalCandidateImg = document.getElementById('modal-candidate-img');
  const modalCandidateBadge = document.getElementById('modal-candidate-badge');
  const modalCandidateName = document.getElementById('modal-candidate-name');
  const modalCandidateClass = document.getElementById('modal-candidate-class');
  const modalCandidateVision = document.getElementById('modal-candidate-vision');
  const modalCandidateMission = document.getElementById('modal-candidate-mission');
  const modalBtnClose = document.getElementById('modal-btn-close');
  const modalBtnChoose = document.getElementById('modal-btn-choose');

  function openVisionModal(candidateId) {
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    activeModalCandidate = candidate;
    const num = String(candidate.candidate_number).padStart(2, '0');
    const fallbackImage = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`;
    
    modalCandidateImg.src = candidate.image_url || fallbackImage;
    modalCandidateBadge.textContent = `CALON #${num}`;
    modalCandidateName.textContent = candidate.name;
    modalCandidateClass.textContent = candidate.class_grade || 'Calon Pemimpin';
    modalCandidateVision.textContent = candidate.vision || '-';
    modalCandidateMission.textContent = candidate.mission || '-';

    modalVision.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  modalBtnClose.addEventListener('click', () => {
    modalVision.classList.add('hidden');
    activeModalCandidate = null;
  });

  modalVision.addEventListener('click', (e) => {
    if (e.target === modalVision) {
      modalVision.classList.add('hidden');
      activeModalCandidate = null;
    }
  });

  modalBtnChoose.addEventListener('click', () => {
    if (activeModalCandidate) {
      selectCandidate(activeModalCandidate.position, activeModalCandidate.id);
      modalVision.classList.add('hidden');
      activeModalCandidate = null;
    }
  });

  // Clicking image in Visi & Misi modal opens full preview
  modalCandidateImg.addEventListener('click', () => {
    if (activeModalCandidate) {
      openPhotoPreviewModal(activeModalCandidate.id);
    }
  });

  // 5. Modal Photo Preview Lightbox Handler
  const modalPhotoPreview = document.getElementById('modal-photo-preview');
  const previewPhotoImg = document.getElementById('preview-photo-img');
  const previewPhotoBadge = document.getElementById('preview-photo-badge');
  const previewPhotoName = document.getElementById('preview-photo-name');
  const previewPhotoClass = document.getElementById('preview-photo-class');
  const btnClosePhotoPreview = document.getElementById('btn-close-photo-preview');
  const btnChooseFromPreview = document.getElementById('btn-choose-from-preview');

  let activePreviewCandidate = null;

  function openPhotoPreviewModal(candidateId) {
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    activePreviewCandidate = candidate;
    const num = String(candidate.candidate_number).padStart(2, '0');
    const fallbackImage = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`;

    previewPhotoImg.src = candidate.image_url || fallbackImage;
    previewPhotoBadge.textContent = `#${num}`;
    previewPhotoName.textContent = candidate.name;
    previewPhotoClass.textContent = candidate.class_grade || 'Calon Pemimpin';

    modalPhotoPreview.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  btnClosePhotoPreview.addEventListener('click', () => {
    modalPhotoPreview.classList.add('hidden');
    activePreviewCandidate = null;
  });

  modalPhotoPreview.addEventListener('click', (e) => {
    if (e.target === modalPhotoPreview) {
      modalPhotoPreview.classList.add('hidden');
      activePreviewCandidate = null;
    }
  });

  btnChooseFromPreview.addEventListener('click', () => {
    if (activePreviewCandidate) {
      selectCandidate(activePreviewCandidate.position, activePreviewCandidate.id);
      modalPhotoPreview.classList.add('hidden');
      if (modalVision) modalVision.classList.add('hidden');
      activePreviewCandidate = null;
      activeModalCandidate = null;
    }
  });

  // 6. Final Confirmation & Submission Handler
  const modalConfirm = document.getElementById('modal-confirm');
  const btnOpenConfirm = document.getElementById('btn-open-confirm');
  const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
  const btnSubmitFinal = document.getElementById('btn-submit-final');

  btnOpenConfirm.addEventListener('click', () => {
    // Validate that all active categories have a selected candidate
    const missing = [];
    if (activeCategories.includes('osis') && !selectedVotes.osis) missing.push('Ketua OSIS');
    if (activeCategories.includes('ambalan_putra') && !selectedVotes.ambalan_putra) missing.push('Pradana Putra');
    if (activeCategories.includes('ambalan_putri') && !selectedVotes.ambalan_putri) missing.push('Pradana Putri');

    if (missing.length > 0) {
      alert(`Silakan lengkapi pilihan Anda untuk kategori: ${missing.join(', ')}!`);
      return;
    }

    const fallbackImg = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`;

    // OSIS Row
    const rowOsis = document.getElementById('confirm-row-osis');
    if (activeCategories.includes('osis') && selectedVotes.osis) {
      rowOsis.classList.remove('hidden');
      document.getElementById('confirm-osis-name').textContent = selectedVotes.osis.name;
      document.getElementById('confirm-osis-num').textContent = `#${String(selectedVotes.osis.candidate_number).padStart(2, '0')}`;
      document.getElementById('confirm-osis-img').src = selectedVotes.osis.image_url || fallbackImg;
    } else if (rowOsis) {
      rowOsis.classList.add('hidden');
    }

    // Ambalan Putra Row
    const rowPa = document.getElementById('confirm-row-pa');
    if (activeCategories.includes('ambalan_putra') && selectedVotes.ambalan_putra) {
      rowPa.classList.remove('hidden');
      document.getElementById('confirm-ambalan-pa-name').textContent = selectedVotes.ambalan_putra.name;
      document.getElementById('confirm-ambalan-pa-num').textContent = `#${String(selectedVotes.ambalan_putra.candidate_number).padStart(2, '0')}`;
      document.getElementById('confirm-ambalan-pa-img').src = selectedVotes.ambalan_putra.image_url || fallbackImg;
    } else if (rowPa) {
      rowPa.classList.add('hidden');
    }

    // Ambalan Putri Row
    const rowPi = document.getElementById('confirm-row-pi');
    if (activeCategories.includes('ambalan_putri') && selectedVotes.ambalan_putri) {
      rowPi.classList.remove('hidden');
      document.getElementById('confirm-ambalan-pi-name').textContent = selectedVotes.ambalan_putri.name;
      document.getElementById('confirm-ambalan-pi-num').textContent = `#${String(selectedVotes.ambalan_putri.candidate_number).padStart(2, '0')}`;
      document.getElementById('confirm-ambalan-pi-img').src = selectedVotes.ambalan_putri.image_url || fallbackImg;
    } else if (rowPi) {
      rowPi.classList.add('hidden');
    }

    modalConfirm.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  });

  btnCancelConfirm.addEventListener('click', () => {
    modalConfirm.classList.add('hidden');
  });

  modalConfirm.addEventListener('click', (e) => {
    if (e.target === modalConfirm) {
      modalConfirm.classList.add('hidden');
    }
  });

  btnSubmitFinal.addEventListener('click', async () => {
    btnSubmitFinal.disabled = true;
    btnCancelConfirm.disabled = true;
    btnSubmitFinal.innerHTML = `
      <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      <span>Menyimpan Suara...</span>
    `;

    try {
      const res = await submitVotes({
        voterId: voter.id_number,
        osisId: activeCategories.includes('osis') && selectedVotes.osis ? selectedVotes.osis.id : null,
        ambalanPaId: activeCategories.includes('ambalan_putra') && selectedVotes.ambalan_putra ? selectedVotes.ambalan_putra.id : null,
        ambalanPiId: activeCategories.includes('ambalan_putri') && selectedVotes.ambalan_putri ? selectedVotes.ambalan_putri.id : null
      });

      if (!res.success) {
        alert(res.message || 'Gagal mengirim suara!');
        btnSubmitFinal.disabled = false;
        btnCancelConfirm.disabled = false;
        btnSubmitFinal.innerHTML = `<span>Ya, Kirimkan!</span>`;
        return;
      }

      // Save receipt in session for success page
      const receipt = {
        voterName: voter.name,
        voterId: voter.id_number,
        voterRole: voter.role,
        timestamp: new Date().toISOString(),
        osisChosen: selectedVotes.osis ? `#${String(selectedVotes.osis.candidate_number).padStart(2, '0')} - ${selectedVotes.osis.name}` : '-',
        ambalanPaChosen: selectedVotes.ambalan_putra ? `#${String(selectedVotes.ambalan_putra.candidate_number).padStart(2, '0')} - ${selectedVotes.ambalan_putra.name}` : '-',
        ambalanPiChosen: selectedVotes.ambalan_putri ? `#${String(selectedVotes.ambalan_putri.candidate_number).padStart(2, '0')} - ${selectedVotes.ambalan_putri.name}` : '-',
      };

      sessionStorage.setItem('evote_receipt', JSON.stringify(receipt));
      sessionStorage.removeItem('evote_current_voter');

      window.location.href = '/success.html';

    } catch (err) {
      console.error('Error submitting vote:', err);
      alert('Terjadi kesalahan saat memproses suara Anda. Silakan coba kembali.');
      btnSubmitFinal.innerHTML = `<span>Ya, Kirimkan!</span>`;
    }
  });

  // Fullscreen Toggle
  const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Fullscreen error: ${err.message}`);
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
        ? `<i data-lucide="minimize" class="w-4 h-4 text-blue-800"></i><span class="hidden md:inline">Keluar Layar Penuh</span>`
        : `<i data-lucide="maximize" class="w-4 h-4 text-blue-800"></i><span class="hidden md:inline">Layar Penuh</span>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

});
