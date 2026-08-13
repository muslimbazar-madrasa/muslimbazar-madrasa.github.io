/**
 * settings.js
 * ------------------------------------------------------------
 * সাইটের রং, ফন্ট, এলাইনমেন্ট, হেডার উচ্চতা — এই জিনিসগুলো এখান
 * থেকে নিয়ন্ত্রণ করা যায়। নিচের RP_DEFAULT_SETTINGS অবজেক্টের
 * মান বদলে GitHub-এ সেভ করলেই পুরো সাইটে (সব ভিজিটরের জন্য)
 * পরিবর্তনটা কার্যকর হয়ে যাবে।
 *
 * admin/settings-panel.html থেকে লাইভ প্রিভিউ দেখে এই মানগুলো
 * ঠিক করে নিতে পারবেন, তারপর সেখান থেকে জেনারেট হওয়া কোড কপি
 * করে নিচের অবজেক্টে বসিয়ে দিলেই হবে।
 * ------------------------------------------------------------
 */
(function () {
    'use strict';

    // ================= এখানে মান বদলান =================
    const RP_DEFAULT_SETTINGS = {
        // রং
        colorGreen: '#0f6e4f',
        colorGreenDark: '#0c5940',
        colorGreenLight: '#16a34a',
        colorInk: '#1f2a44',
        colorMuted: '#6b7280',
        colorBorder: '#dfe4e0',
        colorBg: '#eef2f0',

        // ফন্ট
        fontFamily: "'Noto Sans Bengali', 'SolaimanLipi', Arial, sans-serif",
        fontSizeBase: '14px',

        // এলাইনমেন্ট (নাম/বিষয় কলাম) — সম্ভাব্য মান: left | center | right
        // (একদম নিচের সামারী/টোটাল সারি সবসময় ডান দিকেই থাকবে, এটা settings দিয়ে বদলায় না)
        nameAlign: 'left',

        // জামাত-ভিত্তিক ও এক নজরে ফলাফলের উল্লম্ব হেডারের উচ্চতা
        // সম্ভাব্য মান: 'auto' (লেখা অনুযায়ী স্বয়ংক্রিয়) অথবা নির্দিষ্ট px, যেমন '92px'
        vertHeaderHeight: 'auto'
    };
    // =====================================================

    function applySettings(settings) {
        const root = document.documentElement.style;
        root.setProperty('--rp-green', settings.colorGreen);
        root.setProperty('--rp-green-dark', settings.colorGreenDark);
        root.setProperty('--rp-green-light', settings.colorGreenLight);
        root.setProperty('--rp-ink', settings.colorInk);
        root.setProperty('--rp-muted', settings.colorMuted);
        root.setProperty('--rp-border', settings.colorBorder);
        root.setProperty('--rp-bg', settings.colorBg);
        root.setProperty('--rp-font-family', settings.fontFamily);
        root.setProperty('--rp-font-size-base', settings.fontSizeBase);
        root.setProperty('--rp-name-align', settings.nameAlign);
        root.setProperty('--rp-vert-header-height', settings.vertHeaderHeight);
    }

    // সাধারণ ভিজিটরের জন্য সবসময় RP_DEFAULT_SETTINGS প্রয়োগ হয়।
    // শুধুমাত্র admin/settings-panel.html থেকে "প্রিভিউ" চালু করলে
    // localStorage-এ থাকা override সাময়িকভাবে (শুধু ওই ব্রাউজারে) প্রয়োগ হয় —
    // এটা অন্য কোনো ভিজিটরের ব্রাউজারে প্রভাব ফেলে না।
    let settings = RP_DEFAULT_SETTINGS;
    try {
        const isPreview = window.location.search.indexOf('rp_preview=1') !== -1;
        if (isPreview) {
            const override = localStorage.getItem('rp_settings_preview');
            if (override) {
                settings = Object.assign({}, RP_DEFAULT_SETTINGS, JSON.parse(override));
            }
        }
    } catch (e) { /* localStorage না থাকলেও সমস্যা নেই, ডিফল্ট মান ব্যবহার হবে */ }

    applySettings(settings);

    // অ্যাডমিন প্যানেলের জন্য এক্সপোজ করা হলো
    window.RP_DEFAULT_SETTINGS = RP_DEFAULT_SETTINGS;
    window.RP_applySettings = applySettings;
})();
