import Papa from 'papaparse';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  isSupabaseConnected,
  fetchRealCountStats,
  adminGetAllVoters,
  adminAddVoter,
  adminBatchInsertVoters,
  adminDeleteVoter,
  adminResetVoterStatus,
  adminResetAllVotersStatus,
  adminAddCandidate,
  adminUpdateCandidate,
  adminDeleteCandidate,
  adminResetAllVotes,
  fetchElectionSettings,
  saveElectionSettings
} from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // 1. ADMIN AUTHENTICATION
  // -------------------------------------------------------------
  const authGate = document.getElementById('admin-auth-gate') || document.getElementById('admin-login-modal');
  const dashboardContainer = document.getElementById('admin-dashboard-container');
  const formAdminLogin = document.getElementById('form-admin-login') || document.getElementById('admin-login-form');
  const adminPasswordInput = document.getElementById('admin-password');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  function checkAdminSession() {
    const isLogged = sessionStorage.getItem('evote_admin_logged');
    if (isLogged === 'true') {
      if (authGate) authGate.classList.add('hidden');
      if (dashboardContainer) dashboardContainer.classList.remove('hidden');
      initDashboard();
    } else {
      if (authGate) authGate.classList.remove('hidden');
      if (dashboardContainer) dashboardContainer.classList.add('hidden');
    }
  }

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = adminPasswordInput ? adminPasswordInput.value.trim() : '';
      if (pass === 'admin123' || pass === 'admin') {
        sessionStorage.setItem('evote_admin_logged', 'true');
        if (authErrorMsg) authErrorMsg.classList.add('hidden');
        if (authGate) authGate.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.remove('hidden');
        initDashboard();
      } else {
        if (authErrorMsg) authErrorMsg.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem('evote_admin_logged');
      window.location.reload();
    });
  }

  checkAdminSession();

  // -------------------------------------------------------------
  // 2. TABS SWITCHING
  // -------------------------------------------------------------
  const tabs = ['overview', 'voters', 'candidates', 'personalization'];
  tabs.forEach(tabKey => {
    const btn = document.getElementById(`tab-btn-${tabKey}`);
    if (btn) {
      btn.addEventListener('click', () => {
        switchTab(tabKey);
      });
    }
  });

  function switchTab(activeKey) {
    tabs.forEach(tabKey => {
      const btn = document.getElementById(`tab-btn-${tabKey}`);
      const content = document.getElementById(`tab-content-${tabKey}`);
      
      if (btn && content) {
        if (tabKey === activeKey) {
          btn.className = 'admin-tab-btn active px-3.5 py-2 rounded-xl bg-[#007979] text-white flex items-center space-x-2 transition-all flex-shrink-0 font-heading font-bold shadow-xs cursor-pointer';
          content.classList.remove('hidden');
        } else {
          btn.className = 'admin-tab-btn px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center space-x-2 transition-all flex-shrink-0 font-heading font-bold cursor-pointer';
          content.classList.add('hidden');
        }
      }
    });

    if (activeKey === 'overview') loadOverviewData();
    if (activeKey === 'voters') loadVotersData();
    if (activeKey === 'candidates') loadCandidatesData();
    if (activeKey === 'personalization') loadPersonalizationData();
    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // 3. INITIALIZE DASHBOARD & STATUS
  // -------------------------------------------------------------
  let isDashboardInitialized = false;

  function initDashboard() {
    updateDbStatusBadge();
    loadOverviewData();
    applyCustomBranding();

    if (!isDashboardInitialized) {
      isDashboardInitialized = true;
      setupReportActions();
      setupVotersTab();
      setupCandidatesTab();
      setupPersonalizationTab();
    }
  }

  function updateDbStatusBadge() {
    const badge = document.getElementById('db-status-badge');
    const text = document.getElementById('db-status-text');
    if (badge && text) {
      if (isSupabaseConnected()) {
        badge.className = 'hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 font-heading';
        text.textContent = 'Database Supabase Terhubung';
      } else {
        badge.className = 'hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 border border-red-200 text-red-700 font-heading';
        text.textContent = 'Database Belum Terhubung';
      }
    }
  }

  // -------------------------------------------------------------
  // 4. TAB 1: OVERVIEW & RESET CONTROLS
  // -------------------------------------------------------------
  async function loadOverviewData() {
    try {
      const stats = await fetchRealCountStats();
      const { candidates, summary } = stats;

      document.getElementById('adm-total-voters').textContent = summary.totalVoters.toLocaleString('id-ID');
      document.getElementById('adm-voted-voters').textContent = summary.votedCount.toLocaleString('id-ID');
      document.getElementById('adm-turnout-pct').textContent = `${summary.turnoutPercent}% Partisipasi`;
      document.getElementById('adm-unvoted-voters').textContent = summary.unvotedCount.toLocaleString('id-ID');
      document.getElementById('adm-total-candidates').textContent = candidates.length;

      // Render per-category breakdown
      const container = document.getElementById('adm-overview-results');
      const categories = [
        { key: 'osis', title: 'Ketua & Wakil Ketua OSIS', color: 'teal', bgBadge: 'bg-[#007979]', barColor: 'bg-[#007979]' },
        { key: 'ambalan_putra', title: 'Pradana Ambalan Putra', color: 'amber', bgBadge: 'bg-amber-600', barColor: 'bg-amber-600' },
        { key: 'ambalan_putri', title: 'Pradana Ambalan Putri', color: 'rose', bgBadge: 'bg-rose-600', barColor: 'bg-rose-600' },
      ];

      container.innerHTML = categories.map(cat => {
        const cList = candidates.filter(c => c.position === cat.key).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
        const catTotal = cList.reduce((acc, c) => acc + (c.vote_count || 0), 0);

        return `
          <div class="white-card rounded-2xl p-5 border border-slate-200 space-y-4 shadow-xs">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200">
              <div class="flex items-center space-x-2">
                <span class="w-3 h-3 rounded-full ${cat.bgBadge}"></span>
                <h4 class="text-sm font-extrabold text-slate-900 font-heading">${cat.title}</h4>
              </div>
              <span class="text-xs font-bold text-slate-600 font-mono font-heading">Total: ${catTotal} Suara</span>
            </div>

            <div class="space-y-3">
              ${cList.length === 0 ? '<p class="text-xs text-slate-400">Belum ada kandidat terdaftar.</p>' : ''}
              ${cList.map(c => {
                const count = c.vote_count || 0;
                const pct = catTotal > 0 ? ((count / catTotal) * 100).toFixed(1) : 0;
                return `
                  <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div class="flex items-center justify-between text-xs mb-2">
                      <div class="flex items-center space-x-2">
                        <span class="px-1.5 py-0.5 rounded ${cat.bgBadge} text-white font-mono font-bold text-[10px] font-heading">#${String(c.candidate_number).padStart(2, '0')}</span>
                        <span class="font-bold text-slate-900 font-heading">${c.name}</span>
                        <span class="text-[11px] text-slate-500 font-sans">(${c.class_grade || '-'})</span>
                      </div>
                      <div class="flex items-center space-x-2 font-mono font-bold">
                        <span class="text-slate-900">${count} suara</span>
                        <span class="text-[#007979] text-xs">(${pct}%)</span>
                      </div>
                    </div>
                    <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div class="${cat.barColor} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error(e);
    }
  }

  // Reset actions
  document.getElementById('btn-reset-voters-status').addEventListener('click', async () => {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin mereset status semua pemilih menjadi "Belum Memilih"? Pemilih yang sudah vote akan bisa melakukan vote kembali.')) {
      try {
        await adminResetAllVotersStatus();
        alert('Berhasil! Status seluruh pemilih telah direset.');
        loadOverviewData();
      } catch (err) {
        alert('Gagal mereset: ' + err.message);
      }
    }
  });

  document.getElementById('btn-reset-all-votes').addEventListener('click', async () => {
    const confirmation = prompt('TINDAKAN BERBAHAYA: Ketik "RESET" untuk menghapus semua perolehan suara menjadi 0 dan mereset status pemilih:');
    if (confirmation === 'RESET') {
      try {
        await adminResetAllVotes();
        alert('Seluruh perolehan suara berhasil dikosongkan (0 suara).');
        loadOverviewData();
      } catch (err) {
        alert('Gagal: ' + err.message);
      }
    }
  });

  // -------------------------------------------------------------
  // 4.5. REPORT GENERATION & DOWNLOAD ACTIONS (CSV EXPORT)
  // -------------------------------------------------------------
  function setupReportActions() {
    const btnDownloadResults = document.getElementById('btn-download-results-csv');
    const btnDownloadVoters = document.getElementById('btn-download-voters-csv');

    if (btnDownloadResults) {
      btnDownloadResults.addEventListener('click', exportResultsCSV);
    }

    if (btnDownloadVoters) {
      btnDownloadVoters.addEventListener('click', exportVotersCSV);
    }
  }

  async function exportResultsCSV() {
    try {
      const stats = await fetchRealCountStats();
      const candidates = stats.candidates || [];
      const summary = stats.summary || {};

      const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }) + ' WIB';
      
      let csv = 'REKAPITULASI HASIL PERHITUNGAN SUARA E-VOTING\n';
      csv += 'SEKOLAH ISLAM TERPADU HARAPAN UMAT KARAWANG\n';
      csv += `Waktu Unduh: ${nowStr}\n`;
      csv += `Total DPT: ${summary.totalVoters || 0} Pemilih | Total Suara Masuk: ${summary.votedCount || 0} Suara (${summary.turnoutPercent || 0}%) | Belum Memilih: ${summary.unvotedCount || 0} Suara\n\n`;
      
      csv += 'Kategori Pemilihan,Nomor Urut,Nama Calon / Pasangan,Kelas / Jabatan,Perolehan Suara,Persentase Suara,Status / Keterangan\n';

      const categories = [
        { key: 'osis', title: 'Ketua & Wakil Ketua OSIS' },
        { key: 'ambalan_putra', title: 'Pradana Ambalan Putra' },
        { key: 'ambalan_putri', title: 'Pradana Ambalan Putri' }
      ];

      categories.forEach(cat => {
        const cList = candidates
          .filter(c => c.position === cat.key)
          .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
        
        const catTotal = cList.reduce((acc, c) => acc + (c.vote_count || 0), 0);
        const maxVotes = cList.length > 0 ? (cList[0].vote_count || 0) : 0;

        if (cList.length === 0) {
          csv += `"${cat.title}",-,"(Belum ada kandidat)",-,0,0.0%,-\n`;
        } else {
          cList.forEach((c, idx) => {
            const count = c.vote_count || 0;
            const pct = catTotal > 0 ? ((count / catTotal) * 100).toFixed(1) + '%' : '0.0%';
            const isWinner = idx === 0 && maxVotes > 0 && count === maxVotes;
            const status = isWinner ? 'TERPILIH' : 'Kandidat';
            const num = '#' + String(c.candidate_number || (idx + 1)).padStart(2, '0');
            const safeName = `"${(c.name || '').replace(/"/g, '""')}"`;
            const safeClass = `"${(c.class_grade || '-').replace(/"/g, '""')}"`;
            const safeCat = `"${cat.title}"`;
            
            csv += `${safeCat},${num},${safeName},${safeClass},${count},${pct},${status}\n`;
          });
        }
      });

      triggerCsvDownload(csv, 'rekap_hasil_pemilihan_harum.csv');
    } catch (err) {
      alert('Gagal mengekspor data: ' + err.message);
    }
  }

  async function exportVotersCSV() {
    try {
      const voters = await adminGetAllVoters();
      const total = voters.length;
      const voted = voters.filter(v => v.has_voted).length;
      const unvoted = total - voted;
      const pct = total > 0 ? ((voted / total) * 100).toFixed(1) : 0;
      const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }) + ' WIB';

      let csv = 'DAFTAR PEMILIH TETAP (DPT) & STATUS KEHADIRAN MEMILIH\n';
      csv += 'SEKOLAH ISLAM TERPADU HARAPAN UMAT KARAWANG\n';
      csv += `Waktu Unduh: ${nowStr}\n`;
      csv += `Total DPT: ${total} | Sudah Memilih: ${voted} (${pct}%) | Belum Memilih: ${unvoted}\n\n`;

      csv += 'No,NISN / NIP,Nama Lengkap,Kategori Pemilih,Status Memilih,Waktu Memilih\n';

      voters.forEach((v, idx) => {
        const safeId = `"${(v.id_number || '').replace(/"/g, '""')}"`;
        const safeName = `"${(v.name || '').replace(/"/g, '""')}"`;
        const role = v.role === 'guru' ? 'Guru / Tenaga Pendidik' : 'Siswa';
        const status = v.has_voted ? 'Sudah Memilih' : 'Belum Memilih';
        const votedAt = v.voted_at ? `"${new Date(v.voted_at).toLocaleString('id-ID')}"` : '-';
        csv += `${idx + 1},${safeId},${safeName},${role},${status},${votedAt}\n`;
      });

      triggerCsvDownload(csv, 'rekap_kehadiran_dpt_harum.csv');
    } catch (err) {
      alert('Gagal mengekspor data pemilih: ' + err.message);
    }
  }

  function triggerCsvDownload(csvText, filename) {
    const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  let allVotersList = [];
  let parsedCsvData = [];

  function setupVotersTab() {
    const csvInput = document.getElementById('csv-file-input');
    const previewStatus = document.getElementById('csv-preview-status');
    const previewText = document.getElementById('csv-preview-text');
    const btnProcessUpload = document.getElementById('btn-process-csv-upload');
    const btnDownloadTemplate = document.getElementById('btn-download-csv-template');
    const formAddSingle = document.getElementById('form-add-single-voter');

    const searchInput = document.getElementById('voters-search-input');
    const filterRole = document.getElementById('voters-filter-role');
    const filterStatus = document.getElementById('voters-filter-status');

    // Download CSV Template
    btnDownloadTemplate.addEventListener('click', () => {
      const csvContent = "data:text/csv;charset=utf-8," 
        + "id_number,name,role\n"
        + "0081234501,Aditya Pratama,siswa\n"
        + "0081234502,Bunga Citra Lestari,siswa\n"
        + "0081234503,Citra Dewi Permata,siswa\n"
        + "198501152010011002,Drs. H. Bambang Sudiro M.Pd.,guru\n"
        + "NIY2022091001,Dewi Lestari S.Pd.,guru\n";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "template_dpt_pemilu.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // CSV Parse on File select
    csvInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          const rawRows = results.data;
          parsedCsvData = rawRows.map(row => {
            const id_number = (row.id_number || row.ID || row.NISN || row.NIP || row.id || '').toString().trim();
            const name = (row.name || row.Nama || row.NAMA || row.nama || '').trim();
            let role = (row.role || row.Peran || row.ROLE || 'siswa').toLowerCase().trim();
            if (role !== 'guru') role = 'siswa';

            return { id_number, name, role, has_voted: false };
          }).filter(r => r.id_number && r.name);

          if (parsedCsvData.length === 0) {
            alert('Format file CSV tidak sesuai atau tidak ada baris data yang valid.');
            previewStatus.classList.add('hidden');
            return;
          }

          previewText.textContent = `File: "${file.name}" — ${parsedCsvData.length} baris data pemilih valid ditemukan.`;
          previewStatus.classList.remove('hidden');
        },
        error: function(err) {
          alert('Gagal membaca file CSV: ' + err.message);
        }
      });
    });

    // Process CSV Batch Save
    btnProcessUpload.addEventListener('click', async () => {
      if (parsedCsvData.length === 0) return;
      btnProcessUpload.disabled = true;
      btnProcessUpload.textContent = 'Menyimpan...';

      try {
        await adminBatchInsertVoters(parsedCsvData);
        alert(`Berhasil mengimpor ${parsedCsvData.length} data pemilih ke DPT!`);
        parsedCsvData = [];
        csvInput.value = '';
        previewStatus.classList.add('hidden');
        loadVotersData();
      } catch (err) {
        alert('Gagal mengimpor DPT: ' + err.message);
      } finally {
        btnProcessUpload.disabled = false;
        btnProcessUpload.textContent = 'Simpan ke Database';
      }
    });

    // Single Voter Add
    formAddSingle.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = document.getElementById('single-voter-role').value;
      const id_number = document.getElementById('single-voter-id').value.trim();
      const name = document.getElementById('single-voter-name').value.trim();

      if (!id_number || !name) return;

      try {
        await adminAddVoter({ id_number, name, role, has_voted: false });
        alert(`Pemilih "${name}" berhasil ditambahkan.`);
        formAddSingle.reset();
        loadVotersData();
      } catch (err) {
        alert('Gagal menambah pemilih: ' + err.message);
      }
    });

    // Filter & Search
    searchInput.addEventListener('input', renderVotersTable);
    filterRole.addEventListener('change', renderVotersTable);
    filterStatus.addEventListener('change', renderVotersTable);
  }

  async function loadVotersData() {
    try {
      allVotersList = await adminGetAllVoters();
      renderVotersTable();
    } catch (e) {
      console.error(e);
    }
  }

  function renderVotersTable() {
    const searchVal = (document.getElementById('voters-search-input')?.value || '').toLowerCase().trim();
    const filterRoleVal = document.getElementById('voters-filter-role')?.value || 'all';
    const filterStatusVal = document.getElementById('voters-filter-status')?.value || 'all';
    const tbody = document.getElementById('voters-table-body');
    const countEl = document.getElementById('voters-table-count');

    let filtered = allVotersList.filter(v => {
      const matchSearch = !searchVal || v.id_number.toLowerCase().includes(searchVal) || v.name.toLowerCase().includes(searchVal);
      const matchRole = filterRoleVal === 'all' || v.role === filterRoleVal;
      const matchStatus = filterStatusVal === 'all' || (filterStatusVal === 'voted' ? v.has_voted : !v.has_voted);
      return matchSearch && matchRole && matchStatus;
    });

    countEl.textContent = `Menampilkan ${filtered.length} dari total ${allVotersList.length} pemilih`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-500">
            Tidak ada data pemilih yang sesuai dengan pencarian/filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(v => {
      const isGuru = v.role === 'guru';
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 pl-4 font-mono font-bold text-slate-900">${v.id_number}</td>
          <td class="p-3 font-semibold text-slate-800">${v.name}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-heading ${
              isGuru 
                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                : 'bg-teal-50 text-[#007979] border border-teal-200'
            }">
              ${v.role}
            </span>
          </td>
          <td class="p-3">
            ${v.has_voted ? `
              <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 font-heading">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span>Sudah Memilih</span>
              </span>
            ` : `
              <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 font-heading">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Belum Memilih</span>
              </span>
            `}
          </td>
          <td class="p-3 pr-4 text-right space-x-1">
            ${v.has_voted ? `
              <button 
                class="btn-reset-single-voter p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all text-xs cursor-pointer" 
                title="Reset status agar bisa vote lagi"
                data-id="${v.id_number}"
              >
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
            <button 
              class="btn-delete-single-voter p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-all text-xs cursor-pointer" 
              title="Hapus pemilih dari DPT"
              data-id="${v.id_number}"
              data-name="${v.name}"
            >
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Table action listeners
    tbody.querySelectorAll('.btn-reset-single-voter').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await adminResetVoterStatus(id);
        loadVotersData();
      });
    });

    tbody.querySelectorAll('.btn-delete-single-voter').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Hapus pemilih "${name}" (${id}) dari daftar DPT?`)) {
          await adminDeleteVoter(id);
          loadVotersData();
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // 6. TAB 3: MANAGE CANDIDATES
  // -------------------------------------------------------------
  let allCandidatesList = [];

  function setupCandidatesTab() {
    const formCandidate = document.getElementById('form-candidate');
    const formTitle = document.getElementById('cand-form-title');
    const btnResetForm = document.getElementById('btn-cand-form-reset');

    const fileInput = document.getElementById('cand-file-input');
    const photoDropzone = document.getElementById('cand-photo-dropzone');
    const photoPreviewContainer = document.getElementById('cand-photo-preview-container');
    const photoPreviewImg = document.getElementById('cand-photo-preview-img');
    const btnChangePhoto = document.getElementById('btn-change-photo');
    const btnRemovePhoto = document.getElementById('btn-remove-photo');
    const candImageData = document.getElementById('cand-image-data');
    const btnToggleUrl = document.getElementById('btn-toggle-url-input');
    const candUrlInputBox = document.getElementById('cand-url-input-box');
    const candImageUrl = document.getElementById('cand-image-url');

    // Toggle URL Input box
    btnToggleUrl.addEventListener('click', () => {
      candUrlInputBox.classList.toggle('hidden');
      if (!candUrlInputBox.classList.contains('hidden')) {
        candImageUrl.focus();
      }
    });

    candImageUrl.addEventListener('input', () => {
      const urlVal = candImageUrl.value.trim();
      if (urlVal) {
        showPhotoPreview(urlVal);
      }
    });

    // Handle File Input Selection (PNG / JPG / WEBP)
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('File yang dipilih harus berupa gambar (PNG, JPG, JPEG, WEBP)!');
        fileInput.value = '';
        return;
      }

      // Read and compress image with Canvas
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const maxDimension = 900;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to high quality JPEG/WebP data URL
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          showPhotoPreview(compressedDataUrl);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    function showPhotoPreview(src) {
      candImageData.value = src;
      photoPreviewImg.src = src;
      photoPreviewContainer.classList.remove('hidden');
      photoDropzone.classList.add('hidden');
      if (window.lucide) window.lucide.createIcons();
    }

    function removePhoto() {
      candImageData.value = '';
      candImageUrl.value = '';
      fileInput.value = '';
      photoPreviewImg.src = '';
      photoPreviewContainer.classList.add('hidden');
      photoDropzone.classList.remove('hidden');
    }

    btnRemovePhoto.addEventListener('click', removePhoto);
    btnChangePhoto.addEventListener('click', () => {
      fileInput.click();
    });

    formCandidate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('cand-edit-id').value;
      const position = document.getElementById('cand-position').value;
      const candidate_number = parseInt(document.getElementById('cand-number').value, 10);
      const class_grade = document.getElementById('cand-class').value.trim();
      const name = document.getElementById('cand-name').value.trim();
      
      let image_url = candImageData.value.trim() || candImageUrl.value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
      const vision = document.getElementById('cand-vision').value.trim();
      const mission = document.getElementById('cand-mission').value.trim();

      const candidateData = {
        position,
        candidate_number,
        class_grade,
        name,
        image_url,
        vision,
        mission
      };

      try {
        if (editId) {
          await adminUpdateCandidate(editId, candidateData);
          alert(`Kandidat "${name}" berhasil diperbarui!`);
        } else {
          await adminAddCandidate(candidateData);
          alert(`Kandidat "${name}" berhasil ditambahkan!`);
        }

        resetCandidateForm();
        loadCandidatesData();
      } catch (err) {
        alert('Gagal menyimpan kandidat: ' + err.message);
      }
    });

    btnResetForm.addEventListener('click', resetCandidateForm);

    function resetCandidateForm() {
      formCandidate.reset();
      document.getElementById('cand-edit-id').value = '';
      removePhoto();
      candUrlInputBox.classList.add('hidden');
      formTitle.innerHTML = `
        <i data-lucide="user-check" class="w-4 h-4 text-[#007979]"></i>
        <span>Tambah Kandidat Baru</span>
      `;
      btnResetForm.classList.add('hidden');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async function loadCandidatesData() {
    try {
      const stats = await fetchRealCountStats();
      allCandidatesList = stats.candidates;
      renderCandidatesManagerList();
    } catch (e) {
      console.error(e);
    }
  }

  function renderCandidatesManagerList() {
    const container = document.getElementById('adm-candidates-list-container');
    const categories = [
      { key: 'osis', title: 'Kandidat Ketua OSIS', color: 'teal' },
      { key: 'ambalan_putra', title: 'Kandidat Pradana Ambalan Putra', color: 'amber' },
      { key: 'ambalan_putri', title: 'Kandidat Pradana Ambalan Putri', color: 'rose' },
    ];

    container.innerHTML = categories.map(cat => {
      const list = allCandidatesList.filter(c => c.position === cat.key).sort((a, b) => a.candidate_number - b.candidate_number);

      const isOsis = cat.key === 'osis';
      const isPa = cat.key === 'ambalan_putra';
      const badgeBg = isOsis ? 'bg-[#007979]' : (isPa ? 'bg-amber-600' : 'bg-rose-600');

      return `
        <div class="white-card rounded-2xl p-5 border border-slate-200 space-y-4 shadow-xs">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h4 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2 font-heading">
              <span class="w-2.5 h-2.5 rounded-full ${badgeBg}"></span>
              <span>${cat.title}</span>
            </h4>
            <span class="text-xs text-slate-500 font-semibold font-heading">${list.length} Calon Terdaftar</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${list.length === 0 ? '<p class="text-xs text-slate-400 col-span-full">Belum ada kandidat di kategori ini.</p>' : ''}
            ${list.map(c => `
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                <div class="flex items-start space-x-3">
                  <img 
                    src="${c.image_url}" 
                    alt="${c.name}" 
                    class="w-12 h-14 rounded-xl object-cover object-top border border-slate-300 flex-shrink-0 bg-white shadow-2xs"
                    onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center space-x-1.5">
                      <span class="px-1.5 py-0.5 rounded ${badgeBg} text-white font-mono font-bold text-[10px] font-heading">#${String(c.candidate_number).padStart(2, '0')}</span>
                      <span class="text-[11px] text-slate-500 truncate font-sans">${c.class_grade || '-'}</span>
                    </div>
                    <h5 class="text-xs font-bold text-slate-900 truncate mt-1 font-heading">${c.name}</h5>
                    <p class="text-[11px] text-slate-600 mt-1 line-clamp-2 italic font-normal">"${c.vision}"</p>
                  </div>
                </div>

                <div class="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span class="text-slate-600 font-mono">Suara: <strong class="text-slate-900">${c.vote_count || 0}</strong></span>
                  <div class="flex items-center space-x-1.5">
                    <button class="btn-edit-cand px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[#007979] hover:bg-[#007979] hover:text-white text-[11px] font-bold transition-all flex items-center space-x-1 font-heading cursor-pointer" data-id="${c.id}">
                      <i data-lucide="edit-3" class="w-3 h-3"></i>
                      <span>Edit</span>
                    </button>
                    <button class="btn-delete-cand p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white text-[11px] transition-all cursor-pointer" data-id="${c.id}" data-name="${c.name}" title="Hapus Kandidat">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Actions
    container.querySelectorAll('.btn-edit-cand').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const c = allCandidatesList.find(x => x.id === id);
        if (!c) return;

        document.getElementById('cand-edit-id').value = c.id;
        document.getElementById('cand-position').value = c.position;
        document.getElementById('cand-number').value = c.candidate_number;
        document.getElementById('cand-class').value = c.class_grade || '';
        document.getElementById('cand-name').value = c.name;
        document.getElementById('cand-image-url').value = c.image_url || '';
        document.getElementById('cand-vision').value = c.vision || '';
        document.getElementById('cand-mission').value = c.mission || '';

        // Show photo preview if exists
        if (c.image_url) {
          document.getElementById('cand-image-data').value = c.image_url;
          document.getElementById('cand-photo-preview-img').src = c.image_url;
          document.getElementById('cand-photo-preview-container').classList.remove('hidden');
          document.getElementById('cand-photo-dropzone').classList.add('hidden');
        }

        document.getElementById('cand-form-title').innerHTML = `
          <i data-lucide="edit-3" class="w-4 h-4 text-amber-400"></i>
          <span>Edit Kandidat #${c.candidate_number}</span>
        `;
        document.getElementById('btn-cand-form-reset').classList.remove('hidden');

        // Scroll form into view
        document.getElementById('form-candidate').scrollIntoView({ behavior: 'smooth' });
        if (window.lucide) window.lucide.createIcons();
      });
    });

    container.querySelectorAll('.btn-delete-cand').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Hapus kandidat "${name}"? Data perolehan suara kandidat ini juga akan terhapus.`)) {
          await adminDeleteCandidate(id);
          loadCandidatesData();
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // 7. TAB 4: DATABASE & DEPLOYMENT SETUP
  // -------------------------------------------------------------
  async function setupSettingsTab() {
    // A. Voting Scope Setup
    const formScope = document.getElementById('form-voting-scope');
    const chkOsis = document.getElementById('chk-scope-osis');
    const chkPa = document.getElementById('chk-scope-pa');
    const chkPi = document.getElementById('chk-scope-pi');
    const activeScopeBadge = document.getElementById('active-scope-badge');
    const activeScopeText = document.getElementById('active-scope-text');
    const scopeRadios = document.querySelectorAll('input[name="scope-preset"]');

    // Load initial settings
    try {
      const curSettings = await fetchElectionSettings();
      const activeCats = curSettings.active_categories || ['osis', 'ambalan_putra', 'ambalan_putri'];
      
      chkOsis.checked = activeCats.includes('osis');
      chkPa.checked = activeCats.includes('ambalan_putra');
      chkPi.checked = activeCats.includes('ambalan_putri');

      updateScopeBadgeDisplay(activeCats);
      syncScopeRadiosFromCheckboxes();
    } catch (e) {
      console.warn('Failed to load election settings:', e);
    }

    function updateScopeBadgeDisplay(cats) {
      if (cats.length === 3) {
        activeScopeText.textContent = 'Semua Kategori (OSIS + Ambalan)';
      } else if (cats.length === 1 && cats.includes('osis')) {
        activeScopeText.textContent = 'Hanya Ketua OSIS';
      } else if (cats.length === 2 && cats.includes('ambalan_putra') && cats.includes('ambalan_putri')) {
        activeScopeText.textContent = 'Hanya Ambalan (Pa & Pi)';
      } else {
        activeScopeText.textContent = `Kustom (${cats.length} Kategori)`;
      }
    }

    function syncScopeRadiosFromCheckboxes() {
      const hasOsis = chkOsis.checked;
      const hasPa = chkPa.checked;
      const hasPi = chkPi.checked;

      if (hasOsis && hasPa && hasPi) {
        setRadioVal('all');
      } else if (hasOsis && !hasPa && !hasPi) {
        setRadioVal('osis_only');
      } else if (!hasOsis && hasPa && hasPi) {
        setRadioVal('ambalan_only');
      } else {
        scopeRadios.forEach(r => r.checked = false);
      }
    }

    function setRadioVal(val) {
      scopeRadios.forEach(r => {
        r.checked = (r.value === val);
      });
    }

    scopeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const val = radio.value;
        if (val === 'all') {
          chkOsis.checked = true;
          chkPa.checked = true;
          chkPi.checked = true;
        } else if (val === 'osis_only') {
          chkOsis.checked = true;
          chkPa.checked = false;
          chkPi.checked = false;
        } else if (val === 'ambalan_only') {
          chkOsis.checked = false;
          chkPa.checked = true;
          chkPi.checked = true;
        }
      });
    });

    [chkOsis, chkPa, chkPi].forEach(chk => {
      chk.addEventListener('change', () => {
        syncScopeRadiosFromCheckboxes();
      });
    });

    formScope.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedCats = [];
      if (chkOsis.checked) selectedCats.push('osis');
      if (chkPa.checked) selectedCats.push('ambalan_putra');
      if (chkPi.checked) selectedCats.push('ambalan_putri');

      if (selectedCats.length === 0) {
        alert('Peringatan: Anda harus memilih minimal 1 kategori yang aktif!');
        return;
      }

      let voteScopeKey = 'custom';
      if (selectedCats.length === 3) voteScopeKey = 'all';
      else if (selectedCats.length === 1 && selectedCats.includes('osis')) voteScopeKey = 'osis_only';
      else if (selectedCats.length === 2 && selectedCats.includes('ambalan_putra') && selectedCats.includes('ambalan_putri')) voteScopeKey = 'ambalan_only';

      try {
        await saveElectionSettings({
          vote_scope: voteScopeKey,
          active_categories: selectedCats
        });
        updateScopeBadgeDisplay(selectedCats);
        alert('Pengaturan kategori berhasil disimpan! Bilik suara kini akan menampilkan kategori yang dipilih.');
      } catch (err) {
        alert('Gagal menyimpan pengaturan: ' + err.message);
      }
    });

    // B. Supabase Config Setup
    const formConfig = document.getElementById('form-supabase-config');
    const inputUrl = document.getElementById('cfg-supabase-url');
    const inputKey = document.getElementById('cfg-supabase-key');
    const btnClear = document.getElementById('btn-clear-supabase-config');
    const btnCopySql = document.getElementById('btn-copy-sql');
    const copySqlText = document.getElementById('copy-sql-text');

    if (inputUrl && inputKey) {
      const curConfig = getSupabaseConfig();
      inputUrl.value = curConfig.url || '';
      inputKey.value = curConfig.key || '';
    }

    if (formConfig && inputUrl && inputKey) {
      formConfig.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = inputUrl.value.trim();
        const key = inputKey.value.trim();

        if (!url || !key) {
          alert('Silakan masukkan Project URL dan Anon Key.');
          return;
        }

        saveSupabaseConfig(url, key);
        alert('Kredensial Supabase berhasil disimpan! Website sekarang terhubung ke database Supabase Anda.');
        updateDbStatusBadge();
        window.location.reload();
      });
    }

    if (btnCopySql && copySqlText) {
      btnCopySql.addEventListener('click', async () => {
        try {
          const sqlScript = `-- Salin dan jalankan di SQL Editor Supabase
CREATE TABLE IF NOT EXISTS public.voters (
  id_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'siswa',
  has_voted BOOLEAN DEFAULT FALSE,
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;
          await navigator.clipboard.writeText(sqlScript);
          copySqlText.textContent = 'Tersalin!';
          setTimeout(() => { copySqlText.textContent = 'Salin Script SQL'; }, 2000);
        } catch (e) {
          console.warn(e);
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Bersihkan kredensial Supabase tersimpan?')) {
          clearSupabaseConfig();
          alert('Konfigurasi dibersihkan.');
          window.location.reload();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // 6. TAB 4: PERSONALISASI & TAMPILAN
  // -------------------------------------------------------------
  let tempCustomBg = null;
  let tempCustomLogo = null;

  async function loadPersonalizationData() {
    try {
      const settings = await fetchElectionSettings();
      const schoolNameInput = document.getElementById('pers-school-name');
      const electionTitleInput = document.getElementById('pers-election-title');
      const electionPeriodInput = document.getElementById('pers-election-period');

      if (schoolNameInput && settings.school_name) schoolNameInput.value = settings.school_name;
      if (electionTitleInput && settings.election_title) electionTitleInput.value = settings.election_title;
      if (electionPeriodInput && settings.election_period) electionPeriodInput.value = settings.election_period;
    } catch (e) {
      console.warn('Gagal memuat setting identitas:', e);
    }
  }

  function setupPersonalizationTab() {
    loadPersonalizationData();

    // A. Background Controls
    const bgInput = document.getElementById('pers-bg-file-input');
    const bgPreview = document.getElementById('pers-bg-preview-img');
    const bgOpacitySlider = document.getElementById('pers-bg-opacity-slider');
    const bgOpacityVal = document.getElementById('pers-bg-opacity-val');
    const btnSaveBg = document.getElementById('btn-pers-save-bg');
    const btnResetBg = document.getElementById('btn-pers-reset-bg');

    // Init existing background & opacity
    const savedBg = localStorage.getItem('custom_bg_school');
    const savedOpacity = localStorage.getItem('custom_bg_opacity') || '30';

    if (savedBg && bgPreview) {
      bgPreview.src = savedBg;
      tempCustomBg = savedBg;
    }
    if (bgOpacitySlider && bgOpacityVal && bgPreview) {
      bgOpacitySlider.value = savedOpacity;
      bgOpacityVal.textContent = `${savedOpacity}%`;
      bgPreview.style.opacity = (parseFloat(savedOpacity) / 100).toString();

      bgOpacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        bgOpacityVal.textContent = `${val}%`;
        bgPreview.style.opacity = (parseFloat(val) / 100).toString();
      });
    }

    if (bgInput) {
      bgInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            tempCustomBg = evt.target.result;
            if (bgPreview) bgPreview.src = tempCustomBg;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (btnSaveBg) {
      btnSaveBg.addEventListener('click', () => {
        if (tempCustomBg) {
          localStorage.setItem('custom_bg_school', tempCustomBg);
        }
        if (bgOpacitySlider) {
          localStorage.setItem('custom_bg_opacity', bgOpacitySlider.value);
        }
        applyCustomBranding();
        alert('Background sekolah dan tingkat transparansi berhasil disimpan!');
      });
    }

    if (btnResetBg) {
      btnResetBg.addEventListener('click', () => {
        if (confirm('Kembalikan latar belakang ke background bawaan?')) {
          localStorage.removeItem('custom_bg_school');
          localStorage.removeItem('custom_bg_opacity');
          tempCustomBg = null;
          if (bgPreview) {
            bgPreview.src = '/bg-school.png';
            bgPreview.style.opacity = '0.3';
          }
          if (bgOpacitySlider && bgOpacityVal) {
            bgOpacitySlider.value = '30';
            bgOpacityVal.textContent = '30%';
          }
          applyCustomBranding();
          alert('Latar belakang dikembalikan ke default.');
        }
      });
    }

    // B. Logo Controls
    const logoInput = document.getElementById('pers-logo-file-input');
    const logoCircle = document.getElementById('pers-logo-preview-circle');
    const logoSquare = document.getElementById('pers-logo-preview-square');
    const btnSaveLogo = document.getElementById('btn-pers-save-logo');
    const btnResetLogo = document.getElementById('btn-pers-reset-logo');

    const savedLogo = localStorage.getItem('custom_logo_school');
    if (savedLogo) {
      tempCustomLogo = savedLogo;
      if (logoCircle) logoCircle.src = savedLogo;
      if (logoSquare) logoSquare.src = savedLogo;
    }

    if (logoInput) {
      logoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            tempCustomLogo = evt.target.result;
            if (logoCircle) logoCircle.src = tempCustomLogo;
            if (logoSquare) logoSquare.src = tempCustomLogo;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (btnSaveLogo) {
      btnSaveLogo.addEventListener('click', () => {
        if (!tempCustomLogo) {
          alert('Silakan pilih file gambar logo terlebih dahulu.');
          return;
        }
        localStorage.setItem('custom_logo_school', tempCustomLogo);
        applyCustomBranding();
        alert('Logo resmi baru berhasil disimpan dan diterapkan!');
      });
    }

    if (btnResetLogo) {
      btnResetLogo.addEventListener('click', () => {
        if (confirm('Kembalikan logo ke Logo Resmi SIT Harapan Umat Karawang?')) {
          localStorage.removeItem('custom_logo_school');
          tempCustomLogo = null;
          if (logoCircle) logoCircle.src = '/logo-harum.png';
          if (logoSquare) logoSquare.src = '/logo-harum.png';
          applyCustomBranding();
          alert('Logo dikembalikan ke Logo SIT Harapan Umat Karawang.');
        }
      });
    }

    // C. Form Identitas Pemilihan
    const formIdentity = document.getElementById('form-pers-identity');
    const schoolNameInput = document.getElementById('pers-school-name');
    const electionTitleInput = document.getElementById('pers-election-title');
    const electionPeriodInput = document.getElementById('pers-election-period');

    if (formIdentity) {
      formIdentity.addEventListener('submit', async (e) => {
        e.preventDefault();
        const school_name = schoolNameInput ? schoolNameInput.value.trim() : 'SIT HARAPAN UMAT KARAWANG';
        const election_title = electionTitleInput ? electionTitleInput.value.trim() : 'PEMILIHAN KETUA OSIS & PRADANA AMBALAN';
        const election_period = electionPeriodInput ? electionPeriodInput.value.trim() : '2026/2027';

        try {
          await saveElectionSettings({
            school_name,
            election_title,
            election_period
          });
          localStorage.setItem('custom_school_name', school_name);
          alert('Identitas pemilihan berhasil disimpan ke database!');
        } catch (err) {
          alert('Gagal menyimpan identitas: ' + err.message);
        }
      });
    }
  }

  function applyCustomBranding() {
    const customBg = localStorage.getItem('custom_bg_school');
    const customOpacity = localStorage.getItem('custom_bg_opacity');
    const customLogo = localStorage.getItem('custom_logo_school');

    const bgImages = document.querySelectorAll('#school-bg-image');
    bgImages.forEach(img => {
      if (customBg) img.src = customBg;
      else img.src = '/bg-school.png';

      if (customOpacity) {
        img.style.opacity = (parseFloat(customOpacity) / 100).toString();
      }
    });

    if (customLogo) {
      const logoImgs = document.querySelectorAll('img[src*="logo-harum"], img[alt*="Logo"], img[alt*="SIT Harapan Umat"]');
      logoImgs.forEach(img => {
        img.src = customLogo;
      });
    }
  }

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
        ? `<i data-lucide="minimize" class="w-3.5 h-3.5 text-[#007979]"></i><span class="hidden sm:inline">Keluar Layar Penuh</span>`
        : `<i data-lucide="maximize" class="w-3.5 h-3.5 text-[#007979]"></i><span class="hidden sm:inline">Layar Penuh</span>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Apply branding initially
  applyCustomBranding();

});
