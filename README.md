# 🗳️ Portal E-Voting Pemilihan Ketua OSIS & Ambalan Pradana Putra/Putri

Aplikasi web e-voting modern, responsif, dan real-time untuk pemilihan Ketua OSIS dan Pradana Ambalan Putra & Putri. Dibangun dengan arsitektur statis yang cepat, aman, dan siap di-deploy langsung ke **Cloudflare Pages** dengan backend database **Supabase** (PostgreSQL + Realtime).

---

## ✨ Fitur Utama

1. **🔐 Autentikasi Pemilih 1x Voting**:
   - **Siswa**: Login menggunakan **NISN** (10 digit).
   - **Guru / Pembina**: Login menggunakan **NIP / NIY**.
   - Setiap akun hanya memiliki **1 kali hak suara**. Setelah mengirim pilihan, status akun otomatis non-aktif dan ditolak jika mencoba login kembali.

2. **🗳️ Bilik Suara Digital (3 Kategori Sekaligus)**:
   - Pemilihan Ketua & Wakil Ketua OSIS
   - Pemilihan Pradana / Ketua Ambalan Putra
   - Pemilihan Pradana / Ketua Ambalan Putri
   - Modal detail **Visi & Misi** untuk setiap calon.
   - Ringkasan pilihan dan dialog konfirmasi sebelum suara dikirim.

3. **📊 Live Real Count (Publik)**:
   - Pembaruan perolehan suara **Realtime** tanpa reload halaman menggunakan **Supabase Realtime**.
   - Statistik partisipasi DPT, siswa, dan guru.
   - Mode **Layar Penuh (Fullscreen)** untuk proyektor/layar aula sekolah.

4. **🛡️ Panel Administrator (`/admin.html`)**:
   - Diproteksi kata sandi (default: `admin123`).
   - **Import CSV Massal**: Upload ribuan data siswa/guru dalam sekejap + template CSV bawaan.
   - **Manajemen DPT**: Cari, filter, tambah manual, reset hak suara per pemilih, dan hapus pemilih.
   - **Manajemen Calon**: Tambah, edit, dan hapus kandidat beserta visi, misi, dan foto.
   - **Reset & Pengaturan**: Reset suara (0 suara) dan reset status voting untuk gladi bersih.
   - **Wizard Supabase**: Input Project URL & Anon Key langsung melalui antarmuka web.

---

## 🚀 Cara Menjalankan di Komputer Lokal

1. **Buka terminal** di folder proyek ini:
   ```bash
   cd c:\Users\imamh\votetes
   ```

2. **Instal seluruh dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan server pengembangan (Dev Mode)**:
   ```bash
   npm run dev
   ```
   Buka link lokal yang muncul (biasanya `http://localhost:5173`) di browser Anda.

---

## 🗄️ Langkah Setup Database di Supabase

1. Buat akun dan proyek baru di [supabase.com](https://supabase.com).
2. Di dashboard Supabase, masuk ke menu **SQL Editor** > **New Query**.
3. Buka file `supabase-schema.sql` di proyek ini, salin seluruh kodenya, lalu tempel (*paste*) dan klik **Run**.
4. Masuk ke menu **Project Settings** > **API**:
   - Salin **Project URL**
   - Salin **Project API Keys (`anon public`)**
5. Buka panel admin website Anda di `http://localhost:5173/admin.html`, login dengan password `admin123`, lalu ke tab **Setup Supabase & Cloudflare** dan simpan URL serta Anon Key Anda.

---

## ☁️ Cara Deploy ke Cloudflare Pages (`.pages.dev`)

1. Upload/Push folder proyek ini ke repositori **GitHub** atau **GitLab** Anda.
2. Buka dashboard [Cloudflare](https://dash.cloudflare.com) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Pilih repositori proyek ini, lalu atur konfigurasi build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. (Opsional) Tambahkan Environment Variables di Cloudflare:
   - `VITE_SUPABASE_URL`: *(URL Supabase Anda)*
   - `VITE_SUPABASE_ANON_KEY`: *(Anon Key Supabase Anda)*
5. Klik **Save and Deploy**. Website Anda akan langsung online dengan domain gratis `https://nama-proyek.pages.dev`!

---

## 🔑 Data Demo / Uji Coba Awal

Jika Supabase belum dihubungkan, website otomatis berjalan dalam **Mode Demo (Mock DB)**:

| Peran | Nomor Identitas (ID) | Nama | Status Awal |
|---|---|---|---|
| Siswa | `0081234501` | Aditya Pratama | Belum Memilih |
| Siswa | `0081234502` | Bunga Citra Lestari | Sudah Memilih |
| Guru | `198501152010011002` | Drs. H. Bambang Sudiro, M.Pd. | Belum Memilih |
| Guru | `NIY2022091001` | Dewi Lestari, S.Pd. | Belum Memilih |
| **Admin** | Password: `admin123` | Administrator | - |
"# evotingharum" 
