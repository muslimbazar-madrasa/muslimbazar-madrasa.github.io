/* =========================================================
   Notice Board — script.js
   Backend: Google Apps Script Web App that returns JSON,
   built on top of a Google Sheet (see README for the sheet
   structure and the Apps Script snippet).
   ========================================================= */

// 1) Paste your deployed Google Apps Script Web App URL here.
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyDdAToPlz4wwhwmm6Y8zWzXxIa-QdnkIQ-ImRMs0PDAHke1gdXcl0M-RWVAggTKAWZ/exec";

// 2) Local test mode — flip this to true to try the site before your
//    Apps Script backend is ready or before pushing to GitHub Pages.
//    Data is seeded into localStorage on first run, so you can also open
//    devtools > Application > Local Storage and edit "noticeboard_notices"
//    by hand to test new content instantly, with no network call at all.
//    Set this back to false before deploying live.
const LOCAL_TEST_MODE = false;
const LOCAL_STORAGE_KEY = "noticeboard_notices";
const CACHE_KEY = "noticeboard_cache"; // last-known-good copy of the live API data, used for instant repeat loads
const MAX_PINNED = 3; // at most this many notices can stay pinned to the top

const SAMPLE_NOTICES = [
  { Title: "বার্ষিক পরীক্ষার সময়সূচি প্রকাশ", Date: "2026-10-01", Category: "Exam", Pinned: true,
    Details: "আগামী ১৫ অক্টোবর থেকে বার্ষিক পরীক্ষা শুরু হবে। সকল ছাত্রকে নির্ধারিত সময়ে হলে উপস্থিত থাকতে অনুরোধ করা হলো। সম্পূর্ণ রুটিন নোটিশ বোর্ডে টানিয়ে দেওয়া হয়েছে।",
    Signature_Type: "muhtamim" },
  { Title: "পরীক্ষার ফি পরিশোধের শেষ তারিখ", Date: "2026-09-25", Category: "Exam Fee", Pinned: false,
    Details: "বার্ষিক পরীক্ষার ফি বাবদ ৫০০ টাকা আগামী ৩০ সেপ্টেম্বরের মধ্যে অফিসে জমা দেওয়ার জন্য অনুরোধ করা হলো। নির্ধারিত সময়ের পর ফি জমা দিলে ১০০ টাকা বিলম্ব মাশুল প্রযোজ্য হবে।",
    Signature_Type: "muhtamim" },
  { Title: "শীতকালীন ছুটি ঘোষণা", Date: "2026-12-20", Category: "Holiday", Pinned: false,
    Details: "আগামী ২৫ ডিসেম্বর থেকে ৫ জানুয়ারি পর্যন্ত মাদ্রাসা শীতকালীন ছুটি থাকবে। ৬ জানুয়ারি থেকে যথারীতি ক্লাস শুরু হবে।",
    Signature_Type: "both" },
  { Title: "জুমার নামাজের কারণে মাদ্রাসা বন্ধ থাকবে", Date: "2026-09-18", Category: "Holiday", Pinned: false,
    Details: "প্রতি সপ্তাহের ন্যায় এই সপ্তাহেও জুমার নামাজ উপলক্ষে বৃহস্পতিবার বাদ আসর থেকে শুক্রবার পর্যন্ত মাদ্রাসা বন্ধ থাকবে।",
    Signature_Type: "muhtamim" },
  { Title: "বার্ষিক ওয়াজ মাহফিল অনুষ্ঠান", Date: "2026-11-05", Category: "Program", Pinned: true,
    Details: "আগামী ৫ নভেম্বর বাদ মাগরিব মাদ্রাসা প্রাঙ্গণে বার্ষিক ওয়াজ মাহফিল অনুষ্ঠিত হবে। সকল অভিভাবক ও এলাকাবাসীকে উপস্থিত থাকার আমন্ত্রণ জানানো যাচ্ছে।",
    Signature_Type: "both" },
  { Title: "নতুন শিক্ষাবর্ষের ভর্তি পরীক্ষার তারিখ নির্ধারণ", Date: "2026-09-22", Category: "Exam", Pinned: false,
    Details: "১৪৪৮ হিজরি শিক্ষাবর্ষে ভর্তি পরীক্ষা আগামী ২৫ সেপ্টেম্বর সকাল ৯টায় অনুষ্ঠিত হবে। ভর্তি ফরম অফিস থেকে সংগ্রহ করা যাবে।",
    Signature_Type: "muhtamim" },
  { Title: "হিফজ বিভাগের সমাপনী অনুষ্ঠান", Date: "2026-10-15", Category: "Program", Pinned: false,
    Details: "হিফজ বিভাগের এই বছরের সমাপনী ও দস্তারবন্দী অনুষ্ঠান আগামী ১৫ অক্টোবর অনুষ্ঠিত হবে। সংশ্লিষ্ট ছাত্রদের অভিভাবকদের উপস্থিত থাকার জন্য বিশেষভাবে অনুরোধ করা হলো।",
    Signature_Type: "both" },
  { Title: "ঈদুল আযহা উপলক্ষে দীর্ঘ ছুটি", Date: "2027-06-10", Category: "Holiday", Pinned: true,
    Details: "ঈদুল আযহা উপলক্ষে মাদ্রাসা ১০ দিনের ছুটি থাকবে। ছুটির সময়সূচি ও ক্লাস পুনরায় শুরুর তারিখ পরবর্তীতে জানিয়ে দেওয়া হবে।",
    Signature_Type: "both" },
  { Title: "অর্ধ-বার্ষিক পরীক্ষার ফি নির্ধারণ", Date: "2026-11-20", Category: "Exam Fee", Pinned: false,
    Details: "অর্ধ-বার্ষিক পরীক্ষার ফি ৩০০ টাকা নির্ধারণ করা হয়েছে। আগামী ২৫ নভেম্বরের মধ্যে অফিসে জমা দেওয়ার জন্য বলা হলো।",
    Signature_Type: "muhtamim" },
  { Title: "অভিভাবক সমাবেশ ও পুরস্কার বিতরণী অনুষ্ঠান", Date: "2026-09-30", Category: "Program", Pinned: false,
    Details: "আগামী শুক্রবার বাদ জুমা বার্ষিক অভিভাবক সমাবেশ ও কৃতি শিক্ষার্থীদের মাঝে পুরস্কার বিতরণী অনুষ্ঠান অনুষ্ঠিত হবে। সকলের উপস্থিতি কাম্য।",
    Signature_Type: "both" },
];

// ---- State ----
let allNotices = [];      // full dataset from the API
let filteredNotices = []; // after search + category filter

// ---- DOM refs ----
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const noticeGrid = document.getElementById("noticeGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const noticeModal = document.getElementById("noticeModal");
const modalClose = document.getElementById("modalClose");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalDetails = document.getElementById("modalDetails");

document.getElementById("footerYear").textContent = new Date().getFullYear();

// ---- Fetch notices: local test mode (localStorage) or the live Sheet API ----
// The Apps Script Web App has an unavoidable cold-start delay on its own end,
// so the spinner used to sit on screen for every single visit. To make repeat
// visits feel instant, we cache the last successful API response: if a cache
// exists it's shown right away (no spinner), and a fresh copy is fetched
// quietly in the background and swapped in once it arrives. The spinner is
// only shown on a person's very first visit, when there is nothing to show yet.
async function loadNotices() {
  if (LOCAL_TEST_MODE) {
    showLoading(true);
    try {
      const rows = await loadFromLocalStorage();
      allNotices = rows.map(normalizeNotice);
      applyFilters();
    } catch (err) {
      console.error("Failed to load notices:", err);
      noticeGrid.innerHTML = `<p class="empty-state">নোটিশ লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।</p>`;
    } finally {
      showLoading(false);
    }
    return;
  }

  const cached = readCache();
  if (cached) {
    // Show the cached copy immediately, no spinner, then refresh quietly.
    allNotices = cached.map(normalizeNotice);
    applyFilters();
    refreshFromApiInBackground();
    return;
  }

  // No cache yet (first-ever visit on this device) — show the spinner while
  // we wait for the live API.
  showLoading(true);
  try {
    const rows = await loadFromApi();
    writeCache(rows);
    allNotices = rows.map(normalizeNotice);
    applyFilters();
  } catch (err) {
    console.error("Failed to load notices:", err);
    noticeGrid.innerHTML = `<p class="empty-state">নোটিশ লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।</p>`;
  } finally {
    showLoading(false);
  }
}

// Fetches the live data without touching the spinner or blocking the UI;
// updates the grid + cache in place if the fetch succeeds, and silently
// keeps the already-visible cached notices if it fails.
async function refreshFromApiInBackground() {
  try {
    const rows = await loadFromApi();
    writeCache(rows);
    allNotices = rows.map(normalizeNotice);
    applyFilters();
  } catch (err) {
    console.error("Background refresh failed, keeping cached notices:", err);
  }
}

function readCache() {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    return null;
  }
}

function writeCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch (err) {
    // Storage full or unavailable — not critical, just skip caching.
  }
}

// Simulates the network round-trip so the loading spinner behaves the
// same way it will once the real API is wired in, and seeds SAMPLE_NOTICES
// into localStorage the first time so you can edit them by hand afterward.
function loadFromLocalStorage() {
  return new Promise((resolve) => {
    let stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SAMPLE_NOTICES));
      stored = JSON.stringify(SAMPLE_NOTICES);
    }
    setTimeout(() => resolve(JSON.parse(stored)), 300); // small delay so the spinner is visible
  });
}

async function loadFromApi() {
  const response = await fetch(GOOGLE_SHEET_API_URL);
  if (!response.ok) throw new Error("Network response was not ok");
  const data = await response.json();
  // Apps Script commonly returns either a bare array, or { data: [...] } / { notices: [...] }.
  return Array.isArray(data) ? data : (data.data || data.notices || []);
}

function normalizeNotice(row) {
  return {
    Title: row.Title || "শিরোনামহীন নোটিশ",
    Date: row.Date || "",
    Category: row.Category || "Program",
    Details: row.Details || "",
    Signature_Type: (row.Signature_Type || "muhtamim").toLowerCase().trim(),
    Pinned: parseBool(row.Pinned),
  };
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "হ্যাঁ"].includes(value.trim().toLowerCase());
  return false;
}

function showLoading(isLoading) {
  loadingState.classList.toggle("hidden", !isLoading);
  if (isLoading) noticeGrid.innerHTML = "";
}

// ---- Search + Category filtering (real-time) ----
function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const matches = allNotices.filter((n) => {
    const matchesCategory = category === "all" || n.Category === category;
    const haystack = `${n.Title} ${n.Details}`.toLowerCase();
    const matchesQuery = query === "" || haystack.includes(query);
    return matchesCategory && matchesQuery;
  });

  filteredNotices = sortWithPinnedFirst(matches);
  renderNotices(filteredNotices);
}

// Pinned notices (max MAX_PINNED, most recent among them wins ties) float to
// the top; everything else follows in newest-first order. Applied after
// search/category filtering, so a pinned notice only shows at top when it
// also matches the current filter.
function sortWithPinnedFirst(notices) {
  const byNewest = (a, b) => new Date(b.Date) - new Date(a.Date);
  const pinned = notices.filter((n) => n.Pinned).sort(byNewest).slice(0, MAX_PINNED);
  const pinnedSet = new Set(pinned);
  const rest = notices.filter((n) => !pinnedSet.has(n)).sort(byNewest);
  return [...pinned, ...rest];
}

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

// ---- Render notice cards ----
function renderNotices(notices) {
  noticeGrid.innerHTML = "";
  emptyState.classList.toggle("hidden", notices.length !== 0);

  notices.forEach((notice, index) => {
    const card = document.createElement("article");
    card.className = notice.Pinned ? "notice-card pinned" : "notice-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `নোটিশ খুলুন: ${notice.Title}`);

    card.innerHTML = `
      <div class="card-top-row">
        <span class="badge badge-${slugifyCategory(notice.Category)}">${escapeHtml(notice.Category)}</span>
        <span class="card-date">${formatDate(notice.Date)}</span>
      </div>
      ${notice.Pinned ? '<span class="pin-tag">📌 গুরুত্বপূর্ণ</span>' : ""}
      <h3 class="card-title">${escapeHtml(notice.Title)}</h3>
      <p class="card-excerpt">${escapeHtml(notice.Details)}</p>
      <span class="card-readmore">বিস্তারিত দেখুন →</span>
    `;

    card.addEventListener("click", () => openModal(notice));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(notice);
      }
    });

    noticeGrid.appendChild(card);
  });
}

// ---- Modal ----
function openModal(notice) {
  modalCategory.textContent = notice.Category;
  modalCategory.className = `badge badge-${slugifyCategory(notice.Category)}`;
  modalTitle.textContent = notice.Title;
  modalDate.textContent = formatDate(notice.Date);
  modalDetails.textContent = notice.Details;

  noticeModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  noticeModal.classList.add("hidden");
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
noticeModal.addEventListener("click", (e) => {
  if (e.target === noticeModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !noticeModal.classList.contains("hidden")) closeModal();
});

// ---- Helpers ----
function slugifyCategory(category) {
  return (category || "").replace(/\s+/g, ""); // "Exam Fee" -> "ExamFee", for CSS class names
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr; // fall back to raw string if unparsable
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Init ----
loadNotices();
