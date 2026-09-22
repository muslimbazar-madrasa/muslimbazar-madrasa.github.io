// ---------- Bengali digit + name helpers ----------
const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
function toBn(num){
  return String(num).split('').map(ch => /[0-9]/.test(ch) ? bnDigits[+ch] : ch).join('');
}

const bnMonthNames = ["বৈশাখ","জ্যৈষ্ঠ","আষাঢ়","শ্রাবণ","ভাদ্র","আশ্বিন","কার্তিক","অগ্রহায়ণ","পৌষ","মাঘ","ফাল্গুন","চৈত্র"];
const hijriMonthNames = ["মহররম","সফর","রবিউল আউয়াল","রবিউস সানি","জমাদিউল আউয়াল","জমাদিউস সানি","রজব","শা'বান","রমজান","শাওয়াল","জিলক্বদ","জিলহজ্জ"];
const weekdayNamesBn = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];
const weekdayFullBn = ["রবিবার","সোমবার","মঙ্গলবার","বুধবার","বৃহস্পতিবার","শুক্রবার","শনিবার"];
const gregMonthNamesBn = ["জানুয়ারী","ফেব্রুয়ারী","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];

// ---------- Category system ----------
// Priority: lower index = higher priority when a day has more than one category.
const CATEGORY_ORDER = ['holiday', 'exam', 'exam_prep', 'special'];
const CATEGORY_META = {
  holiday:   { label: 'ছুটি',              bg: '#ffd9cf', accent: '#d9522f', text: '#7a2c14' },
  exam:      { label: 'পরীক্ষা চলাকালীন',    bg: '#ffe7b3', accent: '#c98a1b', text: '#6b4a00' },
  exam_prep: { label: 'পরীক্ষার প্রস্তুতি',   bg: '#e6dbf5', accent: '#6c4f8c', text: '#402d5c' },
  special:   { label: 'বিশেষ দিন',           bg: '#cdeef0', accent: '#1f7a8c', text: '#0c4650' }
};

let dateData = {};   // key: 'YYYY-MM-DD' -> {weekday,bn_day,bn_month,bn_year,hijri_day,hijri_month,hijri_year}
let eventData = {};  // key: 'YYYY-MM-DD' -> [{category,title,description,rangeStart,rangeEnd}]
let eventRanges = []; // raw ranges, for listing purposes

let viewYear, viewMonth; // viewMonth: 0-11
const today = new Date();
const todayKey = fmtKey(today.getFullYear(), today.getMonth()+1, today.getDate());

function fmtKey(y,m,d){
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function loadCSV(path){
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download:true,
      header:true,
      skipEmptyLines:true,
      complete: r => resolve(r.data),
      error: err => reject(err)
    });
  });
}

function topCategory(list){
  // returns the highest-priority category present in the list of event entries for a day
  for(const cat of CATEGORY_ORDER){
    if(list.some(e => e.category === cat)) return cat;
  }
  return list[0] ? list[0].category : null;
}

async function init(){
  // আজকের তারিখের লাইন সবসময় দেখাবে, CSV লোড হোক বা না হোক
  document.getElementById('todayLine').textContent =
    `আজ ${toBn(today.getDate())} ${gregMonthNamesBn[today.getMonth()]} ${toBn(today.getFullYear())} ইংরেজি, রোজ - ${weekdayFullBn[today.getDay()]}`;

  viewYear = today.getFullYear();
  viewMonth = today.getMonth();

  try{
    const [dates, events] = await Promise.all([
      loadCSV('dates.csv?v=' + Date.now()),
      loadCSV('events.csv?v=' + Date.now())
    ]);

    dates.forEach(row => { if(row.date) dateData[row.date] = row; });

    events.forEach(row => {
      if(!row.start_date) return;
      const start = row.start_date;
      const end = row.end_date && row.end_date.trim() ? row.end_date : row.start_date;
      const cat = (row.category || 'special').trim();
      const catKey = CATEGORY_META[cat] ? cat : 'special';

      eventRanges.push({category: catKey, start, end, title: row.title || '', description: row.description || ''});

      let cur = new Date(start + 'T00:00:00');
      const last = new Date(end + 'T00:00:00');
      while(cur <= last){
        const k = fmtKey(cur.getFullYear(), cur.getMonth()+1, cur.getDate());
        if(!eventData[k]) eventData[k] = [];
        eventData[k].push({category: catKey, title: row.title || '', description: row.description || '', rangeStart: start, rangeEnd: end});
        cur.setDate(cur.getDate()+1);
      }
    });
  }catch(e){
    // CSV লোড না হলেও ক্যালেন্ডার চলবে, শুধু কনসোলে লগ থাকবে — ইউজারকে বিরক্তিকর মেসেজ দেখানো হবে না
    console.error('dates.csv / events.csv লোড করতে সমস্যা হয়েছে:', e);
  }

  renderLegend();
  renderMonth();
}

function renderLegend(){
  const el = document.getElementById('legend');
  if(!el) return;
  el.innerHTML = CATEGORY_ORDER.map(cat => {
    const m = CATEGORY_META[cat];
    return `<span class="legend-chip"><span class="legend-dot" style="background:${m.accent}"></span>${m.label}</span>`;
  }).join('');
}

function renderMonth(){
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  weekdayNamesBn.forEach((w,i) => {
    const h = document.createElement('div');
    h.className = 'wk-head' + (i===5?' fri':'') + (i===6?' sat':'');
    h.textContent = w;
    grid.appendChild(h);
  });

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  for(let i=0;i<startDow;i++){
    const c = document.createElement('div');
    c.className = 'day-cell empty';
    grid.appendChild(c);
  }

  let firstRow=null, lastRow=null;

  for(let d=1; d<=daysInMonth; d++){
    const key = fmtKey(viewYear, viewMonth+1, d);
    const row = dateData[key];
    if(row){ if(!firstRow) firstRow=row; lastRow=row; }
    const dow = new Date(viewYear, viewMonth, d).getDay();
    const dayEvents = eventData[key];

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if(dow===5 || dow===6) cell.classList.add('weekend');
    if(key === todayKey) cell.classList.add('today');
    cell.dataset.key = key;

    if(dayEvents && dayEvents.length){
      const cat = topCategory(dayEvents);
      const meta = CATEGORY_META[cat];
      cell.style.backgroundColor = meta.bg;
      cell.style.borderBottom = `4px solid ${meta.accent}`;
      cell.classList.add('has-event');
    }

    const en = document.createElement('div');
    en.className = 'en-day';
    en.textContent = toBn(d);
    cell.appendChild(en);

    if(row){
      const sub = document.createElement('div');
      sub.className = 'sub-row';
      sub.innerHTML = `<span class="sub-bn">${toBn(row.bn_day)}</span><span class="sub-hijri">${toBn(row.hijri_day)}</span>`;
      cell.appendChild(sub);
    }

    cell.addEventListener('click', () => openDayModal(key));
    grid.appendChild(cell);
  }

  document.getElementById('monthTitle').textContent = `${gregMonthNamesBn[viewMonth]} ${toBn(viewYear)}`;

  // সারি শেষে ফাঁকা ঘর যোগ করে গ্রিড সবসময় পূর্ণ ৭-কলাম রাখা (নাহলে শেষ সারিতে খালি সবুজ ফাঁকা দেখায়)
  const totalCells = startDow + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<trailing;i++){
    const c = document.createElement('div');
    c.className = 'day-cell empty';
    grid.appendChild(c);
  }

  if(firstRow && lastRow){
    document.getElementById('bnStrip').style.display = '';
    document.getElementById('hijriStrip').style.display = '';
    document.getElementById('bnStrip').textContent = bnStripText(firstRow, lastRow);
    document.getElementById('hijriStrip').textContent = hijriStripText(firstRow, lastRow);
  } else {
    // dates.csv-তে এই মাসের ডেটা না থাকলে স্ট্রিপ দুটো শুধু লুকিয়ে রাখা হবে, বিরক্তিকর টেক্সট দেখানো হবে না
    document.getElementById('bnStrip').style.display = 'none';
    document.getElementById('hijriStrip').style.display = 'none';
  }

  renderEventsList();
}

function bnStripText(first, last){
  const m1 = +first.bn_month-1, m2 = +last.bn_month-1;
  const y = first.bn_year === last.bn_year ? toBn(first.bn_year) : `${toBn(first.bn_year)}/${toBn(last.bn_year)}`;
  const months = m1===m2 ? bnMonthNames[m1] : `${bnMonthNames[m1]} -- ${bnMonthNames[m2]}`;
  return `${months} ${y} বাংলা`;
}
function hijriStripText(first, last){
  const m1 = +first.hijri_month-1, m2 = +last.hijri_month-1;
  const y = first.hijri_year === last.hijri_year ? toBn(first.hijri_year) : `${toBn(first.hijri_year)}/${toBn(last.hijri_year)}`;
  const months = m1===m2 ? hijriMonthNames[m1] : `${hijriMonthNames[m1]} -- ${hijriMonthNames[m2]}`;
  return `${months} ${y} হিজরি`;
}

function fmtDateBn(iso){
  const d = new Date(iso + 'T00:00:00');
  return `${toBn(d.getDate())} ${gregMonthNamesBn[d.getMonth()]}`;
}

// Formats a date range the way the reference calendar does:
// single day  -> "১৭ মার্চ - মঙ্গলবার"
// same-month range -> "১৯, ২০, ২১, ২২, ২৩ ও ২৪ মার্চ - বৃহঃবার থেকে মঙ্গলবার"
// cross-month range -> "১৯ মার্চ (বৃহঃবার) থেকে ২ এপ্রিল (বৃহঃবার)"
function formatDateRangeBn(startISO, endISO){
  const start = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');

  if(startISO === endISO){
    return `${toBn(start.getDate())} ${gregMonthNamesBn[start.getMonth()]} - ${weekdayFullBn[start.getDay()]}`;
  }

  if(start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()){
    const days = [];
    let cur = new Date(start);
    while(cur <= end){ days.push(cur.getDate()); cur.setDate(cur.getDate() + 1); }
    const bnDays = days.map(toBn);
    const daysStr = bnDays.length === 1
      ? bnDays[0]
      : bnDays.slice(0, -1).join(', ') + ' ও ' + bnDays[bnDays.length - 1];
    return `${daysStr} ${gregMonthNamesBn[start.getMonth()]} - ${weekdayFullBn[start.getDay()]} থেকে ${weekdayFullBn[end.getDay()]}`;
  }

  return `${toBn(start.getDate())} ${gregMonthNamesBn[start.getMonth()]} (${weekdayFullBn[start.getDay()]}) থেকে ${toBn(end.getDate())} ${gregMonthNamesBn[end.getMonth()]} (${weekdayFullBn[end.getDay()]})`;
}

function renderEventsList(){
  const list = document.getElementById('eventsList');
  list.innerHTML = '';

  const monthPrefix = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}`;
  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth+1, 0);

  const relevant = eventRanges.filter(r => {
    const rs = new Date(r.start + 'T00:00:00');
    const re = new Date(r.end + 'T00:00:00');
    return rs <= monthEnd && re >= monthStart;
  }).sort((a,b) => a.start.localeCompare(b.start));

  if(relevant.length===0){
    list.innerHTML = '<div class="no-events">এই মাসে কোনো বিশেষ দিন/ছুটি/পরীক্ষা যোগ করা হয়নি।</div>';
    return;
  }

  relevant.forEach(r => {
    const meta = CATEGORY_META[r.category];
    const item = document.createElement('div');
    item.className = 'event-item';
    item.style.borderLeftColor = meta.accent;
    const dateLabel = formatDateRangeBn(r.start, r.end);
    item.innerHTML = `
      <span class="ev-cat" style="background:${meta.bg};color:${meta.text}">${meta.label}</span>
      <div class="ev-date">${dateLabel}</div>
      <div class="ev-title">${r.title}${r.description ? ' — '+r.description : ''}</div>`;
    list.appendChild(item);
  });
}

function openDayModal(key){
  const row = dateData[key];
  const d = new Date(key + 'T00:00:00');
  const body = document.getElementById('modalBody');
  let html = `<div class="modal-body-title">${toBn(d.getDate())} ${gregMonthNamesBn[d.getMonth()]} ${toBn(d.getFullYear())}</div>`;
  html += `<div class="modal-row"><b>বার:</b> ${weekdayFullBn[d.getDay()]}</div>`;
  if(row){
    html += `<div class="modal-row"><b>বাংলা:</b> ${toBn(row.bn_day)} ${bnMonthNames[+row.bn_month-1]} ${toBn(row.bn_year)}</div>`;
    html += `<div class="modal-row"><b>হিজরি:</b> ${toBn(row.hijri_day)} ${hijriMonthNames[+row.hijri_month-1]} ${toBn(row.hijri_year)}</div>`;
  }
  const dayEvents = eventData[key];
  if(dayEvents && dayEvents.length){
    html += `<div class="modal-events">`;
    dayEvents.forEach(ev => {
      const meta = CATEGORY_META[ev.category];
      const rangeLine = ev.rangeStart !== ev.rangeEnd
        ? `<div class="ev-date">${formatDateRangeBn(ev.rangeStart, ev.rangeEnd)}</div>` : '';
      html += `<div class="modal-event-row">
        <span class="ev-cat" style="background:${meta.bg};color:${meta.text}">${meta.label}</span>
        ${rangeLine}
        <div class="ev-title">${ev.title}${ev.description ? ' — '+ev.description : ''}</div>
      </div>`;
    });
    html += `</div>`;
  }
  body.innerHTML = html;
  document.getElementById('dayModal').classList.remove('hidden');
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('dayModal').classList.add('hidden');
});
document.getElementById('dayModal').addEventListener('click', e => {
  if(e.target.id === 'dayModal') e.target.classList.add('hidden');
});

document.getElementById('prevBtn').addEventListener('click', () => {
  viewMonth--; if(viewMonth<0){viewMonth=11; viewYear--;}
  renderMonth();
});
document.getElementById('nextBtn').addEventListener('click', () => {
  viewMonth++; if(viewMonth>11){viewMonth=0; viewYear++;}
  renderMonth();
});
document.getElementById('todayBtn').addEventListener('click', () => {
  viewYear = today.getFullYear(); viewMonth = today.getMonth();
  renderMonth();
});

init();
