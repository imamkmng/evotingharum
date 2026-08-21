import confetti from 'canvas-confetti';

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

  // Clear voter voting session for security
  sessionStorage.removeItem('evote_current_voter');

  // 1. Trigger celebration confetti
  try {
    const canvas = document.getElementById('confetti-canvas');
    if (canvas) {
      const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });
      myConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setTimeout(() => {
        myConfetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        myConfetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }
  } catch (e) {
    console.warn('Confetti error:', e);
  }

  // 2. Load and render receipt
  const receiptRaw = sessionStorage.getItem('evote_receipt');
  if (receiptRaw) {
    try {
      const receipt = JSON.parse(receiptRaw);
      const nameEl = document.getElementById('receipt-voter-name');
      const roleEl = document.getElementById('receipt-voter-role');
      const idEl = document.getElementById('receipt-voter-id');
      const timeEl = document.getElementById('receipt-timestamp');
      const codeEl = document.getElementById('receipt-code');

      if (nameEl) nameEl.textContent = receipt.voterName || 'Peserta';
      if (roleEl) roleEl.textContent = receipt.voterRole === 'guru' ? 'Guru / Tenaga Pendidik' : 'Siswa';
      if (idEl) idEl.textContent = receipt.voterId || '-';
      
      if (timeEl && receipt.timestamp) {
        const d = new Date(receipt.timestamp);
        timeEl.textContent = d.toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        });
      }

      // Generate verification receipt ID
      if (codeEl) {
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        codeEl.textContent = `TOKEN: EV-${randomCode}`;
      }

    } catch (err) {
      console.error(err);
    }
  }

  // 3. 10-Second Automatic Redirect Countdown
  let secondsRemaining = 10;
  const countdownNumberEl = document.getElementById('countdown-number');
  const countdownSecondsEl = document.getElementById('countdown-seconds');
  const countdownCircle = document.getElementById('countdown-circle');
  const totalLength = 125.6; // 2 * PI * r (r=20)

  const countdownInterval = setInterval(() => {
    secondsRemaining--;

    if (countdownNumberEl) countdownNumberEl.textContent = secondsRemaining;
    if (countdownSecondsEl) countdownSecondsEl.textContent = secondsRemaining;

    if (countdownCircle) {
      const offset = totalLength * (1 - secondsRemaining / 10);
      countdownCircle.style.strokeDashoffset = offset;
    }

    if (secondsRemaining <= 0) {
      clearInterval(countdownInterval);
      window.location.href = '/index.html';
    }
  }, 1000);

  // Manual exit button click clears countdown
  const btnManualExit = document.getElementById('btn-manual-exit');
  if (btnManualExit) {
    btnManualExit.addEventListener('click', () => {
      clearInterval(countdownInterval);
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
        ? `<i data-lucide="minimize" class="w-4 h-4 text-[#007979]"></i><span class="hidden sm:inline">Keluar Layar Penuh</span>`
        : `<i data-lucide="maximize" class="w-4 h-4 text-[#007979]"></i><span class="hidden sm:inline">Layar Penuh</span>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }
});
