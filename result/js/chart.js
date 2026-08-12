/**
 * chart.js
 * ------------------------------------------------------------
 * Pie Chart তৈরি করার দায়িত্ব এই Module-এর।
 * সফটওয়্যার সম্পূর্ণ Offline চলার শর্ত মেনে কোনো External Chart
 * Library (CDN) ব্যবহার না করে নিজস্ব হালকা Canvas-ভিত্তিক
 * Pie Chart তৈরি করা হয়েছে।
 * ------------------------------------------------------------
 */

const ChartEngine = (() => {

    const COLORS = ['#0f6e4f', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8d99ae', '#6a4c93', '#adb5bd'];

    /**
     * একটি Canvas Element-এর ভেতর Pie Chart আঁকে
     * data: [{label, value}], options: { passRate }
     */
    function renderPieChart(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(w, h) / 2 - 10;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        if (total === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('কোনো তথ্য পাওয়া যায়নি', cx, cy);
            return;
        }

        let startAngle = -Math.PI / 2;
        data.forEach((d, i) => {
            if (d.value <= 0) return;
            const sliceAngle = (d.value / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = COLORS[i % COLORS.length];
            ctx.fill();
            startAngle += sliceAngle;
        });

        // কেন্দ্রে সাদা বৃত্ত (Donut Style - সুন্দর দেখানোর জন্য)
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`মোট ছাত্র: ${Utils.toBanglaNumber(total)} জন`, cx, cy - 8);
        if (options.passRate !== undefined) {
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#0f6e4f';
            ctx.fillText(`পাসের হার: ${Utils.toBanglaNumber(options.passRate)}%`, cx, cy + 12);
        }
    }

    /**
     * Canvas-কে PNG আকারে Download করে
     */
    function downloadChartAsPng(canvas, filename = 'pie-chart.png') {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    /**
     * Chart-কে Print করার জন্য একটি Print Page HTML তৈরি করে (Canvas Image + Legend,
     * অর্থাৎ স্ক্রিনে যা দেখা যাচ্ছে হুবহু তাই প্রিন্ট হবে)
     */
    function buildChartPrintHTML(canvas, title, legendHtml) {
        const imgData = canvas.toDataURL('image/png');
        return `<div class="print-page" style="text-align:center;">
            <h3 class="jamah-title">${Utils.escapeHtml(title)}</h3>
            <img src="${imgData}" style="max-width:360px;" />
            <div class="chart-legend-print">${legendHtml || ''}</div>
        </div>`;
    }

    /**
     * Chart-এর নিচে Legend (রঙ + নাম + সংখ্যা) তৈরি করে
     */
    function renderLegend(container, data) {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        container.innerHTML = data.filter(d => d.value > 0).map((d, i) => {
            const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
            return `<div class="legend-item">
                <span class="legend-dot" style="background:${COLORS[data.indexOf(d) % COLORS.length]}"></span>
                <span class="legend-label">${Utils.escapeHtml(d.label)}</span>
                <span class="legend-value">${Utils.toBanglaNumber(d.value)} (${Utils.toBanglaNumber(percent)}%)</span>
            </div>`;
        }).join('');
    }

    /**
     * Summary Object থেকে Pie Chart Data Array তৈরি করে
     */
    function summaryToChartData(summary) {
        return [
            { label: CONSTANTS.GRADE.MUMTAZ, value: summary.মুমতাজ || 0 },
            { label: CONSTANTS.GRADE.JAYYID_JIDDAN, value: summary.জায়্যিদজিদ্দান || 0 },
            { label: CONSTANTS.GRADE.JAYYID, value: summary.জায়্যিদ || 0 },
            { label: CONSTANTS.GRADE.MAQBUL, value: summary.মাকবুল || 0 },
            { label: CONSTANTS.GRADE.RASIB, value: summary.রাসিব || 0 },
            { label: CONSTANTS.STATUS.ABSENT, value: summary.অনুপস্থিত || 0 },
            { label: CONSTANTS.STATUS.SUSPENDED, value: summary.স্থগিত || 0 },
            { label: CONSTANTS.STATUS.CANCELLED, value: summary.বাতিল || 0 }
        ];
    }

    return { renderPieChart, renderLegend, summaryToChartData, downloadChartAsPng, buildChartPrintHTML };
})();
