/**
 * utils.js
 * ------------------------------------------------------------
 * সাধারণ Helper Function সমূহ যা প্রায় প্রতিটি Module ব্যবহার করবে।
 * এখানে কোনো Business Logic থাকবে না, শুধুমাত্র Reusable Utility।
 * ------------------------------------------------------------
 */

const Utils = (() => {

    /**
     * ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর করে
     */
    function toBanglaNumber(input) {
        if (input === null || input === undefined || input === '') return '';
        const enToBn = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
        return String(input).replace(/[0-9]/g, (d) => enToBn[d]);
    }

    /**
     * বাংলা সংখ্যাকে ইংরেজি সংখ্যায় রূপান্তর করে
     */
    function toEnglishNumber(input) {
        if (input === null || input === undefined || input === '') return '';
        const bnToEn = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
        return String(input).replace(/[০-৯]/g, (d) => bnToEn[d]);
    }

    /**
     * একটি Unique ID তৈরি করে (timestamp + random)
     */
    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * সংখ্যাকে দুই দশমিক ঘর পর্যন্ত ফরম্যাট করে
     */
    function formatDecimal(num, digits = 2) {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Number(num).toFixed(digits);
    }

    /**
     * বর্তমান তারিখ ISO ফরম্যাটে
     */
    function nowISO() {
        return new Date().toISOString();
    }

    /**
     * তারিখকে সুন্দরভাবে বাংলায় দেখানোর জন্য
     */
    function formatDateBangla(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = toBanglaNumber(d.getDate());
        const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
        const month = months[d.getMonth()];
        const year = toBanglaNumber(d.getFullYear());
        return `${day} ${month}, ${year}`;
    }

    /**
     * একটি মান বিশেষ অবস্থা (Special Status) কিনা যাচাই করে
     * রিটার্ন করবে: 'absent' | 'suspended' | 'cancelled' | null
     * নিয়ম: মার্কশিটে খালি ঘর অথবা "-" চিহ্ন থাকলে সেই বিষয়ে ছাত্রকে
     * অনুপস্থিত ধরা হবে।
     */
    function detectSpecialStatus(value) {
        if (value === null || value === undefined) return 'absent';
        const v = String(value).trim();
        if (v === '' || v === '-' || v === '–' || v === '—') return 'absent';
        const absentWords = ['অনুপস্থিত', 'অনু.', 'অনু'];
        const suspendedWords = ['স্থগিত'];
        const cancelledWords = ['বাতিল'];
        if (absentWords.includes(v)) return 'absent';
        if (suspendedWords.includes(v)) return 'suspended';
        if (cancelledWords.includes(v)) return 'cancelled';
        return null;
    }

    /**
     * মান সংখ্যা কিনা যাচাই করে (বাংলা সংখ্যাও সমর্থন করবে)
     */
    function isNumeric(value) {
        if (value === null || value === undefined || value === '') return false;
        const en = toEnglishNumber(value);
        return !isNaN(parseFloat(en)) && isFinite(en);
    }

    /**
     * মানকে সংখ্যায় রূপান্তর করে (বাংলা হলেও)
     */
    function toNumber(value) {
        if (!isNumeric(value)) return null;
        return parseFloat(toEnglishNumber(value));
    }

    /**
     * মেধাক্রম নম্বরকে অর্ডিনাল লেবেলে রূপান্তর করে - শুধুমাত্র ১ম/২য়/৩য় দেখাবে,
     * এর বেশি হলে খালি ফেরত দেবে (স্পষ্ট নির্দেশনা অনুযায়ী)
     */
    function meritLabel(merit) {
        if (merit === 1) return '১ম';
        if (merit === 2) return '২য়';
        if (merit === 3) return '৩য়';
        return '';
    }

    /**
     * মকতব বিভাগের শ্রেণির নাম Excel-এ যেভাবেই লেখা থাকুক না কেন (যেমন: "১ম শ্রেণি",
     * "১ম শ্রেণী", "প্রথম শ্রেণি", "প্রথম শ্রেনী" - ী/ি ও ণ/ন বানান-ভেদ + সংখ্যা/শব্দ দুই
     * ধরনের ক্রম-নাম, অতিরিক্ত Space সহ), তাকে CONSTANTS.MAKTAB_CLASSES-এর ক্যানোনিক্যাল
     * (সংক্ষিপ্ত, যেমন "১ম শ্রেণি") নামে রূপান্তর করে - Regex-ভিত্তিক বলে বানান যেভাবেই
     * লেখা থাকুক, "শ্রেণি/শ্রেণী/শ্রেনি/শ্রেনী" শব্দ ও ক্রম চিনতে পারলেই মিলে যাবে।
     * কোনো Match না পেলে মূল Trim করা মান-ই ফেরত দেয়।
     */
    function normalizeClassName(raw) {
        if (raw === null || raw === undefined) return '';
        const collapsed = String(raw).trim().replace(/\s+/g, ' ');
        const compact = collapsed.replace(/\s+/g, '');

        const hasClassWord = /শ্রেণ[ীি]|শ্রেন[ীি]/.test(compact);
        if (!hasClassWord) return collapsed;

        if (/শিশু/.test(compact)) return 'শিশু শ্রেণি';
        if (/(^|[^০-৯])১ম|প্রথম/.test(compact)) return '১ম শ্রেণি';
        if (/(^|[^০-৯])২য়|দ্বিতীয়/.test(compact)) return '২য় শ্রেণি';
        if (/(^|[^০-৯])৩য়|তৃতীয়/.test(compact)) return '৩য় শ্রেণি';
        if (/৪র্থ|চতুর্থ/.test(compact)) return '৪র্থ শ্রেণি';

        return collapsed;
    }

    /**
     * পরীক্ষার নাম (Excel ফাইলের নাম) থেকে রিপোর্টের শিরোনাম তৈরি করে।
     * পরীক্ষার নামের শেষে ইতিমধ্যে "-" চিহ্ন/স্পেস থাকলে তা বাদ দিয়ে তারপর
     * নির্দিষ্ট Suffix যুক্ত করা হয়, যাতে "-" চিহ্নটি ফলাফলে কেবল একবারই আসে।
     * যেমন: buildReportTitle('১ম সাময়িক পরীক্ষা - ২০২৬', 'এর কিতাব পরিপ্রেক্ষিত ফলাফল')
     *      -> '১ম সাময়িক পরীক্ষা - ২০২৬ - এর কিতাব পরিপ্রেক্ষিত ফলাফল' নয়,
     *         বরং '১ম সাময়িক পরীক্ষা ২০২৬ - এর কিতাব পরিপ্রেক্ষিত ফলাফল'
     */
    function buildReportTitle(examName, suffix) {
        const base = String(examName || '').trim().replace(/[\s\u200c]*-+\s*$/, '').trim();
        return `${base} - ${suffix}`;
    }

    /**
     * Debounce Function - Search Input-এর জন্য কাজে লাগবে
     */
    function debounce(fn, delay = 250) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * একটি File-কে Base64 String-এ রূপান্তর করে (Logo/Signature Upload-এর জন্য)
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * HTML Escape - XSS Protection
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Toast Notification দেখানোর জন্য
     * type: 'success' | 'error' | 'warning' | 'info'
     */
    function showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Loading Overlay দেখানো/লুকানো
     */
    function showLoading(message = 'অপেক্ষা করুন...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `<div class="loading-box"><div class="spinner"></div><p>${escapeHtml(message)}</p></div>`;
        overlay.classList.add('active');
    }

    function updateLoadingProgress(percent, message) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        const box = overlay.querySelector('.loading-box');
        if (box) {
            box.innerHTML = `<div class="spinner"></div><p>${escapeHtml(message || '')}</p><div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div><span class="progress-text">${toBanglaNumber(percent)}%</span>`;
        }
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    /**
     * Print করার আগে Page Size ও Orientation বেছে নেওয়ার জন্য ছোট Modal দেখায়
     * Returns Promise<{size, orientation}> - বাতিল করলে null রিটার্ন করে
     */
    function choosePrintOptions(defaultSize = 'A4', defaultOrientation = 'portrait') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-box">
                    <h3>প্রিন্ট সেটআপ</h3>
                    <div class="form-row" style="text-align:left;">
                        <label>পৃষ্ঠার আকার (Page Size)</label>
                        <select id="printOptSize" class="form-control">
                            <option value="A4" ${defaultSize === 'A4' ? 'selected' : ''}>A4</option>
                            <option value="Legal" ${defaultSize === 'Legal' ? 'selected' : ''}>Legal</option>
                        </select>
                    </div>
                    <div class="form-row" style="text-align:left;">
                        <label>দিক (Orientation)</label>
                        <select id="printOptOrient" class="form-control">
                            <option value="portrait" ${defaultOrientation === 'portrait' ? 'selected' : ''}>খাড়া (Portrait)</option>
                            <option value="landscape" ${defaultOrientation === 'landscape' ? 'selected' : ''}>আড়াআড়ি (Landscape)</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" data-action="cancel">বাতিল</button>
                        <button class="btn btn-primary" data-action="confirm">প্রিন্ট করুন</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                if (action === 'confirm') {
                    const size = document.getElementById('printOptSize').value;
                    const orientation = document.getElementById('printOptOrient').value;
                    modal.remove();
                    resolve({ size, orientation });
                } else if (action === 'cancel') {
                    modal.remove();
                    resolve(null);
                }
            });
        });
    }

    /**
     * Confirm Dialog (Promise ভিত্তিক)
     */
    function confirmDialog(message, title = 'নিশ্চিত করুন') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-box">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(message)}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" data-action="cancel">বাতিল</button>
                        <button class="btn btn-danger" data-action="confirm">নিশ্চিত</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                if (action) {
                    modal.remove();
                    resolve(action === 'confirm');
                }
            });
        });
    }

    return {
        toBanglaNumber, toEnglishNumber, generateId, formatDecimal, nowISO,
        formatDateBangla, detectSpecialStatus, isNumeric, toNumber, debounce,
        fileToBase64, escapeHtml, showToast, showLoading, updateLoadingProgress,
        hideLoading, confirmDialog, meritLabel, choosePrintOptions, normalizeClassName,
        buildReportTitle
    };
})();
