// "পরিচিতি" বাটনে ক্লিক করলে সংশ্লিষ্ট কার্ডের বিস্তারিত তথ্য দেখা/লুকানো হবে
function toggleInfo(button) {
    const card = button.closest('.card');
    const details = card.querySelector('.details-text');
    details.classList.toggle('show');

    // বাটনের লেখার তীরচিহ্ন বদলে দেখানো হবে খোলা/বন্ধ অবস্থা
    if (details.classList.contains('show')) {
        button.innerHTML = 'পরিচিতি ▴';
    } else {
        button.innerHTML = 'পরিচিতি ▾';
    }
}
