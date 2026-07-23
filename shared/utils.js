/**
 * NETOPS TOOLKIT — shared utilities
 * Single source of truth for logic that repeats across every tool:
 * region mapping, TSV parsing, duration parsing, dedup, clipboard.
 *
 * Loaded as a plain script (no bundler): <script src="../shared/utils.js"></script>
 * Everything is attached to the global `NetopsUtils` object to avoid
 * polluting the page namespace.
 */

(function (global) {
  'use strict';

  // ------------------------------------------------------------------
  // REGION MAP
  // OLT region is determined by the hostname prefix before the first
  // hyphen (e.g. "SBT-OLT-01" -> SBT). Add new prefixes here ONCE and
  // every tool that includes this file picks it up automatically.
  // ------------------------------------------------------------------
  const REGION_MAP = {
    SBU:  { code: 'RSBU',  name: 'Sumbagut' },
    SBT:  { code: 'RSBT',  name: 'Sumbagteng' },
    SBS:  { code: 'RSBS',  name: 'Sumbagsel' },
    JKT:  { code: 'RJKT',  name: 'Jakarta' },
    JBB:  { code: 'RJBB',  name: 'Jabar Barat' },
    JBTG: { code: 'RJBTG', name: 'Jabar Tengah' },
    JBT:  { code: 'RJBT',  name: 'Jabar Timur' },
    BNT:  { code: 'RBNT',  name: 'Banten' },
    KAL:  { code: 'RKAL',  name: 'Kalimantan' },
    INT:  { code: 'RINT',  name: 'Indonesia Timur' },
  };

  /**
   * Get region info from an OLT/device hostname.
   * @param {string} hostname e.g. "SBT-OLT-JAMBI-01"
   * @returns {{prefix:string, code:string, name:string}|null}
   */
  function getRegionFromHostname(hostname) {
    if (!hostname) return null;
    const prefix = String(hostname).trim().split('-')[0].toUpperCase();
    const region = REGION_MAP[prefix];
    if (!region) return { prefix, code: null, name: null };
    return { prefix, ...region };
  }

  // ------------------------------------------------------------------
  // TSV PARSING
  // Input is always pasted from a spreadsheet / NMS export: tab-separated,
  // first row = headers. Headers are auto-detected, not hardcoded to
  // column position, so column reordering upstream doesn't break tools.
  // ------------------------------------------------------------------

  /**
   * Parse raw TSV text into an array of row objects keyed by header name.
   * Trims header/cell whitespace. Skips fully blank lines.
   * @param {string} raw
   * @returns {{headers:string[], rows:Object[]}}
   */
  function parseTSV(raw) {
    if (!raw || !raw.trim()) return { headers: [], rows: [] };
    const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split('\t');
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (cells[idx] !== undefined ? cells[idx] : '').trim();
      });
      rows.push(row);
    }
    return { headers, rows };
  }

  /**
   * Find the actual header name matching one of several candidate labels
   * (case-insensitive, ignores extra spaces). Use this instead of hardcoding
   * exact header strings, since NMS exports vary slightly between systems.
   * @param {string[]} headers
   * @param {string[]} candidates
   * @returns {string|null}
   */
  function findHeader(headers, candidates) {
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const normCandidates = candidates.map(norm);
    for (const h of headers) {
      if (normCandidates.includes(norm(h))) return h;
    }
    return null;
  }

  // ------------------------------------------------------------------
  // DURATION PARSING
  // Duration may arrive as raw minutes ("125"), HH:MM ("02:05"), or
  // Indonesian text ("2 Hari 3 Jam 5 Menit"). Normalize all to minutes.
  // ------------------------------------------------------------------

  /**
   * Parse a duration value in any of the known formats into total minutes.
   * @param {string|number} value
   * @returns {number} total minutes (0 if unparseable)
   */
  function parseDurationToMinutes(value) {
    if (value === null || value === undefined || value === '') return 0;

    // raw number (assume minutes)
    if (typeof value === 'number') return value;
    const trimmed = String(value).trim();
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

    // HH:MM or HH:MM:SS
    const hhmm = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (hhmm) {
      const h = parseInt(hhmm[1], 10);
      const m = parseInt(hhmm[2], 10);
      return h * 60 + m;
    }

    // Indonesian text: "X Hari Y Jam Z Menit" (any subset, any order)
    let minutes = 0;
    const hari = trimmed.match(/(\d+)\s*Hari/i);
    const jam = trimmed.match(/(\d+)\s*Jam/i);
    const menit = trimmed.match(/(\d+)\s*Menit/i);
    if (hari) minutes += parseInt(hari[1], 10) * 24 * 60;
    if (jam) minutes += parseInt(jam[1], 10) * 60;
    if (menit) minutes += parseInt(menit[1], 10);
    if (hari || jam || menit) return minutes;

    return 0;
  }

  /**
   * Format total minutes back into Indonesian text: "X Hari Y Jam Z Menit".
   * Omits zero-value units except when everything is zero.
   * @param {number} totalMinutes
   * @returns {string}
   */
  function formatMinutesToIDText(totalMinutes) {
    const m = Math.max(0, Math.round(totalMinutes));
    const hari = Math.floor(m / (24 * 60));
    const jam = Math.floor((m % (24 * 60)) / 60);
    const menit = m % 60;
    const parts = [];
    if (hari > 0) parts.push(`${hari} Hari`);
    if (jam > 0) parts.push(`${jam} Jam`);
    if (menit > 0 || parts.length === 0) parts.push(`${menit} Menit`);
    return parts.join(' ');
  }

  // ------------------------------------------------------------------
  // DEDUPLICATION
  // Alarm rows commonly repeat per OLT because multiple module IDs
  // trigger the same alarm type. Standard dedup key: Alarm Source +
  // Alarm Name + Timestamp.
  // ------------------------------------------------------------------

  /**
   * Deduplicate rows by a composite key built from given field names.
   * Keeps the first occurrence of each key.
   * @param {Object[]} rows
   * @param {string[]} keyFields field names to compose the dedup key from
   * @returns {Object[]}
   */
  function dedupeRows(rows, keyFields) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const key = keyFields.map(f => (row[f] || '').trim().toLowerCase()).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  }

  // ------------------------------------------------------------------
  // MISC
  // ------------------------------------------------------------------

  /**
   * Copy text to clipboard with a graceful fallback for non-secure contexts.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /**
   * Format a Date as Indonesian-style timestamp: "10 Juli 2026 14:30".
   * @param {Date} date
   * @returns {string}
   */
  function formatTimestampID(date) {
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const d = date.getDate();
    const b = bulan[date.getMonth()];
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${b} ${y} ${hh}:${mm}`;
  }

  global.NetopsUtils = {
    REGION_MAP,
    getRegionFromHostname,
    parseTSV,
    findHeader,
    parseDurationToMinutes,
    formatMinutesToIDText,
    dedupeRows,
    copyToClipboard,
    formatTimestampID,
  };

})(window);
