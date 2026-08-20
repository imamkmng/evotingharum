import { createClient } from '@supabase/supabase-js';

const CONFIG_STORAGE_KEY = 'evote_supabase_config';

// ============================================================================
// 🔑 KONFIGURASI DATABASE SUPABASE ASLI (SIT HARAPAN UMAT)
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

function withTimeout(promise, ms = 6000) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Koneksi database timeout. Silakan periksa jaringan internet.')), ms)
    )
  ]);
}

// -------------------------------------------------------------
// 1. CEK DATA PEMILIH (LOGIN SISWA / GURU)
// -------------------------------------------------------------
export async function checkVoter(idNumber) {
  const cleanId = (idNumber || '').trim();
  if (!cleanId) {
    return { exists: false, message: 'Nomor identitas tidak boleh kosong.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { exists: false, message: 'Koneksi ke database Supabase belum terkonfigurasi.' };
  }

  try {
    const queryPromise = supabase
      .from('voters')
      .select('*')
      .eq('id_number', cleanId)
      .single();

    const { data, error } = await withTimeout(queryPromise, 6000);

    if (error || !data) {
      return { 
        exists: false, 
        message: 'Nomor identitas tidak ditemukan dalam Daftar Pemilih Tetap (DPT).' 
      };
    }

    return {
      exists: true,
      voter: data,
      hasVoted: Boolean(data.has_voted),
      message: data.has_voted 
        ? 'Anda sudah menggunakan hak suara sebelumnya!' 
        : 'Verifikasi Berhasil'
    };
  } catch (err) {
    console.error('Supabase check error:', err);
    return { 
      exists: false, 
      message: err.message || 'Gagal memverifikasi DPT ke database. Silakan coba lagi.' 
    };
  }
}

// -------------------------------------------------------------
// 2. AMBIL DAFTAR KANDIDAT
// -------------------------------------------------------------
export async function fetchCandidates() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const queryPromise = supabase
      .from('candidates')
      .select('*')
      .order('candidate_number', { ascending: true });

    const { data, error } = await withTimeout(queryPromise, 6000);

    if (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching candidates from Supabase:', err);
    return [];
  }
}

// -------------------------------------------------------------
// 3. KIRIM PILIHAN SUARA (SUBMIT BALLOT)
// -------------------------------------------------------------
export async function submitVotes({ voterId, osisId, ambalanPaId, ambalanPiId }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Database belum terhubung.' };
  }

  try {
    // 1. Coba panggil transaksi fungsi RPC submit_votes
    try {
      const { data, error } = await supabase.rpc('submit_votes', {
        p_voter_id: voterId,
        p_osis_id: osisId,
        p_ambalan_pa_id: ambalanPaId,
        p_ambalan_pi_id: ambalanPiId
      });

      if (!error && data) {
        return data;
      }
    } catch (rpcErr) {
      console.warn('RPC submit_votes fallback to direct update:', rpcErr);
    }

    // 2. Direct Update Fallback
    const { data: voter, error: voterErr } = await supabase
      .from('voters')
      .select('has_voted')
      .eq('id_number', voterId)
      .single();

    if (voterErr || !voter) return { success: false, message: 'Pemilih tidak ditemukan di DPT!' };
    if (voter.has_voted) return { success: false, message: 'Hak suara untuk akun ini sudah pernah digunakan!' };

    // Update status pemilih
    const { error: updateVoterErr } = await supabase
      .from('voters')
      .update({ has_voted: true, voted_at: new Date().toISOString() })
      .eq('id_number', voterId);

    if (updateVoterErr) throw updateVoterErr;

    // Tambah suara paslon yang dipilih
    const activeIds = [osisId, ambalanPaId, ambalanPiId].filter(Boolean);
    for (const cId of activeIds) {
      const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', cId).single();
      if (cand) {
        await supabase.from('candidates').update({ vote_count: (cand.vote_count || 0) + 1 }).eq('id', cId);
      }
    }

    return { success: true, message: 'Suara Anda berhasil tercatat di database!' };
  } catch (err) {
    console.error('Error submitting vote to Supabase:', err);
    return { success: false, message: 'Terjadi kesalahan sistem: ' + (err.message || 'Gagal menyimpan suara') };
  }
}

// -------------------------------------------------------------
// 4. STATISTIK REAL COUNT
// -------------------------------------------------------------
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

  const totalVoters = voters.length;
  const votedCount = voters.filter(v => v.has_voted).length;
  const unvotedCount = totalVoters - votedCount;
  const turnoutPercent = totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(1) : 0;

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

// -------------------------------------------------------------
// 5. REALTIME SINKRONISASI
// -------------------------------------------------------------
export function subscribeToRealtimeChanges(onUpdate) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('realcount-live-sync')
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
// 6. FUNGSI ADMIN DPT & PASLON (DIRECT KE SUPABASE)
// -------------------------------------------------------------
export async function adminGetAllVoters() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('voters')
      .select('*')
      .order('role', { ascending: false });
    if (!error && data) return data;
  } catch (e) {
    console.error(e);
  }
  return [];
}

export async function adminAddVoter(voter) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('voters').upsert([voter]);
  if (error) throw error;
}

export async function adminBatchInsertVoters(votersList) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('voters').upsert(votersList, { onConflict: 'id_number' });
  if (error) throw error;
}

export async function adminDeleteVoter(idNumber) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('voters').delete().eq('id_number', idNumber);
  if (error) throw error;
}

export async function adminResetVoterStatus(idNumber) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('voters').update({ has_voted: false, voted_at: null }).eq('id_number', idNumber);
  if (error) throw error;
}

export async function adminResetAllVotersStatus() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('voters').update({ has_voted: false, voted_at: null }).neq('id_number', '');
  if (error) throw error;
}

export async function adminAddCandidate(candidate) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('candidates').insert([candidate]);
  if (error) throw error;
}

export async function adminUpdateCandidate(id, candidateData) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('candidates').update(candidateData).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteCandidate(id) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  const { error } = await supabase.from('candidates').delete().eq('id', id);
  if (error) throw error;
}

export async function adminResetAllVotes() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database Supabase tidak terhubung');
  await Promise.all([
    supabase.from('candidates').update({ vote_count: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('voters').update({ has_voted: false, voted_at: null }).neq('id_number', '')
  ]);
}

// -------------------------------------------------------------
// 7. PENGATURAN PEMILIHAN (ELECTION SETTINGS)
// -------------------------------------------------------------
const DEFAULT_SETTINGS = {
  school_name: 'SIT HARAPAN UMAT',
  election_title: 'PEMILIHAN KETUA OSIS & PRADANA AMBALAN',
  election_period: '2026/2027',
  vote_scope: 'all',
  active_categories: ['osis', 'ambalan_putra', 'ambalan_putri']
};

export async function fetchElectionSettings() {
  const supabase = getSupabaseClient();
  if (!supabase) return DEFAULT_SETTINGS;

  try {
    const queryPromise = supabase.from('election_settings').select('*');
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
    console.warn('Could not fetch settings from Supabase:', err);
  }

  return DEFAULT_SETTINGS;
}

export async function saveElectionSettings(settings) {
  const updated = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

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
      throw err;
    }
  }

  return updated;
}
