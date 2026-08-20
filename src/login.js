import { checkVoter } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  // Sync custom school background image if set
  try {
    const customBg = localStorage.getItem('custom_bg_school');
    const bgImgEl = document.getElementById('school-bg-image');
    if (customBg && bgImgEl) {
      bgImgEl.src = customBg;
    }
  } catch (e) {}

  // Clear previous voter session on login page load
  try {
    sessionStorage.removeItem('evote_current_voter');
  } catch (e) {}

  let currentRole = 'siswa'; // 'siswa' or 'guru'

  const tabSiswa = document.getElementById('tab-siswa');
  const tabGuru = document.getElementById('tab-guru');
  const inputLabel = document.getElementById('input-label');
  const idInput = document.getElementById('id-number');
  const inputHint = document.getElementById('input-hint');
  const loginForm = document.getElementById('login-form');
  const btnLogin = document.getElementById('btn-login');
  const alertBox = document.getElementById('alert-box');

  function setRole(role) {
    currentRole = role;
    hideAlert();
    if (idInput) {
      idInput.value = '';
      idInput.focus();
    }

    if (role === 'siswa') {
      if (tabSiswa) tabSiswa.className = 'flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all bg-blue-800 text-white shadow-sm font-heading cursor-pointer';
      if (tabGuru) tabGuru.className = 'flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 font-heading cursor-pointer';
      if (inputLabel) inputLabel.textContent = 'Nomor Induk Siswa Nasional (NISN)';
      if (idInput) idInput.placeholder = 'Masukkan Nomor NISN';
      if (inputHint) {
        inputHint.innerHTML = `
          <svg class="w-3.5 h-3.5 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="12" y1="16" x2="12" y2="12" stroke-width="2"></line><line x1="12" y1="8" x2="12.01" y2="8" stroke-width="2"></line></svg>
          <span>Siswa memasukkan NISN yang terdaftar di Daftar Pemilih Tetap (DPT).</span>
        `;
      }
    } else {
      if (tabGuru) tabGuru.className = 'flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all bg-amber-600 text-white shadow-sm font-heading cursor-pointer';
      if (tabSiswa) tabSiswa.className = 'flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 font-heading cursor-pointer';
      if (inputLabel) inputLabel.textContent = 'Nomor Induk Pegawai / Yayasan (NIP/NIY)';
      if (idInput) idInput.placeholder = 'Masukkan Nomor NIP atau NIY';
      if (inputHint) {
        inputHint.innerHTML = `
          <svg class="w-3.5 h-3.5 text-amber-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="12" y1="16" x2="12" y2="12" stroke-width="2"></line><line x1="12" y1="8" x2="12.01" y2="8" stroke-width="2"></line></svg>
          <span>Bapak/Ibu Guru & Pembina menggunakan NIP atau NIY resmi.</span>
        `;
      }
    }
  }

  if (tabSiswa) tabSiswa.addEventListener('click', () => setRole('siswa'));
  if (tabGuru) tabGuru.addEventListener('click', () => setRole('guru'));

  function showAlert(message, type = 'error') {
    if (!alertBox) return;

    alertBox.className = 'p-3.5 rounded-xl border text-xs sm:text-sm flex items-start space-x-2.5 transition-all duration-200';

    let iconSvg = '';
    if (type === 'error') {
      alertBox.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
      iconSvg = `<svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="12" y1="8" x2="12" y2="12" stroke-width="2"></line><line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2"></line></svg>`;
    } else if (type === 'warning') {
      alertBox.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-800');
      iconSvg = `<svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else if (type === 'loading') {
      alertBox.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800');
      iconSvg = `<div class="w-4 h-4 mt-0.5 border-2 border-blue-800/30 border-t-blue-800 rounded-full animate-spin flex-shrink-0"></div>`;
    } else if (type === 'success') {
      alertBox.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-800');
      iconSvg = `<svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    alertBox.innerHTML = `
      ${iconSvg}
      <div class="flex-1 leading-relaxed">${message}</div>
    `;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.classList.add('hidden');
      alertBox.innerHTML = '';
    }
  }

  function resetButtonState() {
    if (idInput) idInput.disabled = false;
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.className = 'w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white bg-blue-800 hover:bg-blue-900 active:scale-[0.99] transition-all shadow-md shadow-blue-800/20 flex items-center justify-center space-x-2 cursor-pointer font-heading';
      btnLogin.innerHTML = `
        <span>Verifikasi & Masuk Bilik Suara</span>
        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke-width="2"></line><polyline points="12 5 19 12 12 19" stroke-width="2"></polyline></svg>
      `;
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idVal = (idInput ? idInput.value : '').trim();

      if (!idVal) {
        showAlert('Silakan masukkan nomor identitas (NISN / NIP / NIY) Anda.', 'error');
        if (idInput) idInput.focus();
        return;
      }

      // 1. Show immediate loading state
      if (idInput) idInput.disabled = true;
      if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.className = 'w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white bg-blue-900 transition-all shadow-md flex items-center justify-center space-x-2 cursor-wait font-heading opacity-90';
        btnLogin.innerHTML = `
          <div class="w-5 h-5 border-2 border-white/30 border-t-amber-400 rounded-full animate-spin"></div>
          <span class="text-amber-300">Memeriksa Data Pemilih...</span>
        `;
      }

      showAlert(`<strong>Sedang Memverifikasi:</strong> Memeriksa nomor identitas <code>${idVal}</code> pada DPT...`, 'loading');

      try {
        const result = await checkVoter(idVal);

        if (!result || !result.exists) {
          resetButtonState();
          showAlert(`<strong>Tidak Terdaftar!</strong><br>${result?.message || 'Nomor identitas tidak ditemukan dalam Daftar Pemilih Tetap (DPT).' }`, 'error');
          if (idInput) idInput.focus();
          return;
        }

        if (result.hasVoted) {
          resetButtonState();
          showAlert(`<strong>Hak Suara Telah Digunakan!</strong><br>Pemilih atas nama <strong>${result.voter?.name || 'Peserta'}</strong> telah mengirimkan suara pada pemilihan ini. Setiap pemilih hanya dapat memilih 1 kali.`, 'warning');
          return;
        }

        // Save voter session
        sessionStorage.setItem('evote_current_voter', JSON.stringify(result.voter));

        // Show success feedback
        showAlert(`<strong>Verifikasi Berhasil!</strong> Selamat datang, <strong>${result.voter?.name || 'Peserta'}</strong>. Membuka bilik suara digital...`, 'success');
        if (btnLogin) {
          btnLogin.className = 'w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white bg-emerald-600 shadow-md flex items-center justify-center space-x-2 font-heading';
          btnLogin.innerHTML = `
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke-width="2"></polyline></svg>
            <span>Verifikasi Sukses! Membuka Bilik...</span>
          `;
        }

        setTimeout(() => {
          window.location.href = '/vote.html';
        }, 400);

      } catch (err) {
        console.error('Login exception:', err);
        resetButtonState();
        showAlert(`Terjadi kendala saat memeriksa data: ${err.message || 'Silakan periksa koneksi internet Anda.'}`, 'error');
      }
    });
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
        ? `<i data-lucide="minimize" class="w-4 h-4 text-blue-800"></i><span class="hidden sm:inline">Keluar Layar Penuh</span>`
        : `<i data-lucide="maximize" class="w-4 h-4 text-blue-800"></i><span class="hidden sm:inline">Layar Penuh</span>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Initial icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
