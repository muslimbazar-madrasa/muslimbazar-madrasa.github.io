/**
 * maktab.js
 * ------------------------------------------------------------
 * মকতব বিভাগের সম্পূর্ণ Result Calculation Engine।
 * পর্ব-৬ অনুযায়ী - সকল Subject-এর Pass Mark সমান (৩৫), কোনো
 * কুরআন বিশেষ ব্যতিক্রম নেই।
 * ------------------------------------------------------------
 */

const MaktabEngine = (() => {

    /**
     * নিয়ম: যেকোনো এক Subject-এ বাতিল থাকলে সম্পূর্ণ বাতিল; সব Subject-এ
     * অনুপস্থিত থাকলে অনুপস্থিত; কিছু Subject-এ অনুপস্থিত (বা সরাসরি স্থগিত) থাকলে স্থগিত
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
     * Grade নির্ধারণ - কিতাব বিভাগের অনুরূপ নিয়ম (পর্ব-৬, ধারা ১০)
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

    function calculateStudent(student, subjectHeaders) {
        const specialStatus = detectStudentStatus(student, subjectHeaders);
        const base = { ...student, total: null, average: null, grade: null, merit: null, failSubjects: [], specialStatus };

        if (specialStatus) {
            base.grade = CONSTANTS.STATUS[specialStatus.toUpperCase()];
            return base;
        }

        let total = 0;
        let countable = 0;
        let failCount = 0;
        const failSubjects = [];

        subjectHeaders.forEach(subj => {
            const entry = student.subjects[subj];
            const value = entry ? entry.value : null;
            if (value === null) return;
            if (value < CONSTANTS.PASS_MARK_MAKTAB) {
                failCount++;
                failSubjects.push(subj);
            }
            total += value;
            countable++;
        });

        const average = countable > 0 ? total / countable : 0;

        base.total = total;
        base.average = Number(average.toFixed(2));
        base.failSubjects = failSubjects;
        base.failCount = failCount;
        base.grade = determineGrade(failCount, base.average);

        return base;
    }

    /**
     * কিতাব বিভাগের প্রতিটি জামাতের মতো, মকতব বিভাগেও প্রতিটি প্রধান গ্রুপ
     * (নাজেরা/আম্মাপারা/বোর্ড) নিজস্ব আলাদা মেধাক্রম (১ম/২য়/৩য়...) পাবে।
     */
    function calculateAll(maktabSheetData) {
        const { students, subjectHeaders } = maktabSheetData;
        const calculated = students.map(s => calculateStudent(s, subjectHeaders));

        Object.keys(CONSTANTS.MAKTAB_GROUPS).forEach(mainGroup => {
            const subGroups = CONSTANTS.MAKTAB_GROUPS[mainGroup];
            const groupStudents = calculated.filter(s => subGroups.includes(s.group));
            RankingEngine.assignMerit(groupStudents, 'average');
        });

        return { subjectHeaders, students: calculated, summary: RankingEngine.summarize(calculated) };
    }

    /**
     * শ্রেণি অনুযায়ী ফিল্টার
     */
    function filterByClass(students, className) {
        return students.filter(s => s.class === className);
    }

    /**
     * সাব-গ্রুপ (যেমন: নাজেরা ক) অনুযায়ী ফিল্টার
     */
    function filterBySubGroup(students, subGroup) {
        return students.filter(s => s.group === subGroup);
    }

    /**
     * প্রধান গ্রুপ (নাজেরা/আম্মাপারা/বোর্ড) অনুযায়ী ফিল্টার - সাব-গ্রুপ মিলিয়ে
     */
    function filterByMainGroup(students, mainGroup) {
        const subGroups = CONSTANTS.MAKTAB_GROUPS[mainGroup] || [];
        return students.filter(s => subGroups.includes(s.group) || s.group === mainGroup);
    }

    /**
     * "কিতাব পরিপ্রেক্ষিত ফলাফল"-এর মকতব সংস্করণ - প্রতিটি সাব-গ্রুপ (যেমন নাজেরা ক)
     * এর প্রতিটি Subject-এর সম্মিলিত ফলাফল আলাদাভাবে গণনা করে
     */
    function calculateSubjectWiseForSubGroup(subGroup, subjectName, allStudents) {
        const groupStudents = filterBySubGroup(allStudents, subGroup);
        const summary = {
            jamah: subGroup, subject: subjectName,
            totalStudents: groupStudents.length,
            totalMarks: 0, participantCount: 0, average: 0,
            মুমতাজ: 0, জায়্যিদজিদ্দান: 0, জায়্যিদ: 0, মাকবুল: 0, রাসিব: 0,
            অনুপস্থিত: 0, স্থগিত: 0, বাতিল: 0, pass: 0
        };

        groupStudents.forEach(student => {
            const entry = student.subjects[subjectName];
            if (!entry) return;
            if (entry.status === 'cancelled') { summary.বাতিল++; return; }
            if (entry.status === 'suspended') { summary.স্থগিত++; return; }
            if (entry.status === 'absent') { summary.অনুপস্থিত++; return; }
            if (entry.value === null) return;

            summary.totalMarks += entry.value;
            summary.participantCount++;

            const grade = KitabEngine.determineSingleMarkGrade
                ? KitabEngine.determineSingleMarkGrade(entry.value, CONSTANTS.PASS_MARK_MAKTAB)
                : (entry.value < CONSTANTS.PASS_MARK_MAKTAB ? CONSTANTS.GRADE.RASIB
                    : entry.value >= 80 ? CONSTANTS.GRADE.MUMTAZ
                    : entry.value >= 65 ? CONSTANTS.GRADE.JAYYID_JIDDAN
                    : entry.value >= 50 ? CONSTANTS.GRADE.JAYYID : CONSTANTS.GRADE.MAQBUL);

            switch (grade) {
                case CONSTANTS.GRADE.MUMTAZ: summary.মুমতাজ++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID_JIDDAN: summary.জায়্যিদজিদ্দান++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID: summary.জায়্যিদ++; summary.pass++; break;
                case CONSTANTS.GRADE.MAQBUL: summary.মাকবুল++; summary.pass++; break;
                case CONSTANTS.GRADE.RASIB: summary.রাসিব++; break;
            }
        });

        summary.average = summary.participantCount > 0 ? Number((summary.totalMarks / summary.participantCount).toFixed(2)) : 0;
        const validResults = summary.totalStudents - summary.স্থগিত - summary.অনুপস্থিত;
        summary.validResults = validResults;
        summary.passRate = validResults > 0 ? ((summary.pass / validResults) * 100).toFixed(2) : '0.00';

        return summary;
    }

    /**
     * "শিক্ষক পরিপ্রেক্ষিত ফলাফল"-এর জন্য - মকতব বিভাগে কোড না থেকে শ্রেণির
     * নাম থাকে, তাই শ্রেণি অনুযায়ী Subject-wise সারাংশ গণনা করা হয়
     */
    function calculateSubjectWiseForClass(className, subjectName, allStudents) {
        const classStudents = filterByClass(allStudents, className);
        const summary = {
            jamah: className, subject: subjectName,
            totalStudents: classStudents.length,
            totalMarks: 0, participantCount: 0, average: 0,
            মুমতাজ: 0, জায়্যিদজিদ্দান: 0, জায়্যিদ: 0, মাকবুল: 0, রাসিব: 0,
            অনুপস্থিত: 0, স্থগিত: 0, বাতিল: 0, pass: 0
        };

        classStudents.forEach(student => {
            const entry = student.subjects[subjectName];
            if (!entry) return;
            if (entry.status === 'cancelled') { summary.বাতিল++; return; }
            if (entry.status === 'suspended') { summary.স্থগিত++; return; }
            if (entry.status === 'absent') { summary.অনুপস্থিত++; return; }
            if (entry.value === null) return;

            summary.totalMarks += entry.value;
            summary.participantCount++;

            const grade = KitabEngine.determineSingleMarkGrade(entry.value, CONSTANTS.PASS_MARK_MAKTAB);
            switch (grade) {
                case CONSTANTS.GRADE.MUMTAZ: summary.মুমতাজ++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID_JIDDAN: summary.জায়্যিদজিদ্দান++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID: summary.জায়্যিদ++; summary.pass++; break;
                case CONSTANTS.GRADE.MAQBUL: summary.মাকবুল++; summary.pass++; break;
                case CONSTANTS.GRADE.RASIB: summary.রাসিব++; break;
            }
        });

        summary.average = summary.participantCount > 0 ? Number((summary.totalMarks / summary.participantCount).toFixed(2)) : 0;
        const validResults = summary.totalStudents - summary.স্থগিত - summary.অনুপস্থিত;
        summary.validResults = validResults;
        summary.passRate = validResults > 0 ? ((summary.pass / validResults) * 100).toFixed(2) : '0.00';

        return summary;
    }

    // "কিতাব পরিপ্রেক্ষিত ফলাফল"-এ প্রথম বিষয়ের (Excel-এ যা "নাজেরা/আম্মাপারা/কায়দা" নামে
    // একই কলামে থাকে) সঠিক নাম প্রধান গ্রুপ অনুযায়ী দেখানোর জন্য
    const FIRST_SUBJECT_LABEL_BY_MAIN_GROUP = { 'নাজেরা': 'নাজেরা', 'আম্মাপারা': 'আম্মাপারা', 'বোর্ড': 'কায়দা' };

    function getMainGroupOfSubGroup(subGroup) {
        return Object.keys(CONSTANTS.MAKTAB_GROUPS).find(main => CONSTANTS.MAKTAB_GROUPS[main].includes(subGroup)) || null;
    }

    /**
     * মকতব বিভাগের প্রতিটি সাব-গ্রুপ (৬টি) x প্রতিটি Subject মিলিয়ে সম্পূর্ণ Subject-wise Report।
     * প্রথম Subject-টি Excel-এ "নাজেরা/আম্মাপারা/কায়দা" নামে একই কলাম হিসেবে থাকে (নম্বর খোঁজার
     * জন্য এই আসল নামই ব্যবহার হয়), কিন্তু রিপোর্টে দেখানোর সময় প্রতিটি সাব-গ্রুপের প্রধান গ্রুপ
     * (নাজেরা/আম্মাপারা/বোর্ড) অনুযায়ী সঠিক নাম (নাজেরা/আম্মাপারা/কায়দা - আলাদা আলাদা) বসানো হয়।
     */
    function calculateAllSubjectWise(maktabSheetData) {
        const { students, subjectHeaders } = maktabSheetData;
        const allSubGroups = Object.values(CONSTANTS.MAKTAB_GROUPS).flat();
        const rows = [];
        allSubGroups.forEach(subGroup => {
            subjectHeaders.forEach((subject, idx) => {
                const row = calculateSubjectWiseForSubGroup(subGroup, subject, students);
                if (idx === 0) {
                    const mainGroup = getMainGroupOfSubGroup(subGroup);
                    row.subject = FIRST_SUBJECT_LABEL_BY_MAIN_GROUP[mainGroup] || subject;
                }
                rows.push(row);
            });
        });
        return rows;
    }

    return {
        calculateStudent, calculateAll, determineGrade, filterByClass, filterBySubGroup, filterByMainGroup,
        calculateAllSubjectWise, calculateSubjectWiseForClass
    };
})();
