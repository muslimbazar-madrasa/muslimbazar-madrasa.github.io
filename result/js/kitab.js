/**
 * kitab.js
 * ------------------------------------------------------------
 * কিতাব বিভাগের সম্পূর্ণ Result Calculation Engine।
 * নিয়মাবলী পর্ব-৪.১ ও ৪.২ অনুযায়ী কঠোরভাবে অনুসরণ করা হয়েছে।
 * ------------------------------------------------------------
 */

const KitabEngine = (() => {

    /**
     * একটি Subject এই জামাতে "বিশেষ" (কুরআন/হাতের লেখা - মোট/গড়ে বাদ) কিনা যাচাই করে
     * রিটার্ন করে: { isSpecial: bool, passMark: number, type: 'quran'|'hater'|'normal' }
     *
     * *** নাম নয়, Position (কলাম-ক্রম) দিয়ে শনাক্ত করা হয় ***
     * কারণ: হেদায়াতুন নাহু/কাফিয়া/শরহে জামি/শরহে বেকায়া জামাতে "তরজমাতুল কুরআন" নামে
     * আরেকটি সম্পূর্ণ আলাদা মৌলিক Subject আছে, যার নামের মধ্যেও "কুরআন" শব্দ থাকায়
     * আগে নাম-ম্যাচিং (includes) করলে ভুলবশত সেটাও অমৌলিক (মোট/গড়ে বাদ) ধরে নিত।
     * তাছাড়া কুরআন কোথাও কোথাও "কুরআন-নাজেরা" নামেও লেখা থাকে - তাই নাম নির্ভরযোগ্য নয়।
     *
     * নিয়ম (Excel-এ কলাম-ক্রম অনুযায়ী, সবসময়):
     *  - সর্বশেষ (শেষ) Subject = হাতের লেখা - সব ১১ জামাতেই মোট মার্ক ৫০, পাস মার্ক ১৭,
     *    মোট/গড়/বিভাগ-নির্ধারণে সম্পূর্ণ বাদ (isSpecial:true) - শুধু ফেইল হলে ঘর কালো দেখাবে।
     *  - সর্বশেষের ঠিক আগের Subject = কুরআন:
     *      - এদাদিয়া ও তাইসিরে মোট/গড়ে যুক্ত হয় (isSpecial:false) - পাস মার্ক যথাক্রমে ৩৫ ও ৫০।
     *      - বাকি ৯ জামাতে (তাকমিল...মিযান) মোট/গড়ে বাদ (isSpecial:true) - পাস মার্ক ২৫।
     *        এদাদিয়া ছাড়া বাকি সব জামাতে কুরআনে রাসিব হলে সম্পূর্ণ ফলাফল রাসিব হয়ে যায়
     *        (দেখুন calculateStudent - quranFailed)।
     *  - বাকি সব Subject (তরজমাতুল কুরআনসহ) = normal, মোট/গড়ে স্বাভাবিকভাবে যুক্ত হবে।
     */
    function getSubjectRule(jamahName, subjectName, subjectIndex, totalSubjects) {
        const isLastSubject = subjectIndex === totalSubjects - 1;
        const isSecondLastSubject = subjectIndex === totalSubjects - 2;

        if (isLastSubject) {
            return { isSpecial: true, passMark: CONSTANTS.PASS_MARK_HATER_LEKHA, type: 'hater' };
        }
        if (isSecondLastSubject) {
            if (jamahName === 'এদাদিয়া') {
                return { isSpecial: false, passMark: CONSTANTS.PASS_MARK_QURAN_EDADIYA, type: 'quran' };
            }
            if (jamahName === 'তাইসির') {
                return { isSpecial: false, passMark: CONSTANTS.PASS_MARK_QURAN_TAISIR, type: 'quran' };
            }
            return { isSpecial: true, passMark: CONSTANTS.PASS_MARK_QURAN, type: 'quran' };
        }
        return { isSpecial: false, passMark: CONSTANTS.PASS_MARK_NORMAL, type: 'normal' };
    }

    /**
     * একজন ছাত্রের সব Subject-এর Status দেখে সঠিক বিভাগীয় অবস্থা নির্ধারণ করে।
     * নিয়ম:
     *  - যেকোনো এক Subject-এ "বাতিল" থাকলে সম্পূর্ণ ফলাফল বাতিল (সর্বোচ্চ অগ্রাধিকার)
     *  - সব Subject-এ অনুপস্থিত থাকলে ফলাফল অনুপস্থিত
     *  - এক বা একাধিক (কিন্তু সবগুলো নয়) Subject-এ অনুপস্থিত থাকলে অথবা কোথাও
     *    সরাসরি "স্থগিত" লেখা থাকলে ফলাফল স্থগিত
     */
    function detectStudentStatus(student, subjectHeaders) {
        const statuses = subjectHeaders.map(h => student.subjects[h] && student.subjects[h].status).filter(Boolean);
        if (statuses.includes('cancelled')) return 'cancelled';

        const absentCount = statuses.filter(s => s === 'absent').length;
        const totalSubjects = subjectHeaders.length;

        if (totalSubjects > 0 && absentCount === totalSubjects) return 'absent';
        if (absentCount > 0 || statuses.includes('suspended')) return 'suspended';
        return null;
    }

    /**
     * একজন ছাত্রের সম্পূর্ণ Result Calculate করে
     */
    function calculateStudent(student, jamahName, subjectHeaders) {
        const specialStatus = detectStudentStatus(student, subjectHeaders);

        const base = {
            ...student,
            jamah: jamahName,
            total: null,
            average: null,
            grade: null,
            merit: null,
            failSubjects: [],
            specialStatus
        };

        if (specialStatus) {
            base.grade = CONSTANTS.STATUS[specialStatus.toUpperCase()];
            return base;
        }

        let total = 0;
        let countableSubjects = 0;
        let failCount = 0;          // গ্রেড/বিভাগ নির্ধারণে ব্যবহৃত (হাতের লেখা বাদে)
        let quranFailed = false;    // এদাদিয়া ছাড়া বাকি সব জামাতে কুরআনে ফেইল করলে সরাসরি রাসিব
        const failSubjects = [];    // ডিসপ্লেতে ঘর কালো (fail-cell) দেখানোর জন্য - সব বিষয়ই ধরা হয় (হাতের লেখাসহ)

        subjectHeaders.forEach((subj, idx) => {
            const entry = student.subjects[subj];
            const rule = getSubjectRule(jamahName, subj, idx, subjectHeaders.length);
            const value = entry ? entry.value : null;

            if (value === null) return; // ইতিমধ্যে Validation Warning দেওয়া হয়েছে Import সময়ে

            const failed = value < rule.passMark;
            if (failed) failSubjects.push(subj); // ঘর কালো দেখানোর জন্য - হাতের লেখা ফেইল হলেও যোগ হবে

            if (rule.type === 'hater') {
                // হাতের লেখা: মোট/গড়/failCount কোনোকিছুতেই যোগ হবে না (শুধু উপরে ঘর কালো হওয়ার জন্য নেওয়া হয়েছে)
                return;
            }

            if (rule.type === 'quran' && failed) quranFailed = true;
            if (failed) failCount++;

            if (!rule.isSpecial) {
                total += value;
                countableSubjects++;
            }
        });

        const average = countableSubjects > 0 ? total / countableSubjects : 0;

        base.total = total;
        base.average = Number(average.toFixed(2));
        base.failSubjects = failSubjects;
        base.failCount = failCount;

        // এদাদিয়া ছাড়া বাকি সব জামাতে কুরআনে রাসিব হলে অন্য সব বিষয় নির্বিশেষে সরাসরি রাসিব
        base.grade = (quranFailed && jamahName !== 'এদাদিয়া')
            ? CONSTANTS.GRADE.RASIB
            : determineGrade(failCount, base.average);

        // "পরীক্ষার্থীর ধরণ" কলামে "অনিয়মিত" চিহ্নিত থাকলে - মার্ক/মোট/গড় স্বাভাবিকভাবে
        // হিসাব হওয়ার পরও বিভাগ কলামে "অনিয়মিত" দেখানো হয় (উপরের রাসিব/গ্রেড হিসাব override
        // করে) এবং RankingEngine.SPECIAL_GRADES-এ থাকায় মেধা তালিকা থেকে (জামাত-ভিত্তিক ও
        // সম্মিলিত উভয়) স্বয়ংক্রিয়ভাবে বাদ পড়ে যাবে
        if (student.irregular) {
            base.grade = CONSTANTS.STATUS.IRREGULAR;
        }

        return base;
    }

    /**
     * Grade নির্ধারণ (পর্ব ৪.১, ধারা ১০-১৪)
     */
    function determineGrade(failCount, average) {
        if (failCount === 0) {
            if (average >= 80) return CONSTANTS.GRADE.MUMTAZ;
            if (average >= 65) return CONSTANTS.GRADE.JAYYID_JIDDAN;
            if (average >= 50) return CONSTANTS.GRADE.JAYYID;
            if (average >= 35) return CONSTANTS.GRADE.MAQBUL;
            return CONSTANTS.GRADE.RASIB;
        }
        if (failCount <= 2) {
            return average >= 35 ? CONSTANTS.GRADE.MAQBUL : CONSTANTS.GRADE.RASIB;
        }
        return CONSTANTS.GRADE.RASIB;
    }

    /**
     * পুরো একটি জামাতের ফলাফল Calculate করে এবং Merit নির্ধারণ করে
     */
    function calculateJamah(jamahName, sheetData) {
        const { students, subjectHeaders } = sheetData;
        const calculated = students.map(s => calculateStudent(s, jamahName, subjectHeaders));
        RankingEngine.assignMerit(calculated, 'average');
        return { jamah: jamahName, subjectHeaders, students: calculated, summary: RankingEngine.summarize(calculated) };
    }

    /**
     * পুরো কিতাব বিভাগের (১১ জামাত) ফলাফল Calculate করে
     */
    function calculateAll(kitabData) {
        const result = {};
        CONSTANTS.KITAB_JAMAH_ORDER.forEach(jamah => {
            if (kitabData[jamah]) {
                result[jamah] = calculateJamah(jamah, kitabData[jamah]);
            }
        });
        return result;
    }

    /**
     * একটি নির্দিষ্ট মানের ভিত্তিতে একক Grade Tier নির্ধারণ (Subject-wise Report-এর জন্য)
     * এখানে failCount নেই - শুধু একটি Subject-এর নম্বরের উপর ভিত্তি করে Grade ধরা হয়
     */
    function determineSingleMarkGrade(value, passMark) {
        if (value < passMark) return CONSTANTS.GRADE.RASIB;
        if (value >= 80) return CONSTANTS.GRADE.MUMTAZ;
        if (value >= 65) return CONSTANTS.GRADE.JAYYID_JIDDAN;
        if (value >= 50) return CONSTANTS.GRADE.JAYYID;
        return CONSTANTS.GRADE.MAQBUL;
    }

    /**
     * "কিতাব পরিপ্রেক্ষিত ফলাফল" - একটি নির্দিষ্ট জামাতের একটি নির্দিষ্ট Subject-এর
     * সকল ছাত্রের ফলাফল একত্র করে সারাংশ তৈরি করে
     */
    function calculateSubjectWise(jamahName, subjectName, sheetData) {
        const subjectIndex = sheetData.subjectHeaders ? sheetData.subjectHeaders.indexOf(subjectName) : -1;
        const totalSubjects = sheetData.subjectHeaders ? sheetData.subjectHeaders.length : 0;
        const rule = getSubjectRule(jamahName, subjectName, subjectIndex, totalSubjects);
        const summary = {
            jamah: jamahName, subject: subjectName,
            code: (sheetData.subjectCodes && sheetData.subjectCodes[subjectName]) || '',
            totalStudents: sheetData.students.length,
            totalMarks: 0, participantCount: 0, average: 0,
            মুমতাজ: 0, জায়্যিদজিদ্দান: 0, জায়্যিদ: 0, মাকবুল: 0, রাসিব: 0,
            অনুপস্থিত: 0, স্থগিত: 0, বাতিল: 0, pass: 0
        };

        sheetData.students.forEach(student => {
            const entry = student.subjects[subjectName];
            if (!entry) return;
            if (entry.status === 'cancelled') { summary.বাতিল++; return; }
            if (entry.status === 'suspended') { summary.স্থগিত++; return; }
            if (entry.status === 'absent') { summary.অনুপস্থিত++; return; }
            if (entry.value === null) return; // Blank/Invalid - গণনায় ধরা হবে না

            summary.totalMarks += entry.value;
            summary.participantCount++;

            const grade = determineSingleMarkGrade(entry.value, rule.passMark);
            switch (grade) {
                case CONSTANTS.GRADE.MUMTAZ: summary.মুমতাজ++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID_JIDDAN: summary.জায়্যিদজিদ্দান++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID: summary.জায়্যিদ++; summary.pass++; break;
                case CONSTANTS.GRADE.MAQBUL: summary.মাকবুল++; summary.pass++; break;
                case CONSTANTS.GRADE.RASIB: summary.রাসিব++; break;
            }
        });

        summary.average = summary.participantCount > 0
            ? Number((summary.totalMarks / summary.participantCount).toFixed(2)) : 0;

        const validResults = summary.totalStudents - summary.স্থগিত - summary.অনুপস্থিত;
        summary.validResults = validResults;
        summary.passRate = validResults > 0 ? ((summary.pass / validResults) * 100).toFixed(2) : '0.00';

        return summary;
    }

    /**
     * পুরো কিতাব বিভাগের সব জামাত-Subject সমন্বয়ে সম্পূর্ণ Subject-wise Report তৈরি করে
     */
    function calculateAllSubjectWise(kitabSheets) {
        const rows = [];
        CONSTANTS.KITAB_JAMAH_ORDER.forEach(jamah => {
            const sheetData = kitabSheets[jamah];
            if (!sheetData) return;
            sheetData.subjectHeaders.forEach(subject => {
                rows.push(calculateSubjectWise(jamah, subject, sheetData));
            });
        });
        return rows;
    }

    return {
        calculateStudent, calculateJamah, calculateAll, getSubjectRule, determineGrade,
        calculateSubjectWise, calculateAllSubjectWise, determineSingleMarkGrade
    };
})();
