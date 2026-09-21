// ---------- Bengali digit + name helpers ----------
const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
function toBn(num){
  return String(num).split('').map(ch => /[0-9]/.test(ch) ? bnDigits[+ch] : ch).join('');
}

const bnMonthNames = ["বৈশাখ","জ্যৈষ্ঠ","আষাঢ়","শ্রাবণ","ভাদ্র","আশ্বিন","কার্তিক","অগ্রহায়ণ","পৌষ","মাঘ","ফাল্গুন","চৈত্র"];
const hijriMonthNames = ["মহররম","সফর","রবিউল আউয়াল","রবিউস সানি","জমাদিউল আউয়াল","জমাদিউস সানি","রজব","শা'বান","রমজান","শাওয়াল","জিলক্বদ","জিলহজ্জ"];
const weekdayNamesBn = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];
const gregMonthNamesBn = ["জানুয়ারী","ফেব্রুয়ারী","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];

// JS Date.getDay(): 0=Sun...6=Sat -> matches weekdayNamesBn order directly.

let dateData = {};   // key: 'YYYY-MM-DD' -> {weekday,bn_day,bn_month,bn_year,hijri_day,hijri_month,hijri_year}
let eventData = {};  // key: 'YYYY-MM-DD' -> [{title,description}]

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

async function init(){
  try{
    const [dates, events] = await Promise.all([
      loadCSV('dates.csv?v=' + Date.now()),
      loadCSV('events.csv?v=' + Date.now())
    ]);

    dates.forEach(row => { dateData[row.date] = row; });
    events.forEach(row => {
      if(!row.date) return;
      if(!eventData[row.date]) eventData[row.date] = [];
      eventData[row.date].push({title: row.title || '', description: row.description || ''});
    });

    document.getElementById('todayLine').textContent =
      `আজ ${toBn(today.getDate())} ${gregMonthNamesBn[today.getMonth()]} ${toBn(today.getFullYear())} ইংরেজি, রোজ - ${['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'][today.getDay()]}`;

    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    renderMonth();
  }catch(e){
    document.getElementById('todayLine').textContent = 'ডেটা লোড করতে সমস্যা হয়েছে। dates.csv / events.csv ঠিক আছে কিনা দেখুন।';
    console.error(e);
  }
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

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if(dow===5 || dow===6) cell.classList.add('weekend');
    if(key === todayKey) cell.classList.add('today');
    if(eventData[key]) cell.classList.add('has-event');
    cell.dataset.key = key;

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

  if(firstRow && lastRow){
    document.getElementById('bnStrip').textContent = bnStripText(firstRow, lastRow);
    document.getElementById('hijriStrip').textContent = hijriStripText(firstRow, lastRow);
  } else {
    document.getElementById('bnStrip').textContent = 'তথ্য পাওয়া যায়নি (dates.csv-তে এই মাসের ডেটা নেই)';
    document.getElementById('hijriStrip').textContent = '';
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

function renderEventsList(){
  const list = document.getElementById('eventsList');
  list.innerHTML = '';
  const keys = Object.keys(eventData)
    .filter(k => k.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`))
    .sort();
  if(keys.length===0){
    list.innerHTML = '<div class="no-events">এই মাসে কোনো বিশেষ দিন যোগ করা হয়নি।</div>';
    return;
  }
  keys.forEach(k => {
    eventData[k].forEach(ev => {
      const d = new Date(k);
      const item = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML = `<div class="ev-date">${toBn(d.getDate())} ${gregMonthNamesBn[d.getMonth()]} - ${['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'][d.getDay()]}</div>
      <div class="ev-title">${ev.title}${ev.description ? ' — '+ev.description : ''}</div>`;
      list.appendChild(item);
    });
  });
}

function openDayModal(key){
  const row = dateData[key];
  const d = new Date(key);
  const body = document.getElementById('modalBody');
  let html = `<div class="modal-body-title">${toBn(d.getDate())} ${gregMonthNamesBn[d.getMonth()]} ${toBn(d.getFullYear())}</div>`;
  html += `<div class="modal-row"><b>বার:</b> ${['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'][d.getDay()]}</div>`;
  if(row){
    html += `<div class="modal-row"><b>বাংলা:</b> ${toBn(row.bn_day)} ${bnMonthNames[+row.bn_month-1]} ${toBn(row.bn_year)}</div>`;
    html += `<div class="modal-row"><b>হিজরি:</b> ${toBn(row.hijri_day)} ${hijriMonthNames[+row.hijri_month-1]} ${toBn(row.hijri_year)}</div>`;
  }
  if(eventData[key]){
    html += `<div class="modal-events">`;
    eventData[key].forEach(ev => {
      html += `<div class="ev-title">🔸 ${ev.title}${ev.description ? ' — '+ev.description : ''}</div>`;
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
