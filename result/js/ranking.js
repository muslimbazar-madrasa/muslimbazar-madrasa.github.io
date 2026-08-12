/**
 * ranking.js
 * ------------------------------------------------------------
 * মেধাক্রম (Merit) নির্ধারণ ও ফলাফল সারাংশ (Summary) তৈরির
 * সাধারণ Logic - কিতাব, হিফজ ও মকতব তিন বিভাগই এই Module ব্যবহার করবে।
 * ------------------------------------------------------------
 */

const RankingEngine = (() => {

    const SPECIAL_GRADES = [CONSTANTS.STATUS.CANCELLED, CONSTANTS.STATUS.SUSPENDED, CONSTANTS.STATUS.ABSENT, CONSTANTS.STATUS.IRREGULAR];

    // বিভাগ (Grade) অনুযায়ী অগ্রাধিকার ক্রম - মেধাক্রম নির্ধারণে ব্যবহৃত।
    // হিফজ বিভাগে Grade নির্ধারণ কুরআন নম্বর ও মোট নম্বর দুটোর সমন্বয়ে হয় বলে শুধু "মোট"
    // দিয়ে Rank করলে ভুল হতে পারে (কম মোট নম্বর পাওয়া কেউ বেশি নম্বরওয়ালা কারো চেয়ে
    // উঁচু বিভাগ পেয়ে যেতে পারে)। তাই প্রথমে বিভাগ (Grade Tier) অনুযায়ী, তারপর একই
    // বিভাগের মধ্যে মোট/গড় নম্বর অনুযায়ী Rank করা প্রয়োজন।
    const GRADE_RANK_ORDER = [CONSTANTS.GRADE.MUMTAZ, CONSTANTS.GRADE.JAYYID_JIDDAN, CONSTANTS.GRADE.JAYYID, CONSTANTS.GRADE.MAQBUL, CONSTANTS.GRADE.RASIB];

    /**
     * একাধিক জামাত/গ্রুপ থেকে ছাত্রদের একত্র করে নতুন করে সম্মিলিত মেধাক্রম গণনা করে
     * (মূল students Array-এর merit পরিবর্তন করে না - Clone-এর উপর কাজ করে)
     * এটি ব্যবহার হয় যখন প্রতিটি জামাতে ইতিমধ্যে আলাদা মেধাক্রম বসানো আছে,
     * কিন্তু সম্মিলিত (সব জামাত মিলিয়ে সেরা ৩ জন) তালিকা দরকার
     */
    function getCombinedTopMerit(students, key = 'average', topN = 3) {
        const eligible = students.filter(s => !SPECIAL_GRADES.includes(s.grade) && s[key] !== null && s[key] !== undefined);
        const clones = eligible.map(s => ({ ...s }));
        assignMerit(clones, key);
        return getTopMerit(clones, topN);
    }

    /**
     * getCombinedTopMerit-এর মতোই, কিন্তু বিভাগ (Grade Tier) কে প্রথম বিবেচনায় নিয়ে
     * (হিফজ বিভাগের জন্য - দেখুন assignMeritByGrade-এর মন্তব্য)
     */
    function getCombinedTopMeritByGrade(students, key = 'total', topN = 3) {
        const eligible = students.filter(s => !SPECIAL_GRADES.includes(s.grade) && s[key] !== null && s[key] !== undefined);
        const clones = eligible.map(s => ({ ...s }));
        assignMeritByGrade(clones, key);
        return getTopMerit(clones, topN);
    }

    /**
     * ছাত্রদের Array-তে Merit বসিয়ে দেয় (in-place)
     * key: যে Field-এর ভিত্তিতে Rank হবে (যেমন 'average' অথবা 'total')
     * সমান নম্বর হলে একই Merit (১, ১, ২ পদ্ধতি)
     * বিশেষ অবস্থার ছাত্র মেধাক্রমে অংশগ্রহণ করবে না
     */
    function assignMerit(students, key = 'average') {
        const eligible = students.filter(s => !SPECIAL_GRADES.includes(s.grade) && s[key] !== null && s[key] !== undefined);
        eligible.sort((a, b) => b[key] - a[key]);

        let rank = 0;
        let prevValue = null;

        eligible.forEach((student) => {
            if (prevValue === null || student[key] !== prevValue) {
                // "১, ১, ২" পদ্ধতি - টাই হলেও পরবর্তী Rank শুধু ১ বেড়ে যাবে (Index অনুযায়ী নয়),
                // যাতে একাধিক জন ১ম হলে পরের জন সরাসরি ২য়ই হয়, ৩য় হয়ে না যায়
                rank = rank + 1;
                prevValue = student[key];
            }
            student.merit = rank;
        });

        students.forEach(s => {
            if (SPECIAL_GRADES.includes(s.grade)) s.merit = null;
        });

        return students;
    }

    /**
     * assignMerit-এর মতোই, কিন্তু প্রথমে বিভাগ (Grade Tier: মুমতাজ > জায়্যিদ জিদ্দান >
     * জায়্যিদ > মাকবুল > রাসিব) অনুযায়ী, তারপর একই বিভাগের মধ্যে "key" (যেমন 'total')
     * অনুযায়ী Rank করে। হিফজ বিভাগে ব্যবহার করা হয়, যেখানে Grade নির্ধারণ কুরআন ও মোট
     * নম্বর দুটোর সমন্বয়ে হয় বলে শুধু মোট নম্বর দিয়ে Rank করলে ভুল ফলাফল আসতে পারে।
     */
    function assignMeritByGrade(students, key = 'total') {
        const eligible = students.filter(s => !SPECIAL_GRADES.includes(s.grade) && s[key] !== null && s[key] !== undefined);
        eligible.sort((a, b) => {
            const gradeDiff = GRADE_RANK_ORDER.indexOf(a.grade) - GRADE_RANK_ORDER.indexOf(b.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return b[key] - a[key];
        });

        let rank = 0;
        let prevGrade = null;
        let prevValue = null;

        eligible.forEach((student) => {
            if (prevGrade === null || student.grade !== prevGrade || student[key] !== prevValue) {
                rank = rank + 1;
                prevGrade = student.grade;
                prevValue = student[key];
            }
            student.merit = rank;
        });

        students.forEach(s => {
            if (SPECIAL_GRADES.includes(s.grade)) s.merit = null;
        });

        return students;
    }

    /**
     * Top 3 Merit-ধারী ছাত্রদের বের করে (সমান নম্বরে একাধিক ছাত্র থাকতে পারে)
     */
    function getTopMerit(students, topN = 3) {
        return students.filter(s => s.merit !== null && s.merit <= topN)
            .sort((a, b) => a.merit - b.merit);
    }

    /**
     * একটি জামাত/গ্রুপের ফলাফল সারাংশ তৈরি করে (Audit Report ও One Glance Result-এর জন্য)
     */
    function summarize(students) {
        const summary = {
            totalStudents: students.length,
            pass: 0,
            fail: 0,
            মুমতাজ: 0,
            জায়্যিদজিদ্দান: 0,
            জায়্যিদ: 0,
            মাকবুল: 0,
            রাসিব: 0,
            অনুপস্থিত: 0,
            স্থগিত: 0,
            বাতিল: 0,
            অনিয়মিত: 0
        };

        students.forEach(s => {
            switch (s.grade) {
                case CONSTANTS.GRADE.MUMTAZ: summary.মুমতাজ++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID_JIDDAN: summary.জায়্যিদজিদ্দান++; summary.pass++; break;
                case CONSTANTS.GRADE.JAYYID: summary.জায়্যিদ++; summary.pass++; break;
                case CONSTANTS.GRADE.MAQBUL: summary.মাকবুল++; summary.pass++; break;
                case CONSTANTS.GRADE.RASIB: summary.রাসিব++; summary.fail++; break;
                case CONSTANTS.STATUS.ABSENT: summary.অনুপস্থিত++; break;
                case CONSTANTS.STATUS.SUSPENDED: summary.স্থগিত++; break;
                case CONSTANTS.STATUS.CANCELLED: summary.বাতিল++; break;
                case CONSTANTS.STATUS.IRREGULAR: summary.অনিয়মিত++; break;
            }
        });

        // প্রাপ্ত ফলাফল (Valid Results) = মোট ছাত্র বাদ স্থগিত/অনুপস্থিত/অনিয়মিত (নিয়ম অনুযায়ী বাতিল বাদ যাবে না)
        summary.validResults = summary.totalStudents - summary.স্থগিত - summary.অনুপস্থিত - summary.অনিয়মিত;
        summary.passRate = summary.validResults > 0
            ? ((summary.pass / summary.validResults) * 100).toFixed(2)
            : '0.00';

        return summary;
    }

    /**
     * একাধিক Summary Object যোগ করে সম্মিলিত সারাংশ তৈরি করে
     */
    function combineSummaries(summaries) {
        const combined = {
            totalStudents: 0, pass: 0, fail: 0,
            মুমতাজ: 0, জায়্যিদজিদ্দান: 0, জায়্যিদ: 0, মাকবুল: 0, রাসিব: 0,
            অনুপস্থিত: 0, স্থগিত: 0, বাতিল: 0, অনিয়মিত: 0
        };
        summaries.forEach(s => {
            Object.keys(combined).forEach(k => {
                if (typeof s[k] === 'number') combined[k] += s[k];
            });
        });
        combined.validResults = combined.totalStudents - combined.স্থগিত - combined.অনুপস্থিত - combined.অনিয়মিত;
        combined.passRate = combined.validResults > 0
            ? ((combined.pass / combined.validResults) * 100).toFixed(2)
            : '0.00';
        return combined;
    }

    return { assignMerit, assignMeritByGrade, getTopMerit, getCombinedTopMerit, getCombinedTopMeritByGrade, summarize, combineSummaries, SPECIAL_GRADES };
})();
