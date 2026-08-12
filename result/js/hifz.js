/**
 * hifz.js
 * ------------------------------------------------------------
 * হিফজ বিভাগের সম্পূর্ণ Result Calculation Engine।
 * পর্ব-৫ অনুযায়ী কিতাব বিভাগের নিয়ম থেকে সম্পূর্ণ আলাদা।
 * ------------------------------------------------------------
 */

const HifzEngine = (() => {

    /**
     * ছাত্রের বিশেষ অবস্থা (বাতিল/স্থগিত/অনুপস্থিত) নির্ধারণ করে
     */
    /**
     * নিয়ম: যেকোনো এক Subject-এ বাতিল থাকলে সম্পূর্ণ বাতিল; সব Subject-এ
     * অনুপস্থিত থাকলে অনুপস্থিত; কিছু Subject-এ অনুপস্থিত (বা সরাসরি স্থগিত) থাকলে স্থগিত
     */
    function detectStudentStatus(student) {
        const statuses = CONSTANTS.HIFZ_SUBJECTS.map(h => student.subjects[h] && student.subjects[h].status).filter(Boolean);
        if (statuses.includes('cancelled')) return 'cancelled';

        const absentCount = statuses.filter(s => s === 'absent').length;
        const totalSubjects = CONSTANTS.HIFZ_SUBJECTS.length;

        if (totalSubjects > 0 && absentCount === totalSubjects) return 'absent';
        if (absentCount > 0 || statuses.includes('suspended')) return 'suspended';
        return null;
    }

    /**
     * হিফজ Grade নির্ধারণ (পর্ব-৫, ধারা ১০)
     * কুরআন নম্বর এবং মোট নম্বর উভয় শর্ত একসাথে পূরণ করতে হবে
     */
    function determineGrade(quranMark, total) {
        if (quranMark >= 80 && total >= 160) return CONSTANTS.GRADE.MUMTAZ;
        if (quranMark >= 70 && total >= 140) return CONSTANTS.GRADE.JAYYID_JIDDAN;
        if (quranMark >= 60 && total >= 120) return CONSTANTS.GRADE.JAYYID;
        if (quranMark >= 50 && total >= 100) return CONSTANTS.GRADE.MAQBUL;
        return CONSTANTS.GRADE.RASIB;
    }

    function calculateStudent(student) {
        const specialStatus = detectStudentStatus(student);
        const base = { ...student, total: null, grade: null, merit: null, specialStatus };

        if (specialStatus) {
            base.grade = CONSTANTS.STATUS[specialStatus.toUpperCase()];
            return base;
        }

        const quranMarkRaw = student.subjects['কুরআন'] && student.subjects['কুরআন'].value !== null
            ? student.subjects['কুরআন'].value : 0;
        const tajbidMarkRaw = student.subjects['তাজবিদ'] && student.subjects['তাজবিদ'].value !== null
            ? student.subjects['তাজবিদ'].value : 0;
        const masailMarkRaw = student.subjects['মাসাইল'] && student.subjects['মাসাইল'].value !== null
            ? student.subjects['মাসাইল'].value : 0;

        // কুরআন, তাজবিদ, মাসাইল ও মোট-এ কোনো ভগ্নাংশ দেখানো হবে না (নিকটতম পূর্ণ সংখ্যায় রাউন্ড)
        const quranMark = Math.round(quranMarkRaw);
        const tajbidMark = Math.round(tajbidMarkRaw);
        const masailMark = Math.round(masailMarkRaw);

        const total = quranMark + tajbidMark + masailMark;

        // Print/Display Layer যেন সবসময় রাউন্ড করা মান দেখায়, তাই subjects Object-ও আপডেট করা হলো
        base.subjects = {
            ...student.subjects,
            'কুরআন': { ...student.subjects['কুরআন'], value: quranMark },
            'তাজবিদ': { ...student.subjects['তাজবিদ'], value: tajbidMark },
            'মাসাইল': { ...student.subjects['মাসাইল'], value: masailMark }
        };

        base.total = total;
        base.quranMark = quranMark;
        base.grade = determineGrade(quranMark, total);

        return base;
    }

    /**
     * সম্পূর্ণ হিফজ Sheet Calculate করে এবং Merit বসায় (মোট নম্বর ভিত্তিক)।
     * কিতাব বিভাগের প্রতিটি জামাতের মতো, এখানে প্রতিটি পরীক্ষার গ্রুপ (১০/২০/৩০ পারা/খতম)
     * নিজস্ব আলাদা মেধাক্রম (১ম/২য়/৩য়...) পাবে - সব গ্রুপ মিলিয়ে একত্রে নয়।
     */
    function calculateAll(hifzSheetData) {
        const students = hifzSheetData.students.map(calculateStudent);

        const examGroups = [...new Set(students.map(s => s.examGroup))];
        examGroups.forEach(eg => {
            const groupStudents = students.filter(s => s.examGroup === eg);
            RankingEngine.assignMeritByGrade(groupStudents, 'total');
        });

        return { students, summary: RankingEngine.summarize(students) };
    }

    // Excel-এ কখনো "গ্রুপ নং" বাংলা অংকে (১,২,৩) আবার কখনো ইংরেজি সংখ্যা/Numeric Cell (1,2,3)
    // হিসেবে সেভ থাকে (Cell Format ভিন্ন হলে Excel নিজে থেকেই টাইপ পাল্টে ফেলে)। তাই সরাসরি
    // === দিয়ে তুলনা করলে "১" বনাম 1 মিলবে না। এই ফাংশন উভয়কেই ইংরেজি-অংকের Trim করা
    // String-এ রূপান্তর করে তুলনাযোগ্য করে তোলে।
    const BENGALI_TO_ENGLISH_DIGITS = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    function normalizeGroupValue(v) {
        if (v === null || v === undefined) return '';
        return String(v).trim().replace(/[০-৯]/g, d => BENGALI_TO_ENGLISH_DIGITS[d]);
    }

    /**
     * Group নং অনুযায়ী ফিল্টার
     */
    function filterByGroup(students, groupNo) {
        const target = normalizeGroupValue(groupNo);
        return students.filter(s => normalizeGroupValue(s.group) === target);
    }

    /**
     * পরীক্ষার Group (১০/২০/৩০ পারা/খতম) অনুযায়ী ফিল্টার
     */
    function filterByExamGroup(students, examGroup) {
        return students.filter(s => s.examGroup === examGroup);
    }

    return { calculateStudent, calculateAll, determineGrade, filterByGroup, filterByExamGroup };
})();
