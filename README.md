# SURV TOOLKIT

Portal internal untuk tools operasional OLT & broadcast regional. Statis, tanpa backend, tanpa build step — buka `index.html` langsung di browser atau host di mana saja (GitHub Pages, server internal, atau sebagai subfolder di web tim ops).

## Struktur menu

Menu utama (`index.html`) punya 4 tombol, mengikuti alur kerja:

- **Tiket Lebih Dari 3 Hari** → langsung ke `tools/followup-ticket.html`
- **OLT Down Lebih Dari 8 Jam** → langsung ke `tools/outage-broadcast.html`
- **Report Daily OLT Down** → halaman alur (`tools/report-daily-olt-down.html`) berisi 3 langkah berurutan: Split Done/Not Done → Sync → Daily Report
- **Alarm** → halaman cabang (`tools/alarm.html`) berisi 2 pilihan sumber: UNM / NCE

## Struktur folder

```
/portal
├── index.html                        ← menu utama, 4 tombol
├── /tools
│   ├── report-daily-olt-down.html    ← halaman alur (3 langkah)
│   ├── alarm.html                    ← halaman cabang (UNM / NCE)
│   └── (tool individual menyusul: followup-ticket.html, outage-broadcast.html,
│         done-notdone.html, sync.html, daily-report.html, alarm-unm.html, alarm-nce.html)
├── /shared
│   ├── theme.css                      ← design system (biru terang, tipografi, komponen)
│   └── utils.js                        ← logic bersama (parser TSV, region map, durasi, dedup)
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
