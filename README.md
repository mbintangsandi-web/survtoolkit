# NETOPS TOOLKIT

Portal internal untuk tools operasional OLT & broadcast regional. Statis, tanpa backend, tanpa build step — buka `index.html` langsung di browser atau host di mana saja (GitHub Pages, server internal, atau sebagai subfolder di web tim ops).

## Struktur

```
/portal
├── index.html          ← menu utama, daftar semua tool
├── /tools               ← satu file HTML per tool
│   └── (kosong — isi menyusul)
├── /shared
│   ├── theme.css        ← design system (warna, tipografi, komponen)
│   └── utils.js          ← logic bersama (parser TSV, region map, durasi, dedup)
└── README.md
```

## Menambah tool baru

1. Buat file baru di `/tools`, misalnya `tools/nama-tool.html`
2. Di `<head>`, include `<link rel="stylesheet" href="../shared/theme.css">`
3. Sebelum `</body>`, include `<script src="../shared/utils.js"></script>`
4. Pakai fungsi dari `NetopsUtils` (lihat `shared/utils.js` untuk daftar lengkap):
   - `NetopsUtils.parseTSV(raw)` — parse TSV jadi array of objects
   - `NetopsUtils.getRegionFromHostname(hostname)` — prefix → region
   - `NetopsUtils.parseDurationToMinutes(value)` — normalisasi durasi (menit / HH:MM / teks ID)
   - `NetopsUtils.dedupeRows(rows, keyFields)` — dedup berdasarkan kombinasi field
   - `NetopsUtils.copyToClipboard(text)`
5. Di `index.html`, tambahkan satu entri ke array `TOOLS` (cari `const TOOLS = [...]`), set `status: 'active'` dan isi `href` sesuai nama file. Tool otomatis muncul di menu.

## Menambah region baru

Edit `REGION_MAP` di `shared/utils.js` — satu tempat, berlaku ke semua tool yang include file ini.

## Deploy

- **Testing cepat / akses dari HP:** push ke GitHub, aktifkan GitHub Pages dari branch utama.
- **Server internal / masuk ke web tim ops:** copy folder `/portal` apa adanya ke subfolder web tersebut. Semua path di dalam file bersifat relatif, jadi tidak perlu diedit ulang selama struktur foldernya (index.html, /tools, /shared) tetap sejajar.
