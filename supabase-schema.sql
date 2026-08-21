-- ==============================================================================
-- SKRIP DATABASE SUPABASE UNTUK E-VOTING OSIS & AMBALAN PUTRA/PUTRI
-- ==============================================================================
-- Jalankan skrip ini di menu "SQL Editor" pada Dashboard Supabase Anda.
-- ==============================================================================

-- 1. Buat Tabel Voters (Daftar Pemilih Tetap - Siswa & Guru)
CREATE TABLE IF NOT EXISTS public.voters (
    id_number TEXT PRIMARY KEY,               -- NISN untuk siswa, NIP/NIY untuk guru
    name TEXT NOT NULL,                        -- Nama lengkap pemilih
    role TEXT NOT NULL CHECK (role IN ('siswa', 'guru')), -- 'siswa' atau 'guru'
    has_voted BOOLEAN DEFAULT FALSE NOT NULL,  -- Status apakah sudah voting
    voted_at TIMESTAMPTZ                       -- Waktu saat pemilih mengirim suara
);

-- 2. Buat Tabel Candidates (Kandidat Calon Ketua)
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_number INT NOT NULL,             -- Nomor urut (1, 2, 3, dst)
    name TEXT NOT NULL,                        -- Nama calon ketua / pasangan
    position TEXT NOT NULL CHECK (position IN ('osis', 'ambalan_putra', 'ambalan_putri')),
    class_grade TEXT,                          -- Kelas / Jabatan (contoh: XI MIPA 1)
    vision TEXT NOT NULL,                      -- Visi
    mission TEXT NOT NULL,                     -- Misi (poin-poin dipisah baris baru)
    image_url TEXT,                            -- URL Foto kandidat
    vote_count INT DEFAULT 0 NOT NULL          -- Total perolehan suara
);

-- 3. Buat Tabel Pengaturan Pemilihan
CREATE TABLE IF NOT EXISTS public.election_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Masukkan pengaturan default
INSERT INTO public.election_settings (key, value)
VALUES 
    ('school_name', 'SIT HARAPAN UMAT KARAWANG'),
    ('election_title', 'PEMILIHAN KETUA OSIS & PRADANA AMBALAN'),
    ('election_period', '2026/2027'),
    ('vote_scope', 'all'),
    ('active_categories', '["osis","ambalan_putra","ambalan_putri"]'),
    ('is_voting_active', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_settings ENABLE ROW LEVEL SECURITY;

-- 5. Kebijakan Keamanan (RLS Policies)
-- Izinkan siapapun membaca data kandidat (untuk halaman voting & real count)
CREATE POLICY "Public Read Candidates" 
ON public.candidates FOR SELECT 
TO anon, authenticated 
USING (true);

-- Izinkan siapapun membaca data pemilih untuk validasi login
CREATE POLICY "Public Read Voters" 
ON public.voters FOR SELECT 
TO anon, authenticated 
USING (true);

-- Izinkan publik membaca pengaturan
CREATE POLICY "Public Read Settings" 
ON public.election_settings FOR SELECT 
TO anon, authenticated 
USING (true);

-- Izinkan operasi kelola untuk Admin (anon key dengan bypass atau authenticated)
CREATE POLICY "Public Insert Candidates" ON public.candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Candidates" ON public.candidates FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public Delete Candidates" ON public.candidates FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public Insert Voters" ON public.voters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Voters" ON public.voters FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public Delete Voters" ON public.voters FOR DELETE TO anon, authenticated USING (true);

-- 6. Fungsi Transaksi Aman untuk Mengirim Suara (RPC)
-- Memastikan penambahan suara kandidat dan perubahan status pemilih terjadi dalam 1 transaksi atomik
CREATE OR REPLACE FUNCTION public.submit_votes(
    p_voter_id TEXT,
    p_osis_id UUID DEFAULT NULL,
    p_ambalan_pa_id UUID DEFAULT NULL,
    p_ambalan_pi_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_voted BOOLEAN;
BEGIN
    -- Cek status pemilih
    SELECT has_voted INTO v_has_voted
    FROM public.voters
    WHERE id_number = p_voter_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Nomor identitas (NISN/NIP/NIY) tidak terdaftar!');
    END IF;

    IF v_has_voted THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hak suara untuk nomor ini sudah digunakan sebelumnya!');
    END IF;

    -- Tambahkan suara ke masing-masing kandidat terpilih (hanya ID yang tidak null)
    UPDATE public.candidates 
    SET vote_count = vote_count + 1 
    WHERE id IN (p_osis_id, p_ambalan_pa_id, p_ambalan_pi_id)
      AND id IS NOT NULL;

    -- Tandai pemilih telah selesai memilih
    UPDATE public.voters 
    SET has_voted = TRUE, voted_at = NOW() 
    WHERE id_number = p_voter_id;

    RETURN jsonb_build_object('success', true, 'message', 'Suara Anda berhasil disimpan! Terima kasih atas partisipasi Anda.');
END;
$$;

-- 7. Aktifkan Supabase Realtime untuk Pembaruan Live di Halaman Real Count
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voters;

-- ==============================================================================
-- DATA AWAL / SAMPLE UNTUK UJI COBA
-- ==============================================================================

-- Kandidat OSIS
INSERT INTO public.candidates (candidate_number, name, position, class_grade, vision, mission, image_url, vote_count)
VALUES 
(
    1,
    'Muhammad Arya Pratama & Siti Nurhaliza',
    'osis',
    'XI MIPA 1 & XI IPS 2',
    'Mewujudkan OSIS yang aspiratif, berkarakter unggul, inovatif, dan berlandaskan iman serta teknologi.',
    '1. Menampung dan merealisasikan aspirasi siswa secara transparan.\n2. Mengembangkan kegiatan ekstrakurikuler berbasis digital dan kreativitas.\n3. Mempererat kolaborasi antara siswa, guru, dan pihak sekolah.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    0
),
(
    2,
    'Dimas Aditya & Amanda Putri Kirana',
    'osis',
    'XI MIPA 3 & XI MIPA 2',
    'Membangun generasi pelajar yang disiplin, berprestasi, peduli lingkungan, dan berwawasan global.',
    '1. Menyelenggarakan pekan inovasi ilmiah dan seni tahunan.\n2. Menggalakkan program eco-school dan kepedulian sosial.\n3. Meningkatkan kedisiplinan dan rasa tanggung jawab siswa.',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
    0
),
(
    3,
    'Raka Fathir Al-Ghifari & Zahra Maulida',
    'osis',
    'XI IPS 1 & XI Bahasa',
    'Menjadikan OSIS wadah sinergi, solidaritas tinggi, dan pendorong prestasi akademik maupun non-akademik.',
    '1. Membuka forum dialog terbuka setiap bulan.\n2. Mengoptimalkan media sosial sekolah untuk edukasi positif.\n3. Mengadakan pelatihan kepemimpinan untuk seluruh perwakilan kelas.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    0
);

-- Kandidat Ambalan Putra (Pradana Putra)
INSERT INTO public.candidates (candidate_number, name, position, class_grade, vision, mission, image_url, vote_count)
VALUES 
(
    1,
    'Fajar Nugraha (Pradana Pa)',
    'ambalan_putra',
    'XI MIPA 2',
    'Mewujudkan Pramuka Penegak yang tangguh, berbudi luhur, berjiwa korsa, dan berwawasan masa depan.',
    '1. Meningkatkan keterampilan kepramukaan (scouting skills) modern.\n2. Mengadakan giat prestasi dan bakti sosial masyarakat berkala.\n3. Menanamkan nilai Dasa Darma dalam keseharian anggota.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
    0
),
(
    2,
    'Bima Satria Wicaksana (Pradana Pa)',
    'ambalan_putra',
    'XI IPS 3',
    'Menjadikan Gerakan Pramuka wadah eksplorasi potensi diri, petualangan positif, dan persaudaraan tanpa batas.',
    '1. Memperbanyak kegiatan luar ruangan (outdoor survival & camping).\n2. Membangun kerjasama antar pangkalan dan ambalan se-wilayah.\n3. Penguatan karakter mandiri dan siap kerja bagi penegak.',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&auto=format&fit=crop&q=80',
    0
);

-- Kandidat Ambalan Putri (Pradana Putri)
INSERT INTO public.candidates (candidate_number, name, position, class_grade, vision, mission, image_url, vote_count)
VALUES 
(
    1,
    'Nabila Shafa Maharani (Pradana Pi)',
    'ambalan_putri',
    'XI MIPA 1',
    'Membentuk Pramuka Penegak Putri yang berintegritas, mandiri, peduli, dan berdaya saing tinggi.',
    '1. Membudayakan literasi dan keterampilan kerajinan/kewirausahaan penegak putri.\n2. Optimalisasi latihan mingguan yang seru dan aplikatif.\n3. Menjadi pelopor ketertiban dan kebersihan lingkungan sekolah.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
    0
),
(
    2,
    'Syifa Aulia Rahmadani (Pradana Pi)',
    'ambalan_putri',
    'XI IPS 2',
    'Mewujudkan Ambalan Putri yang solid, aktif berprestasi, dan menginspirasi seluruh warga sekolah.',
    '1. Menyelenggarakan kursus pertolongan pertama (P3K) dan tali temali tingkat mahir.\n2. Menggiatkan aksi peduli sesama dan penghijauan bumi perkemahan.\n3. Membangun komunikasi yang harmonis antar tingkatan sangga.',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    0
);

-- Sample Data Pemilih (Siswa & Guru)
INSERT INTO public.voters (id_number, name, role, has_voted)
VALUES
    -- Siswa (NISN)
    ('0081234501', 'Aditya Pratama', 'siswa', false),
    ('0081234502', 'Bunga Citra Lestari', 'siswa', false),
    ('0081234503', 'Citra Dewi Permata', 'siswa', false),
    ('0081234504', 'Deni Kurniawan', 'siswa', false),
    ('0081234505', 'Eka Novitasari', 'siswa', false),
    ('0081234506', 'Farhan Ramadhan', 'siswa', false),
    ('0081234507', 'Gita Gutawa', 'siswa', false),
    ('0081234508', 'Hendra Wijaya', 'siswa', false),
    -- Guru / Pembina (NIP/NIY)
    ('198501152010011002', 'Drs. H. Bambang Sudiro, M.Pd.', 'guru', false),
    ('199008202014022001', 'Siti Rahmawati, S.Pd.', 'guru', false),
    ('198803122012011003', 'Ahmad Fauzi, S.Kom., M.T.I.', 'guru', false),
    ('NIY2022091001', 'Dewi Lestari, S.Pd. (Pembina Pramuka)', 'guru', false)
ON CONFLICT (id_number) DO NOTHING;
