/**
 * result-app.js
 * ------------------------------------------------------------
 * পাবলিক ফলাফল পেইজের সম্পূর্ণ Logic।
 * data/result-data.xlsx ফাইল থেকে সরাসরি ফলাফল পড়ে, একই হিসাব-ইঞ্জিন
 * (KitabEngine/HifzEngine/MaktabEngine/RankingEngine) দিয়ে গণনা করে
 * চারটি ভিউ দেখায়: ব্যক্তিগত ফলাফল, জামাত/গ্রুপ-ভিত্তিক ফলাফল,
 * এক নজরে ফলাফল, পাইচার্ট।
 *
 * ডেটা আপডেট করতে শুধু data/result-data.xlsx ফাইল বদলে দিলেই হবে -
 * কোনো কোড পরিবর্তনের দরকার নেই।
 * ------------------------------------------------------------
 */

(function () {
    const EXCEL_PATH = 'data/result-data.xlsx';

    const app = document.getElementById('rpApp');
    const statusBox = document.getElementById('rpStatus');

    let CALC = null;          // { kitab: {jamah: {...}}, hifz: {...}, maktab: {...} }
    let ALL_STUDENTS = [];    // সব বিভাগের ছাত্র একত্রে (রোল সার্চের জন্য)
    let loadPromise = null;

    const HIFZ_LABEL_SUBJECTS = ['কুরআন', 'তাজবিদ', 'মাসাইল'];

    // ---------------------- ডেটা লোড ----------------------

    function setStatus(msg, isError) {
        if (!statusBox) return;
        statusBox.style.display = msg ? 'block' : 'none';
        statusBox.textContent = msg || '';
        statusBox.className = 'rp-status' + (isError ? ' rp-status-error' : '');
    }

    async function loadData() {
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            setStatus('ফলাফল লোড হচ্ছে, একটু অপেক্ষা করুন...', false);
            let res;
            try {
                res = await fetch(EXCEL_PATH, { cache: 'no-store' });
            } catch (e) {
                throw new Error('ফলাফল ফাইল লোড করা যায়নি (নেটওয়ার্ক সমস্যা)।');
            }
            if (!res.ok) {
                throw new Error('এখনো কোনো ফলাফল প্রকাশ করা হয়নি।');
            }
            const blob = await res.blob();
            const { success, report, data } = await ExcelEngine.importExcelFile({ file: blob });
            if (!success) {
                throw new Error((report.errors && report.errors[0]) || 'ফলাফল ফাইল পড়তে সমস্যা হয়েছে।');
            }

            CALC = {
                kitab: KitabEngine.calculateAll(data.kitab),
                hifz: HifzEngine.calculateAll(data.hifz),
                maktab: MaktabEngine.calculateAll(data.maktab)
            };

            ALL_STUDENTS = [];
            CONSTANTS.KITAB_JAMAH_ORDER.forEach(jamah => {
                const jd = CALC.kitab[jamah];
                if (!jd) return;
                jd.students.forEach(s => ALL_STUDENTS.push({ ...s, department: 'কিতাব বিভাগ', jamahLabel: jamah, subjectHeaders: jd.subjectHeaders }));
            });
            if (CALC.hifz) {
                CALC.hifz.students.forEach(s => ALL_STUDENTS.push({ ...s, department: 'হিফজ বিভাগ', jamahLabel: (s.examGroup || '') , subjectHeaders: HIFZ_LABEL_SUBJECTS }));
            }
            if (CALC.maktab) {
                CALC.maktab.students.forEach(s => ALL_STUDENTS.push({ ...s, department: 'মকতব বিভাগ', jamahLabel: (s.group || s.class || ''), subjectHeaders: CALC.maktab.subjectHeaders }));
            }

            setStatus('', false);
        })();
        return loadPromise.catch(err => {
            setStatus(err.message || 'একটি সমস্যা হয়েছে।', true);
            loadPromise = null;
            throw err;
        });
    }

    // ---------------------- সাধারণ Helper ----------------------

    function esc(v) { return Utils.escapeHtml(String(v === null || v === undefined ? '' : v)); }
    function bn(v) { return Utils.toBanglaNumber(v); }

    function gradeClass(grade) {
        if ([CONSTANTS.STATUS.ABSENT, CONSTANTS.STATUS.SUSPENDED, CONSTANTS.STATUS.CANCELLED].includes(grade)) return 'rp-grade-special';
        if (grade === CONSTANTS.GRADE.RASIB) return 'rp-grade-fail';
        return 'rp-grade-pass';
    }

    function h(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

    // ---------------------- নেভিগেশন / ভিউ কাঠামো ----------------------

    function renderHome() {
        app.innerHTML = `
        <div class="rp-cards">
            <button class="rp-card" data-view="search">
                <span class="rp-card-icon">🔍</span>
                <span class="rp-card-title">ব্যক্তিগত ফলাফল</span>
                <span class="rp-card-sub">রোল নম্বর দিয়ে খুঁজুন</span>
            </button>
            <button class="rp-card" data-view="jamah">
                <span class="rp-card-icon">📋</span>
                <span class="rp-card-title">জামাত/গ্রুপ-ভিত্তিক ফলাফল</span>
                <span class="rp-card-sub">সম্পূর্ণ তালিকা দেখুন</span>
            </button>
            <button class="rp-card" data-view="glance">
                <span class="rp-card-icon">📊</span>
                <span class="rp-card-title">এক নজরে ফলাফল</span>
                <span class="rp-card-sub">সারসংক্ষেপ সারণি</span>
            </button>
            <button class="rp-card" data-view="chart">
                <span class="rp-card-icon">🥧</span>
                <span class="rp-card-title">ফলাফল পাইচার্ট</span>
                <span class="rp-card-sub">গ্রাফের মাধ্যমে ফলাফল</span>
            </button>
        </div>`;
        app.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => go(btn.dataset.view));
        });
    }

    function backBar(label) {
        return `<div class="rp-backbar"><button class="rp-back" id="rpBack">← ${esc(label)}</button></div>`;
    }

    function attachBack() {
        const b = document.getElementById('rpBack');
        if (b) b.addEventListener('click', renderHome);
    }

    function departmentPicker(onPick) {
        return `
        <div class="rp-dept-grid">
            <button class="rp-dept-btn" data-dept="kitab">কিতাব বিভাগ</button>
            <button class="rp-dept-btn" data-dept="hifz">হিফজ বিভাগ</button>
            <button class="rp-dept-btn" data-dept="maktab">মকতব বিভাগ</button>
        </div>`;
    }

    function bindDeptPicker(onPick) {
        app.querySelectorAll('.rp-dept-btn').forEach(btn => {
            btn.addEventListener('click', () => onPick(btn.dataset.dept));
        });
    }

    // গ্রুপ তালিকা প্রতিটি বিভাগের জন্য: [{key, label}]
    function groupsOf(dept) {
        if (dept === 'kitab') return CONSTANTS.KITAB_JAMAH_ORDER.map(j => ({ key: j, label: j }));
        if (dept === 'hifz') return CONSTANTS.HIFZ_EXAM_GROUPS.map(g => ({ key: g, label: g }));
        if (dept === 'maktab') {
            const rows = [];
            Object.keys(CONSTANTS.MAKTAB_GROUPS).forEach(main => {
                CONSTANTS.MAKTAB_GROUPS[main].forEach(sub => rows.push({ key: sub, label: sub }));
            });
            return rows;
        }
        return [];
    }

    function deptLabel(dept) {
        return dept === 'kitab' ? 'কিতাব বিভাগ' : dept === 'hifz' ? 'হিফজ বিভাগ' : 'মকতব বিভাগ';
    }

    function getStudentsAndSubjects(dept, groupKey) {
        if (dept === 'kitab') {
            const jd = CALC.kitab[groupKey];
            if (!jd) return null;
            return { students: jd.students, subjectHeaders: jd.subjectHeaders, summary: jd.summary };
        }
        if (dept === 'hifz') {
            const students = HifzEngine.filterByExamGroup(CALC.hifz.students, groupKey);
            return { students, subjectHeaders: HIFZ_LABEL_SUBJECTS, summary: RankingEngine.summarize(students) };
        }
        if (dept === 'maktab') {
            const students = MaktabEngine.filterBySubGroup(CALC.maktab.students, groupKey);
            return { students, subjectHeaders: CALC.maktab.subjectHeaders, summary: RankingEngine.summarize(students) };
        }
        return null;
    }

    // ---------------------- ১. ব্যক্তিগত ফলাফল (রোল সার্চ) ----------------------

    function renderSearch() {
        app.innerHTML = backBar('হোম') + `
        <div class="rp-panel">
            <h2 class="rp-panel-title">ব্যক্তিগত ফলাফল</h2>
            <div class="rp-search-row">
                <input type="text" id="rpRollInput" class="rp-input" placeholder="রোল নম্বর লিখুন" inputmode="numeric" />
                <button class="rp-btn" id="rpRollSearchBtn">খুঁজুন</button>
            </div>
            <div id="rpSearchResult"></div>
        </div>`;
        attachBack();

        const input = document.getElementById('rpRollInput');
        const doSearch = () => {
            const rollRaw = (input.value || '').trim();
            const box = document.getElementById('rpSearchResult');
            if (!rollRaw) { box.innerHTML = ''; return; }
            const rollEn = Utils.toEnglishNumber(rollRaw);
            const found = ALL_STUDENTS.find(s => Utils.toEnglishNumber(String(s.roll)) === rollEn);
            if (!found) {
                box.innerHTML = `<div class="rp-empty">এই রোল নম্বরে কোনো ফলাফল পাওয়া যায়নি।</div>`;
                return;
            }
            box.innerHTML = renderPersonalCard(found);
        };
        document.getElementById('rpRollSearchBtn').addEventListener('click', doSearch);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    }

    function renderPersonalCard(s) {
        const rows = s.subjectHeaders.map(subj => {
            const entry = s.subjects && s.subjects[subj];
            let val = '-';
            if (entry) {
                if (entry.status === 'cancelled') val = 'বাতিল';
                else if (entry.status === 'suspended') val = 'স্থগিত';
                else if (entry.status === 'absent') val = 'অনুপস্থিত';
                else if (entry.value !== null && entry.value !== undefined) val = bn(entry.value);
            }
            return `<tr><td>${esc(subj)}</td><td>${val}</td></tr>`;
        }).join('');

        const totalRow = (s.total !== null && s.total !== undefined)
            ? `<div class="rp-stat"><span>মোট নম্বর</span><b>${bn(s.total)}</b></div>` : '';
        const avgRow = (s.average !== null && s.average !== undefined)
            ? `<div class="rp-stat"><span>গড় নম্বর</span><b>${bn(s.average)}</b></div>` : '';
        const meritRow = s.merit ? `<div class="rp-stat"><span>মেধাক্রম</span><b>${bn(s.merit)}</b></div>` : '';

        return `
        <div class="rp-personal-card">
            <div class="rp-personal-head">
                <div class="rp-personal-name">${esc(s.name)}</div>
                <div class="rp-personal-sub">${esc(s.department)} — ${esc(s.jamahLabel)}</div>
            </div>
            <div class="rp-personal-info">
                <div>পিতার নাম: ${esc(s.fatherName || '-')}</div>
                <div>রোল: ${bn(s.roll)}</div>
            </div>
            <table class="rp-table rp-table-sm">
                <thead><tr><th>বিষয়</th><th>নম্বর</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="rp-stats-row">
                ${totalRow}${avgRow}${meritRow}
                <div class="rp-stat"><span>বিভাগ</span><b class="${gradeClass(s.grade)}">${esc(s.grade)}</b></div>
            </div>
        </div>`;
    }

    // ---------------------- ২. জামাত/গ্রুপ-ভিত্তিক ফলাফল ----------------------

    function renderJamahDeptPicker() {
        app.innerHTML = backBar('হোম') + `<h2 class="rp-panel-title">বিভাগ নির্বাচন করুন</h2>` + departmentPicker();
        attachBack();
        bindDeptPicker(dept => renderJamahGroupPicker(dept));
    }

    function renderJamahGroupPicker(dept) {
        const groups = groupsOf(dept);
        app.innerHTML = backBar(deptLabel(dept)) + `
        <h2 class="rp-panel-title">${esc(deptLabel(dept))} — জামাত/গ্রুপ নির্বাচন করুন</h2>
        <div class="rp-group-grid">
            ${groups.map(g => `<button class="rp-group-btn" data-key="${esc(g.key)}">${esc(g.label)}</button>`).join('')}
        </div>`;
        const backBtn = document.getElementById('rpBack');
        backBtn.addEventListener('click', renderJamahDeptPicker);
        app.querySelectorAll('.rp-group-btn').forEach(btn => {
            btn.addEventListener('click', () => renderJamahTable(dept, btn.dataset.key));
        });
    }

    function renderJamahTable(dept, groupKey) {
        const data = getStudentsAndSubjects(dept, groupKey);
        if (!data) { app.innerHTML = `<div class="rp-empty">তথ্য পাওয়া যায়নি।</div>`; return; }

        const subjectHeaders = data.subjectHeaders;
        const head = `<tr><th>ক্র.</th><th>নাম</th><th>রোল</th>${subjectHeaders.map(s => `<th>${esc(s)}</th>`).join('')}<th>মোট</th><th>গড়</th><th>বিভাগ</th><th>মেধা</th></tr>`;

        const rows = data.students.map(s => {
            const marks = subjectHeaders.map(subj => {
                const entry = s.subjects && s.subjects[subj];
                if (!entry) return '<td>-</td>';
                if (entry.status === 'cancelled') return '<td>বা.</td>';
                if (entry.status === 'suspended') return '<td>স্থ.</td>';
                if (entry.status === 'absent') return '<td>অনু.</td>';
                return `<td>${entry.value !== null && entry.value !== undefined ? bn(entry.value) : '-'}</td>`;
            }).join('');
            return `<tr>
                <td>${bn(s.serial)}</td>
                <td class="rp-td-name">${esc(s.name)}</td>
                <td>${bn(s.roll)}</td>
                ${marks}
                <td>${s.total !== null && s.total !== undefined ? bn(s.total) : '-'}</td>
                <td>${s.average !== null && s.average !== undefined ? bn(s.average) : '-'}</td>
                <td class="${gradeClass(s.grade)}">${esc(s.grade)}</td>
                <td>${s.merit ? bn(s.merit) : '-'}</td>
            </tr>`;
        }).join('');

        app.innerHTML = backBar(deptLabel(dept)) + `
        <h2 class="rp-panel-title">${esc(deptLabel(dept))} — ${esc(groupKey)}</h2>
        <div class="rp-table-wrap">
            <table class="rp-table">
                <thead>${head}</thead>
                <tbody>${rows || '<tr><td colspan="99">কোনো ছাত্র পাওয়া যায়নি।</td></tr>'}</tbody>
            </table>
        </div>`;
        document.getElementById('rpBack').addEventListener('click', () => renderJamahGroupPicker(dept));
    }

    // ---------------------- ৩. এক নজরে ফলাফল ----------------------

    function renderGlanceDeptPicker() {
        app.innerHTML = backBar('হোম') + `<h2 class="rp-panel-title">বিভাগ নির্বাচন করুন</h2>` + departmentPicker();
        attachBack();
        bindDeptPicker(dept => renderGlanceTable(dept));
    }

    function renderGlanceTable(dept) {
        const groups = groupsOf(dept);
        const cols = ['মুমতাজ', 'জায়্যিদজিদ্দান', 'জায়্যিদ', 'মাকবুল', 'রাসিব', 'অনুপস্থিত', 'স্থগিত', 'বাতিল'];
        const colLabels = ['মুমতাজ', 'জায়্যিদ জিদ্দান', 'জায়্যিদ', 'মাকবুল', 'রাসিব', 'অনুপস্থিত', 'স্থগিত', 'বাতিল'];

        const rows = groups.map(g => {
            const data = getStudentsAndSubjects(dept, g.key);
            const s = data ? data.summary : null;
            if (!s) return '';
            return `<tr>
                <td class="rp-td-name">${esc(g.label)}</td>
                <td>${bn(s.totalStudents)}</td>
                ${cols.map(c => `<td>${bn(s[c] || 0)}</td>`).join('')}
                <td>${bn(s.passRate)}%</td>
            </tr>`;
        }).join('');

        app.innerHTML = backBar('হোম') + `
        <h2 class="rp-panel-title">${esc(deptLabel(dept))} — এক নজরে ফলাফল</h2>
        <div class="rp-table-wrap">
            <table class="rp-table">
                <thead><tr><th>জামাত/গ্রুপ</th><th>মোট ছাত্র</th>${colLabels.map(c => `<th>${esc(c)}</th>`).join('')}<th>পাসের হার</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        document.getElementById('rpBack').addEventListener('click', renderGlanceDeptPicker);
    }

    // ---------------------- ৪. পাইচার্ট ----------------------

    function renderChartDeptPicker() {
        app.innerHTML = backBar('হোম') + `<h2 class="rp-panel-title">বিভাগ নির্বাচন করুন</h2>` + departmentPicker();
        attachBack();
        bindDeptPicker(dept => renderChartGroupPicker(dept));
    }

    function renderChartGroupPicker(dept) {
        const groups = groupsOf(dept);
        app.innerHTML = backBar(deptLabel(dept)) + `
        <h2 class="rp-panel-title">${esc(deptLabel(dept))} — জামাত/গ্রুপ নির্বাচন করুন</h2>
        <div class="rp-group-grid">
            <button class="rp-group-btn rp-group-btn-all" data-key="__all__">সম্মিলিত (সব ${esc(dept === 'kitab' ? 'জামাত' : 'গ্রুপ')})</button>
            ${groups.map(g => `<button class="rp-group-btn" data-key="${esc(g.key)}">${esc(g.label)}</button>`).join('')}
        </div>`;
        document.getElementById('rpBack').addEventListener('click', renderChartDeptPicker);
        app.querySelectorAll('.rp-group-btn').forEach(btn => {
            btn.addEventListener('click', () => renderChart(dept, btn.dataset.key));
        });
    }

    function renderChart(dept, groupKey) {
        let students, title;
        if (groupKey === '__all__') {
            if (dept === 'kitab') {
                students = [];
                CONSTANTS.KITAB_JAMAH_ORDER.forEach(j => { if (CALC.kitab[j]) students.push(...CALC.kitab[j].students); });
            } else if (dept === 'hifz') {
                students = CALC.hifz.students;
            } else {
                students = CALC.maktab.students;
            }
            title = `${deptLabel(dept)} — সম্মিলিত ফলাফল`;
        } else {
            const data = getStudentsAndSubjects(dept, groupKey);
            students = data ? data.students : [];
            title = `${deptLabel(dept)} — ${groupKey}`;
        }

        const summary = RankingEngine.summarize(students);
        const chartData = ChartEngine.summaryToChartData(summary);

        app.innerHTML = backBar(deptLabel(dept)) + `
        <h2 class="rp-panel-title">${esc(title)}</h2>
        <div class="rp-chart-wrap">
            <canvas id="rpChartCanvas" width="320" height="320"></canvas>
            <div id="rpChartLegend" class="rp-legend"></div>
        </div>`;
        document.getElementById('rpBack').addEventListener('click', () => renderChartGroupPicker(dept));

        const canvas = document.getElementById('rpChartCanvas');
        ChartEngine.renderPieChart(canvas, chartData, { passRate: summary.passRate });
        ChartEngine.renderLegend(document.getElementById('rpChartLegend'), chartData);
    }

    // ---------------------- Router ----------------------

    function go(view) {
        loadData().then(() => {
            if (view === 'search') renderSearch();
            else if (view === 'jamah') renderJamahDeptPicker();
            else if (view === 'glance') renderGlanceDeptPicker();
            else if (view === 'chart') renderChartDeptPicker();
            else renderHome();
        }).catch(() => { /* setStatus ইতিমধ্যে এরর দেখাচ্ছে */ });
    }

    // ---------------------- শুরু ----------------------

    renderHome();
    loadData().catch(() => { /* হোমপেইজেই এরর বার্তা থাকবে statusBox-এ */ });
})();
