import { createClient } from '@supabase/supabase-js';

// Default mock data when Supabase is not configured yet
const MOCK_STORAGE_KEY_VOTERS = 'evote_mock_voters';
const MOCK_STORAGE_KEY_CANDIDATES = 'evote_mock_candidates';
const CONFIG_STORAGE_KEY = 'evote_supabase_config';

const INITIAL_MOCK_CANDIDATES = [
  // OSIS
  {
    id: 'osis-1',
    candidate_number: 1,
    name: 'Muhammad Arya Pratama & Siti Nurhaliza',
    position: 'osis',
    class_grade: 'XI MIPA 1 & XI IPS 2',
    vision: 'Mewujudkan OSIS yang aspiratif, berkarakter unggul, inovatif, dan berlandaskan iman serta teknologi.',
    mission: '1. Menampung dan merealisasikan aspirasi siswa secara transparan.\n2. Mengembangkan kegiatan ekstrakurikuler berbasis digital dan kreativitas.\n3. Mempererat kolaborasi antara siswa, guru, dan pihak sekolah.',
    image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    vote_count: 142
  },
  {
    id: 'osis-2',
    candidate_number: 2,
    name: 'Dimas Aditya & Amanda Putri Kirana',
    position: 'osis',
    class_grade: 'XI MIPA 3 & XI MIPA 2',
    vision: 'Membangun generasi pelajar yang disiplin, berprestasi, peduli lingkungan, dan berwawasan global.',
    mission: '1. Menyelenggarakan pekan inovasi ilmiah dan seni tahunan.\n2. Menggalakkan program eco-school dan kepedulian sosial.\n3. Meningkatkan kedisiplinan dan rasa tanggung jawab siswa.',
    image_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
    vote_count: 189
  },
  {
    id: 'osis-3',
    candidate_number: 3,
    name: 'Raka Fathir Al-Ghifari & Zahra Maulida',
    position: 'osis',
    class_grade: 'XI IPS 1 & XI Bahasa',
    vision: 'Menjadikan OSIS wadah sinergi, solidaritas tinggi, dan pendorong prestasi akademik maupun non-akademik.',
    mission: '1. Membuka forum dialog terbuka setiap bulan.\n2. Mengoptimalkan media sosial sekolah untuk edukasi positif.\n3. Mengadakan pelatihan kepemimpinan untuk seluruh perwakilan kelas.',
    image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    vote_count: 98
  },
  // Ambalan Putra
  {
    id: 'ambalan-pa-1',
    candidate_number: 1,
    name: 'Fajar Nugraha',
    position: 'ambalan_putra',
    class_grade: 'XI MIPA 2 (Pradana Putra)',
    vision: 'Mewujudkan Pramuka Penegak yang tangguh, berbudi luhur, berjiwa korsa, dan berwawasan masa depan.',
    mission: '1. Meningkatkan keterampilan kepramukaan (scouting skills) modern.\n2. Mengadakan giat prestasi dan bakti sosial masyarakat berkala.\n3. Menanamkan nilai Dasa Darma dalam keseharian anggota.',
    image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
    vote_count: 220
  },
  {
    id: 'ambalan-pa-2',
    candidate_number: 2,
    name: 'Bima Satria Wicaksana',
    position: 'ambalan_putra',
    class_grade: 'XI IPS 3 (Pradana Putra)',
    vision: 'Menjadikan Gerakan Pramuka wadah eksplorasi potensi diri, petualangan positif, dan persaudaraan tanpa batas.',
    mission: '1. Memperbanyak kegiatan luar ruangan (outdoor survival & camping).\n2. Membangun kerjasama antar pangkalan dan ambalan se-wilayah.\n3. Penguatan karakter mandiri dan siap kerja bagi penegak.',
    image_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&auto=format&fit=crop&q=80',
    vote_count: 209
  },
  // Ambalan Putri
  {
    id: 'ambalan-pi-1',
    candidate_number: 1,
    name: 'Nabila Shafa Maharani',
    position: 'ambalan_putri',
    class_grade: 'XI MIPA 1 (Pradana Putri)',
    vision: 'Membentuk Pramuka Penegak Putri yang berintegritas, mandiri, peduli, dan berdaya saing tinggi.',
    mission: '1. Membudayakan literasi dan keterampilan kerajinan/kewirausahaan penegak putri.\n2. Optimalisasi latihan mingguan yang seru dan aplikatif.\n3. Menjadi pelopor ketertiban dan kebersihan lingkungan sekolah.',
    image_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
    vote_count: 245
  },
  {
    id: 'ambalan-pi-2',
    candidate_number: 2,
    name: 'Syifa Aulia Rahmadani',
    position: 'ambalan_putri',
    class_grade: 'XI IPS 2 (Pradana Putri)',
    vision: 'Mewujudkan Ambalan Putri yang solid, aktif berprestasi, dan menginspirasi seluruh warga sekolah.',
    mission: '1. Menyelenggarakan kursus pertolongan pertama (P3K) dan tali temali tingkat mahir.\n2. Menggiatkan aksi peduli sesama dan penghijauan bumi perkemahan.\n3. Membangun komunikasi yang harmonis antar tingkatan sangga.',
    image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    vote_count: 184
  }
];

const INITIAL_MOCK_VOTERS = [
  { id_number: '0081234501', name: 'Aditya Pratama', role: 'siswa', has_voted: false },
  { id_number: '0081234502', name: 'Bunga Citra Lestari', role: 'siswa', has_voted: true },
  { id_number: '0081234503', name: 'Citra Dewi Permata', role: 'siswa', has_voted: false },
  { id_number: '0081234504', name: 'Deni Kurniawan', role: 'siswa', has_voted: false },
  { id_number: '0081234505', name: 'Eka Novitasari', role: 'siswa', has_voted: false },
  { id_number: '0081234506', name: 'Farhan Ramadhan', role: 'siswa', has_voted: false },
  { id_number: '0081234507', name: 'Gita Gutawa', role: 'siswa', has_voted: false },
  { id_number: '0081234508', name: 'Hendra Wijaya', role: 'siswa', has_voted: false },
  { id_number: '198501152010011002', name: 'Drs. H. Bambang Sudiro, M.Pd.', role: 'guru', has_voted: false },
  { id_number: '199008202014022001', name: 'Siti Rahmawati, S.Pd.', role: 'guru', has_voted: true },
  { id_number: '198803122012011003', name: 'Ahmad Fauzi, S.Kom., M.T.I.', role: 'guru', has_voted: false },
  { id_number: 'NIY2022091001', name: 'Dewi Lestari, S.Pd. (Pembina Pramuka)', role: 'guru', has_voted: false }
];

// Helper to initialize local mock storage
function initMockStorage() {
  if (!localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES)) {
    localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(INITIAL_MOCK_CANDIDATES));
  }
  if (!localStorage.getItem(MOCK_STORAGE_KEY_VOTERS)) {
    localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(INITIAL_MOCK_VOTERS));
  }
}

initMockStorage();

// ============================================================================
// 🔑 KONFIGURASI DATABASE SUPABASE (LANGSUNG DI FILE)
// Masukkan Project URL dan Anon Key dari Supabase Anda di bawah ini:
// ============================================================================
export const DEFAULT_SUPABASE_URL = "https://cdpxdysfxzkybbxqnwdq.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcHhkeXNmeHpreWJieHFud2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNDAwODAsImV4cCI6MjEwMjgxNjA4MH0.3WwRM3OM82FFQnt1BcUi9mSlmXXkCwZN1pULflfv3YA";
// ============================================================================

// Get Supabase Client (from ENV, File Constant, or LocalStorage)
export function getSupabaseConfig() {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || '';
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || '';

  const localSaved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      if (parsed.url && parsed.key) {
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
  }

  return {
    url: envUrl,
    key: envKey,
  };
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
}

export function clearSupabaseConfig() {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

let supabaseInstance = null;

export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (config.url && config.key && config.url.startsWith('http')) {
    if (!supabaseInstance || supabaseInstance.supabaseUrl !== config.url) {
      supabaseInstance = createClient(config.url, config.key);
    }
    return supabaseInstance;
  }
  return null;
}

export function isSupabaseConnected() {
  return getSupabaseClient() !== null;
}

// Helper function to prevent long hangs on bad network or unreachable Supabase URL
function withTimeout(promise, ms = 2500) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Koneksi timeout')), ms)
    )
  ]);
}

// -------------------------------------------------------------
// DATA API (Supports both Supabase Live and Local Mock DB)
// -------------------------------------------------------------

// Check Voter Login
export async function checkVoter(idNumber) {
  const cleanId = (idNumber || '').trim();
  if (!cleanId) {
    return { exists: false, message: 'Nomor identitas tidak boleh kosong.' };
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const queryPromise = supabase
        .from('voters')
        .select('*')
        .eq('id_number', cleanId)
        .single();

      const { data, error } = await withTimeout(queryPromise, 2500);

      if (!error && data) {
        return {
          exists: true,
          voter: data,
          hasVoted: Boolean(data.has_voted),
          message: data.has_voted ? 'Anda sudah menggunakan hak suara sebelumnya!' : 'Berhasil terverifikasi'
        };
      }
    } catch (err) {
      console.warn('Supabase check error or timeout, checking local mock DB as fallback:', err);
    }
  }

  // Mock DB Fallback
  let voters = [];
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY_VOTERS);
    voters = raw ? JSON.parse(raw) : [];
  } catch (e) {
    voters = [];
  }

  if (!voters || voters.length === 0) {
    voters = INITIAL_MOCK_VOTERS;
    try {
      localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(INITIAL_MOCK_VOTERS));
    } catch (e) {}
  }

  const found = voters.find(v => v.id_number && String(v.id_number).toLowerCase() === cleanId.toLowerCase());

  if (!found) {
    return { exists: false, message: 'Nomor identitas (NISN/NIP/NIY) tidak ditemukan di Daftar Pemilih Tetap (DPT)!' };
  }

  return {
    exists: true,
    voter: found,
    hasVoted: Boolean(found.has_voted),
    message: found.has_voted ? 'Anda sudah menggunakan hak suara Anda. Setiap pemilih hanya dapat memilih 1 kali.' : 'Verifikasi Berhasil'
  };
}

// Fetch Candidates
export async function fetchCandidates() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const queryPromise = supabase
        .from('candidates')
        .select('*')
        .order('candidate_number', { ascending: true });

      const { data, error } = await withTimeout(queryPromise, 5000);

      if (error) throw error;
      if (data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching candidates from Supabase, using local fallback:', err);
    }
  }

  // Mock fallback
  try {
    const local = localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  return INITIAL_MOCK_CANDIDATES;
}

// Submit Votes
export async function submitVotes({ voterId, osisId, ambalanPaId, ambalanPiId }) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      // 1. Try calling the RPC transaction
      const { data, error } = await supabase.rpc('submit_votes', {
        p_voter_id: voterId,
        p_osis_id: osisId,
        p_ambalan_pa_id: ambalanPaId,
        p_ambalan_pi_id: ambalanPiId
      });

      if (!error && data) {
        return data;
      }

      // If RPC fails (e.g. not created yet), fallback to manual queries
      console.warn('RPC submit_votes failed, trying manual update:', error);

      // Check voter
      const { data: voter } = await supabase
        .from('voters')
        .select('has_voted')
        .eq('id_number', voterId)
        .single();

      if (!voter) return { success: false, message: 'Pemilih tidak terdaftar!' };
      if (voter.has_voted) return { success: false, message: 'Anda sudah pernah memilih!' };

      // Update voter
      await supabase
        .from('voters')
        .update({ has_voted: true, voted_at: new Date().toISOString() })
        .eq('id_number', voterId);

      // Update candidates count
      const activeIds = [osisId, ambalanPaId, ambalanPiId].filter(Boolean);
      for (const cId of activeIds) {
        const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', cId).single();
        if (cand) {
          await supabase.from('candidates').update({ vote_count: (cand.vote_count || 0) + 1 }).eq('id', cId);
        }
      }

      return { success: true, message: 'Suara Anda berhasil tercatat!' };
    } catch (err) {
      console.error('Error submitting vote to Supabase:', err);
      return { success: false, message: 'Terjadi kesalahan sistem: ' + (err.message || 'Gagal menyimpan suara') };
    }
  }

  // Mock Submit
  const voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  const voterIdx = voters.findIndex(v => v.id_number.toLowerCase() === voterId.toLowerCase());

  if (voterIdx === -1) return { success: false, message: 'Pemilih tidak ditemukan!' };
  if (voters[voterIdx].has_voted) return { success: false, message: 'Hak suara untuk akun ini telah digunakan!' };

  // Mark voted
  voters[voterIdx].has_voted = true;
  voters[voterIdx].voted_at = new Date().toISOString();
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));

  // Update candidate count
  const candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  const chosenIds = [osisId, ambalanPaId, ambalanPiId].filter(Boolean);
  candidates.forEach(c => {
    if (chosenIds.includes(c.id)) {
      c.vote_count = (c.vote_count || 0) + 1;
    }
  });
  localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));

  return { success: true, message: 'Suara Anda berhasil tercatat di sistem!' };
}

// Real Count Stats
export async function fetchRealCountStats() {
  const supabase = getSupabaseClient();
  let candidates = [];
  let voters = [];

  if (supabase) {
    try {
      const [candRes, voterRes] = await Promise.all([
        supabase.from('candidates').select('*').order('candidate_number', { ascending: true }),
        supabase.from('voters').select('id_number, role, has_voted')
      ]);

      if (!candRes.error && candRes.data) candidates = candRes.data;
      if (!voterRes.error && voterRes.data) voters = voterRes.data;
    } catch (err) {
      console.warn('Supabase realcount fetch error:', err);
    }
  }

  if (candidates.length === 0) {
    candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  }
  if (voters.length === 0) {
    voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  }

  const totalVoters = voters.length;
  const votedCount = voters.filter(v => v.has_voted).length;
  const unvotedCount = totalVoters - votedCount;
  const turnoutPercent = totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(1) : 0;

  // Breakdown role
  const totalSiswa = voters.filter(v => v.role === 'siswa').length;
  const votedSiswa = voters.filter(v => v.role === 'siswa' && v.has_voted).length;
  const siswaPercent = totalSiswa > 0 ? ((votedSiswa / totalSiswa) * 100).toFixed(1) : 0;

  const totalGuru = voters.filter(v => v.role === 'guru').length;
  const votedGuru = voters.filter(v => v.role === 'guru' && v.has_voted).length;
  const guruPercent = totalGuru > 0 ? ((votedGuru / totalGuru) * 100).toFixed(1) : 0;

  return {
    candidates,
    voters,
    summary: {
      totalVoters,
      votedCount,
      unvotedCount,
      turnoutPercent,
      totalSiswa,
      votedSiswa,
      siswaPercent,
      totalGuru,
      votedGuru,
      guruPercent,
      lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  };
}

// Realtime Subscription
export function subscribeToRealtimeChanges(onUpdate) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('realcount-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
      onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// -------------------------------------------------------------
// ADMIN MANAGEMENT FUNCTIONS
// -------------------------------------------------------------

export async function adminGetAllVoters() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('voters')
        .select('*')
        .order('role', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn(e);
    }
  }
  return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
}

export async function adminAddVoter(voter) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('voters').upsert([voter]);
    if (error) throw error;
    return;
  }
  const voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  const idx = voters.findIndex(v => v.id_number === voter.id_number);
  if (idx >= 0) {
    voters[idx] = { ...voters[idx], ...voter };
  } else {
    voters.push({ ...voter, has_voted: false });
  }
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));
}

export async function adminBatchInsertVoters(votersList) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('voters').upsert(votersList, { onConflict: 'id_number' });
    if (error) throw error;
    return;
  }
  const current = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  const map = new Map(current.map(v => [v.id_number, v]));
  votersList.forEach(v => {
    map.set(v.id_number, { ...v, has_voted: v.has_voted || false });
  });
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(Array.from(map.values())));
}

export async function adminDeleteVoter(idNumber) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('voters').delete().eq('id_number', idNumber);
    if (error) throw error;
    return;
  }
  let voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  voters = voters.filter(v => v.id_number !== idNumber);
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));
}

export async function adminResetVoterStatus(idNumber) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('voters').update({ has_voted: false, voted_at: null }).eq('id_number', idNumber);
    if (error) throw error;
    return;
  }
  const voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  const v = voters.find(x => x.id_number === idNumber);
  if (v) {
    v.has_voted = false;
    v.voted_at = null;
    localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));
  }
}

export async function adminResetAllVotersStatus() {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('voters').update({ has_voted: false, voted_at: null }).neq('id_number', '');
    if (error) throw error;
    return;
  }
  const voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  voters.forEach(v => {
    v.has_voted = false;
    v.voted_at = null;
  });
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));
}

export async function adminAddCandidate(candidate) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('candidates').insert([candidate]);
    if (error) throw error;
    return;
  }
  const candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  const newCandidate = {
    ...candidate,
    id: candidate.id || `cand-${Date.now()}`,
    vote_count: 0
  };
  candidates.push(newCandidate);
  localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
}

export async function adminUpdateCandidate(id, candidateData) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('candidates').update(candidateData).eq('id', id);
    if (error) throw error;
    return;
  }
  const candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  const idx = candidates.findIndex(c => c.id === id);
  if (idx >= 0) {
    candidates[idx] = { ...candidates[idx], ...candidateData };
    localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
  }
}

export async function adminDeleteCandidate(id) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  let candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  candidates = candidates.filter(c => c.id !== id);
  localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
}

export async function adminResetAllVotes() {
  const supabase = getSupabaseClient();
  if (supabase) {
    await Promise.all([
      supabase.from('candidates').update({ vote_count: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('voters').update({ has_voted: false, voted_at: null }).neq('id_number', '')
    ]);
    return;
  }
  const candidates = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_CANDIDATES) || '[]');
  candidates.forEach(c => c.vote_count = 0);
  localStorage.setItem(MOCK_STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));

  const voters = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_VOTERS) || '[]');
  voters.forEach(v => {
    v.has_voted = false;
    v.voted_at = null;
  });
  localStorage.setItem(MOCK_STORAGE_KEY_VOTERS, JSON.stringify(voters));
}

// -------------------------------------------------------------
// 7. ELECTION SETTINGS & VOTE SCOPE (OSIS, AMBALAN, ALL)
// -------------------------------------------------------------
const MOCK_STORAGE_KEY_SETTINGS = 'evote_election_settings';

const DEFAULT_SETTINGS = {
  school_name: 'SMA / SMK NEGERI NUSANTARA',
  election_title: 'PEMILU RAYA KETUA OSIS & AMBALAN',
  election_period: '2026/2027',
  vote_scope: 'all', // 'all', 'osis_only', 'ambalan_only', 'custom'
  active_categories: ['osis', 'ambalan_putra', 'ambalan_putri']
};

export async function fetchElectionSettings() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const queryPromise = supabase
        .from('election_settings')
        .select('*');

      const { data, error } = await withTimeout(queryPromise, 5000);

      if (!error && data && data.length > 0) {
        const settingsMap = {};
        data.forEach(item => {
          try {
            settingsMap[item.key] = JSON.parse(item.value);
          } catch {
            settingsMap[item.key] = item.value;
          }
        });

        // Ensure active_categories array is formed
        let activeCategories = ['osis', 'ambalan_putra', 'ambalan_putri'];
        if (settingsMap.active_categories) {
          activeCategories = Array.isArray(settingsMap.active_categories) 
            ? settingsMap.active_categories 
            : [settingsMap.active_categories];
        } else if (settingsMap.vote_scope === 'osis_only') {
          activeCategories = ['osis'];
        } else if (settingsMap.vote_scope === 'ambalan_only') {
          activeCategories = ['ambalan_putra', 'ambalan_putri'];
        }

        return {
          ...DEFAULT_SETTINGS,
          ...settingsMap,
          active_categories: activeCategories
        };
      }
    } catch (err) {
      console.warn('Could not fetch settings from Supabase, falling back to local:', err);
    }
  }

  // Local fallback
  const stored = localStorage.getItem(MOCK_STORAGE_KEY_SETTINGS);
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export async function saveElectionSettings(settings) {
  const updated = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  // Always store to localStorage for fast access
  localStorage.setItem(MOCK_STORAGE_KEY_SETTINGS, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const rows = Object.entries(updated).map(([key, val]) => ({
        key,
        value: typeof val === 'object' ? JSON.stringify(val) : String(val)
      }));

      for (const row of rows) {
        await supabase.from('election_settings').upsert(row, { onConflict: 'key' });
      }
    } catch (err) {
      console.error('Failed to sync settings to Supabase:', err);
    }
  }

  return updated;
}

