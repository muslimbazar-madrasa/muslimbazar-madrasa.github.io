/**
 * excel.js
 * ------------------------------------------------------------
 * Excel Import Engine
 * দায়িত্ব:
 *  - SheetJS ব্যবহার করে Excel ফাইল পড়া
 *  - ১৩টি নির্দিষ্ট Sheet শনাক্ত করা
 *  - Dynamic Subject Mapping (Header থেকে Subject সংগ্রহ)
 *  - Data Validation (Duplicate Roll, Blank Cell, Invalid Data)
 *  - Import Report তৈরি করা
 * কোনো Result Calculation এখানে হবে না (সেটা kitab.js/hifz.js/maktab.js করবে)
 * ------------------------------------------------------------
 */

const ExcelEngine = (() => {

    /**
     * Header Cell-এর টেক্সট Trim করে Alias List-এর সাথে মিলিয়ে Column Index বের করে
     */
    function findColumnIndex(headerRow, aliasList) {
        for (let i = 0; i < headerRow.length; i++) {
            const cell = String(headerRow[i] || '').trim();
            if (aliasList.some(alias => cell === alias || cell.includes(alias))) {
                return i;
            }
        }
        return -1;
    }

    /**
     * নির্দিষ্ট Cell-এ Excel Font "Double Underline" Style প্রয়োগ করা আছে কিনা যাচাই করে।
     * এটা কাজ করার জন্য XLSX.read()-এ cellStyles:true দেওয়া আবশ্যক (দেখুন importExcelFile)।
     * SheetJS Community সংস্করণে এই Style-Value ভিন্ন ভিন্নভাবে আসতে পারে বলে একাধিক
     * সম্ভাব্য ফরম্যাট মিলিয়ে দেখা হচ্ছে - বাস্তব Excel ফাইলে টেস্ট করে দেখা প্রয়োজন।
     */
    function isDoubleUnderlineCell(sheetRef, rowIdx, colIdx) {
        if (!sheetRef) return false;
        try {
            const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
            const cell = sheetRef[addr];
            const font = cell && cell.s && cell.s.font;
            if (!font) return false;
            const u = font.underline;
            return u === 2 || u === 'double' || u === 'Double' || u === 'DOUBLE' || font.underlineDouble === true;
        } catch (e) {
            return false;
        }
    }

    /**
     * একটি Raw AOA (Array of Arrays) Sheet-কে কিতাব/মকতব ধরনের Generic Student List-এ রূপান্তর করে
     * (Serial, Name, FatherName, Roll + Dynamic Subjects)
     * sheetRef দিলে (কিতাব Sheet-এর জন্য) প্রতিটি Subject Mark-এ Double Underline আছে
     * কিনা তাও প্রতিটি Entry-তে যুক্ত হবে (student.subjects[subj].doubleUnderline)।
     */
    function parseGenericSheet(aoa, extraFields = [], maxColumns = null, sheetRef = null) {
        const errors = [];
        const warnings = [];

        if (!aoa || aoa.length < 2) {
            errors.push('Sheet খালি অথবা কোনো Data নেই।');
            return { students: [], subjectHeaders: [], subjectCodes: {}, errors, warnings };
        }

        const headerRow = maxColumns ? aoa[0].slice(0, maxColumns) : aoa[0];
        const nameIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.name);
        const fatherIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.fatherName);
        const rollIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.roll);
        const serialIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.serial);
        // ঐচ্ছিক "পরীক্ষার্থীর ধরণ" কলাম (কিতাব বিভাগে "অনিয়মিত" চিহ্নিত করতে ব্যবহৃত) -
        // থাকলে এটাকে Subject হিসেবে ধরা হবে না
        const studentTypeIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.studentType || []);

        if (nameIdx === -1 || rollIdx === -1) {
            errors.push('আবশ্যকীয় কলাম (নাম/রোল) পাওয়া যায়নি।');
            return { students: [], subjectHeaders: [], subjectCodes: {}, errors, warnings };
        }

        // Extra Fields (Group, Class, ExamGroup) - কলাম ইনডেক্স বের করা
        const extraIdx = {};
        extraFields.forEach(f => {
            extraIdx[f] = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES[f] || [f]);
        });

        // ব্যবহৃত সব Column বাদ দিয়ে বাকিগুলো Subject হিসেবে ধরা হবে
        const usedIndexes = new Set([nameIdx, fatherIdx, rollIdx, serialIdx, studentTypeIdx, ...Object.values(extraIdx)].filter(i => i !== -1));
        const subjectHeaders = [];
        const subjectIdx = [];
        headerRow.forEach((h, idx) => {
            const text = String(h || '').trim();
            if (!usedIndexes.has(idx) && text !== '' && !/^ক্রমিক/.test(text)) {
                subjectHeaders.push(text);
                subjectIdx.push(idx);
            }
        });

        const students = [];
        const rollSeen = new Set();

        // ঐচ্ছিক "Subject Code" Row শনাক্তকরণ - হেডারের ঠিক পরের Row-তে যদি নাম ও
        // রোল খালি থাকে কিন্তু Subject Column-এ মান থাকে, তাহলে সেটি Code Row ধরা
        // হবে (কোনো Output/Print-এ দেখানো হবে না, শুধু Teacher Matching-এ ব্যবহৃত হবে)
        const subjectCodes = {};
        let dataStartRow = 1;
        if (aoa.length > 1) {
            const possibleCodeRow = aoa[1];
            const nameEmpty = !possibleCodeRow[nameIdx] || String(possibleCodeRow[nameIdx]).trim() === '';
            const rollEmpty = !possibleCodeRow[rollIdx] || String(possibleCodeRow[rollIdx]).trim() === '';
            const hasAnySubjectValue = subjectIdx.some(idx => possibleCodeRow[idx] !== undefined && String(possibleCodeRow[idx]).trim() !== '');
            if (nameEmpty && rollEmpty && hasAnySubjectValue) {
                subjectHeaders.forEach((subj, si) => {
                    const codeVal = possibleCodeRow[subjectIdx[si]];
                    if (codeVal !== undefined && String(codeVal).trim() !== '') {
                        subjectCodes[subj] = String(codeVal).trim();
                    }
                });
                dataStartRow = 2; // Code Row বাদ দিয়ে পরের Row থেকে Student Data শুরু
            }
        }

        for (let r = dataStartRow; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue; // Blank Row Skip

            const name = String(row[nameIdx] || '').trim();
            const roll = String(row[rollIdx] || '').trim();
            const fatherName = fatherIdx !== -1 ? String(row[fatherIdx] || '').trim() : '';

            if (roll === '') {
                warnings.push(`Row ${r + 1}: রোল খালি রয়েছে, এই Row বাদ দেওয়া হয়েছে।`);
                continue;
            }
            if (name === '') {
                warnings.push(`Row ${r + 1} (Roll ${roll}): নাম খালি রয়েছে।`);
            }
            if (rollSeen.has(roll)) {
                errors.push(`Duplicate Roll পাওয়া গেছে: ${roll} (Row ${r + 1})`);
                continue;
            }
            rollSeen.add(roll);

            const student = {
                serial: serialIdx !== -1 && String(row[serialIdx] || '').trim() !== '' ? String(row[serialIdx]).trim() : String(students.length + 1),
                name, fatherName, roll, subjects: {}
            };

            // "পরীক্ষার্থীর ধরণ" কলামে "অনিয়মিত" থাকলে - এই ছাত্র বিভাগে "অনিয়মিত" দেখাবে
            // এবং মেধা তালিকা থেকে বাদ পড়বে (দেখুন kitab.js: calculateStudent)
            if (studentTypeIdx !== -1) {
                const typeVal = String(row[studentTypeIdx] || '').trim();
                if (typeVal && typeVal.includes(CONSTANTS.STATUS.IRREGULAR)) {
                    student.irregular = true;
                }
            }

            extraFields.forEach(f => {
                if (extraIdx[f] !== -1) {
                    const rawVal = String(row[extraIdx[f]] || '').trim();
                    // "class" কলামের মান Excel-এ বিভিন্নভাবে লেখা থাকতে পারে (যেমন "১ম শ্রেণি"),
                    // তাই সবসময় CONSTANTS.MAKTAB_CLASSES-এর ক্যানোনিক্যাল নামে রূপান্তর করা হয়,
                    // যাতে পরবর্তীতে শ্রেণি-ভিত্তিক ফলাফল খুঁজে পেতে সমস্যা না হয়।
                    student[f] = f === 'class' ? Utils.normalizeClassName(rawVal) : rawVal;
                }
            });

            subjectHeaders.forEach((subj, si) => {
                const raw = row[subjectIdx[si]];
                const rawStr = raw === undefined || raw === null ? '' : String(raw).trim();
                const status = Utils.detectSpecialStatus(rawStr);
                const doubleUnderline = isDoubleUnderlineCell(sheetRef, r, subjectIdx[si]);
                if (status) {
                    student.subjects[subj] = { raw: rawStr, status, value: null, doubleUnderline };
                } else if (rawStr === '') {
                    student.subjects[subj] = { raw: '', status: null, value: null, doubleUnderline };
                    warnings.push(`Row ${r + 1} (Roll ${roll}): বিষয় "${subj}"-এ কোনো মান নেই।`);
                } else if (Utils.isNumeric(rawStr)) {
                    const num = Utils.toNumber(rawStr);
                    if (num < 0) {
                        errors.push(`Row ${r + 1} (Roll ${roll}): বিষয় "${subj}"-এ ঋণাত্মক মান।`);
                    }
                    student.subjects[subj] = { raw: rawStr, status: null, value: num, doubleUnderline };
                } else {
                    errors.push(`Row ${r + 1} (Roll ${roll}): বিষয় "${subj}"-এ অবৈধ মান "${rawStr}"।`);
                    student.subjects[subj] = { raw: rawStr, status: null, value: null, doubleUnderline };
                }
            });

            students.push(student);
        }

        return { students, subjectHeaders, subjectCodes, errors, warnings };
    }

    /**
     * হিফজ Sheet Parse করে (Special Structure - প্রতি Subject-এ ৪টি Column)
     */
    function parseHifzSheet(aoa) {
        const errors = [];
        const warnings = [];
        if (!aoa || aoa.length < 2) {
            errors.push('হিফজ Sheet খালি অথবা Data নেই।');
            return { students: [], errors, warnings };
        }
        const headerRow = aoa[0];
        const nameIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.name);
        const fatherIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.fatherName);
        const rollIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.roll);
        const groupIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.group);
        const examGroupIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.examGroup);
        const nesabIdx = findColumnIndex(headerRow, ['নেসাব']);
        const serialIdxHifz = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.serial);

        if (nameIdx === -1 || rollIdx === -1) {
            errors.push('হিফজ Sheet-এ আবশ্যকীয় কলাম (নাম/রোল) পাওয়া যায়নি।');
            return { students: [], errors, warnings };
        }

        // প্রতিটি Subject-এর জন্য "গড়" Column খুঁজে বের করা (fallback: পরীক্ষক ১+২ থেকে গড় হিসাব)
        const subjectColMap = {};
        CONSTANTS.HIFZ_SUBJECTS.forEach(subj => {
            let avgIdx = -1, ex1Idx = -1, ex2Idx = -1;
            headerRow.forEach((h, idx) => {
                const text = String(h || '').trim();
                if (text.includes(subj)) {
                    if (text.includes('গড়')) avgIdx = idx;
                    else if (text.includes('১ম')) ex1Idx = idx;
                    else if (text.includes('২য়')) ex2Idx = idx;
                }
            });
            subjectColMap[subj] = { avgIdx, ex1Idx, ex2Idx };
        });

        const students = [];
        const rollSeen = new Set();

        for (let r = 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;

            const name = String(row[nameIdx] || '').trim();
            const roll = String(row[rollIdx] || '').trim();
            const fatherName = fatherIdx !== -1 ? String(row[fatherIdx] || '').trim() : '';
            const group = groupIdx !== -1 ? String(row[groupIdx] || '').trim() : '';
            const examGroup = examGroupIdx !== -1 ? String(row[examGroupIdx] || '').trim() : '';
            const nesab = nesabIdx !== -1 ? String(row[nesabIdx] || '').trim() : '';

            if (roll === '') {
                warnings.push(`Row ${r + 1}: রোল খালি রয়েছে, বাদ দেওয়া হয়েছে।`);
                continue;
            }
            if (rollSeen.has(roll)) {
                errors.push(`Duplicate Roll (হিফজ): ${roll} (Row ${r + 1})`);
                continue;
            }
            rollSeen.add(roll);

            const student = {
                serial: serialIdxHifz !== -1 && String(row[serialIdxHifz] || '').trim() !== '' ? String(row[serialIdxHifz]).trim() : String(students.length + 1),
                name, fatherName, roll, group, examGroup, nesab, subjects: {}
            };

            CONSTANTS.HIFZ_SUBJECTS.forEach(subj => {
                const map = subjectColMap[subj];
                let rawStr = '';
                if (map.avgIdx !== -1) {
                    rawStr = String(row[map.avgIdx] || '').trim();
                } else if (map.ex1Idx !== -1 && map.ex2Idx !== -1) {
                    const v1 = Utils.toNumber(row[map.ex1Idx]);
                    const v2 = Utils.toNumber(row[map.ex2Idx]);
                    if (v1 !== null && v2 !== null) rawStr = String((v1 + v2) / 2);
                }
                const status = Utils.detectSpecialStatus(rawStr);
                if (status) {
                    student.subjects[subj] = { raw: rawStr, status, value: null };
                } else if (rawStr === '') {
                    student.subjects[subj] = { raw: '', status: null, value: null };
                    warnings.push(`Row ${r + 1} (Roll ${roll}): "${subj}"-এ মান নেই।`);
                } else if (Utils.isNumeric(rawStr)) {
                    student.subjects[subj] = { raw: rawStr, status: null, value: Utils.toNumber(rawStr) };
                } else {
                    errors.push(`Row ${r + 1} (Roll ${roll}): "${subj}"-এ অবৈধ মান।`);
                    student.subjects[subj] = { raw: rawStr, status: null, value: null };
                }
            });

            students.push(student);
        }

        return { students, errors, warnings };
    }

    /**
     * ঐচ্ছিক "শিক্ষক" Sheet Parse করে (শিক্ষক পরিপ্রেক্ষিতে ফলাফলের জন্য)
     * Structure: ক্রমিক | শিক্ষকের নাম | কিতাব-১ | কিতাব-২ | ...
     * প্রতিটি কিতাব Column-এ ঠিক সেই কিতাবের নাম লেখা থাকবে যা কোনো না কোনো
     * জামাত Sheet-এর Subject Header-এর সাথে হুবহু মিলবে।
     */
    /**
     * ঐচ্ছিক "শিক্ষক" Sheet Parse করে (শিক্ষক পরিপ্রেক্ষিতে ফলাফলের জন্য)
     * Structure: ক্রমিক | শিক্ষকের নাম | কিতাব-১ | কোড-১ | কিতাব-২ | কোড-২ | ...
     * প্রতিটি কিতাব Column-এর ঠিক পরের Column-টি সেই কিতাবের Subject Code
     * (জামাত Sheet-এর Subject Code Row-এর সাথে মিলিয়ে সঠিক জামাত/সাবজেক্ট
     * শনাক্ত করা হয় - নাম মিলিয়ে নয়, তাই একই নামের বিষয় একাধিক জামাতে
     * থাকলেও কোনো সমস্যা হয় না)
     */
    function parseTeacherSheet(aoa) {
        if (!aoa || aoa.length < 2) return [];
        const headerRow = aoa[0];
        const nameIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.name.concat(['শিক্ষকের নাম']));
        if (nameIdx === -1) return [];
        const designationIdx = findColumnIndex(headerRow, ['পদবী', 'পদ']);

        // নাম/ক্রমিক/পদবী বাদ দিয়ে বাকি Column-গুলো জোড়ায় জোড়ায় (কিতাব, কোড) ধরা হবে
        const remainingIndexes = headerRow
            .map((h, idx) => idx)
            .filter(idx => idx !== nameIdx && idx !== designationIdx
                && !/^ক্রমিক/.test(String(headerRow[idx] || '').trim()) && String(headerRow[idx] || '').trim() !== '');

        const teachers = [];
        for (let r = 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;
            const name = String(row[nameIdx] || '').trim();
            if (!name) continue;
            const designation = designationIdx !== -1 ? String(row[designationIdx] || '').trim() : '';

            const subjects = [];
            for (let i = 0; i < remainingIndexes.length; i += 2) {
                const subjIdx = remainingIndexes[i];
                const codeIdx = remainingIndexes[i + 1];
                const subjName = String(row[subjIdx] || '').trim();
                const code = codeIdx !== undefined ? String(row[codeIdx] || '').trim() : '';
                if (subjName !== '') {
                    subjects.push({ name: subjName, code });
                }
            }
            teachers.push({ name, designation, subjects });
        }
        return teachers;
    }

    /**
     * ঐচ্ছিক "গ্রুপ শিক্ষক" Sheet Parse করে - "শিক্ষক" Sheet-এর ঠিক পরে থাকে।
     * এটি সেইসব শিক্ষকদের জন্য যাদের বিষয়ের কোনো Code দেওয়া সম্ভব হয় না (মূলত মকতব
     * বিভাগ, যেমন নাজেরা/আম্মাপারা/কায়দা)। কোড দিয়ে নয়, বরং সরাসরি (সাবজেক্ট, জামাত/গ্রুপ)
     * জোড়া দিয়ে সঠিক গ্রুপ শনাক্ত করা হয়।
     * Structure: ক্রমিক | বিভাগ | শিক্ষকদের নাম | গ্রুপের নাম | সাবজেক্ট-১ | জামাত-১ | সাবজেক্ট-২ | জামাত-২ | ...
     * রিটার্ন: [{ division, teacherName, groupName, entries: [{ subject, jamah }, ...] }]
     */
    function parseGroupTeacherSheet(aoa) {
        if (!aoa || aoa.length < 2) return [];
        const headerRow = aoa[0];
        const divisionIdx = findColumnIndex(headerRow, ['বিভাগ']);
        const nameIdx = findColumnIndex(headerRow, CONSTANTS.HEADER_ALIASES.name.concat(['শিক্ষকদের নাম', 'শিক্ষকের নাম']));
        const groupNameIdx = findColumnIndex(headerRow, ['গ্রুপের নাম', 'গ্রুপ']);
        if (nameIdx === -1) return [];

        // ক্রমিক/বিভাগ/নাম/গ্রুপের নাম বাদ দিয়ে বাকি কলামগুলো জোড়ায় জোড়ায় (সাবজেক্ট, জামাত) ধরা হবে
        const usedIdx = new Set([divisionIdx, nameIdx, groupNameIdx].filter(i => i !== -1));
        const remainingIndexes = headerRow
            .map((h, idx) => idx)
            .filter(idx => !usedIdx.has(idx)
                && !/^ক্রমিক/.test(String(headerRow[idx] || '').trim()) && String(headerRow[idx] || '').trim() !== '');

        const groupTeachers = [];
        for (let r = 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;
            const teacherName = String(row[nameIdx] || '').trim();
            if (!teacherName) continue;
            const division = divisionIdx !== -1 ? String(row[divisionIdx] || '').trim() : '';
            const groupName = groupNameIdx !== -1 ? String(row[groupNameIdx] || '').trim() : '';

            const entries = [];
            for (let i = 0; i < remainingIndexes.length; i += 2) {
                const subjIdx = remainingIndexes[i];
                const jamahIdx = remainingIndexes[i + 1];
                const subject = String(row[subjIdx] || '').trim();
                const jamah = jamahIdx !== undefined ? String(row[jamahIdx] || '').trim() : '';
                if (subject !== '' && jamah !== '') {
                    entries.push({ subject, jamah });
                }
            }
            groupTeachers.push({ division, teacherName, groupName, entries });
        }
        return groupTeachers;
    }

    /**
     * "বক্স" Sheet Parse করে - জামাত/গ্রুপ-ভিত্তিক ফলাফল টেবিলের উপরে ডান দিকে বসানো
     * তথ্য-বক্সের কনটেন্ট এখান থেকে আসে।
     * শুধুমাত্র A-G কলাম পড়া হয় (এর পরে কিছু থাকলেও তা উপেক্ষা করা হয়):
     * ক্রমিক | জামাত/বিভাগের নাম | মুমতাজ | জায়্যিদ জিদ্দান | জায়্যিদ | মাকবুল | ইমদাদী নম্বর
     * "নাম" কলামে কিতাবের ১১ জামাতের জন্য যেকোনো নাম লেখা যাবে (মিলিয়ে দেখা হয় না) - শুধু
     * ক্রম (Position) ঠিক থাকলেই হবে। "মকতব" ও "হিফজ" নামের রো দুটো আলাদাভাবে (নাম মিলিয়ে)
     * শনাক্ত হয় এবং কিতাবের ১১টি রো গণনায় ধরা হয় না।
     */
    function parseBoxSheet(aoa) {
        if (!aoa || aoa.length < 2) return [];
        const rows = [];
        for (let r = 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;
            const name = String(row[1] || '').trim(); // B কলাম
            if (!name) continue;
            rows.push({
                name,
                mumtaz: row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '',
                jayyidJiddan: row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '',
                jayyid: row[4] !== undefined && row[4] !== null ? String(row[4]).trim() : '',
                maqbul: row[5] !== undefined && row[5] !== null ? String(row[5]).trim() : '',
                imdadi: row[6] !== undefined && row[6] !== null ? String(row[6]).trim() : ''
            });
        }
        return rows;
    }

    /**
     * সম্পূর্ণ Excel File Import করে - প্রধান Entry Function
     * options: { file, examName, publishDate, remarks, onProgress(fn) }
     */
    async function importExcelFile({ file, onProgress }) {
        const startTime = Date.now();
        onProgress && onProgress(5, 'File পড়া হচ্ছে...');

        const data = await file.arrayBuffer();
        // cellStyles:true না দিলে Font Underline (ডবল দাগ শনাক্তকরণের জন্য) পড়া যাবে না
        const workbook = XLSX.read(data, { type: 'array', cellStyles: true });

        onProgress && onProgress(20, 'Sheet শনাক্ত করা হচ্ছে...');

        const requiredSheets = [...CONSTANTS.KITAB_JAMAH_ORDER, CONSTANTS.MAKTAB_SHEET, CONSTANTS.HIFZ_SHEET];
        const missingSheets = requiredSheets.filter(name => !workbook.SheetNames.includes(name));

        const report = {
            totalSheets: requiredSheets.length,
            successfulSheets: 0,
            totalStudents: 0,
            warnings: [],
            errors: [],
            missingSheets,
            importTime: null
        };

        if (missingSheets.length > 0) {
            report.errors.push(`নিম্নলিখিত Sheet পাওয়া যায়নি: ${missingSheets.join(', ')}`);
            report.importTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
            return { success: false, report, data: null };
        }

        const result = { kitab: {}, maktab: null, hifz: null, teachers: [], groupTeachers: [], boxData: [] };
        const allRolls = new Set();
        const duplicateAcrossSheets = [];

        let progress = 25;
        const progressStep = Math.floor(55 / requiredSheets.length);

        // কিতাব বিভাগের ১১টি জামাত পড়া
        for (const jamah of CONSTANTS.KITAB_JAMAH_ORDER) {
            onProgress && onProgress(progress, `${jamah} Sheet পড়া হচ্ছে...`);
            const aoa = XLSX.utils.sheet_to_json(workbook.Sheets[jamah], { header: 1, defval: '' });
            const parsed = parseGenericSheet(aoa, [], null, workbook.Sheets[jamah]);
            result.kitab[jamah] = parsed;
            report.warnings.push(...parsed.warnings.map(w => `[${jamah}] ${w}`));
            report.errors.push(...parsed.errors.map(e => `[${jamah}] ${e}`));
            report.totalStudents += parsed.students.length;
            if (parsed.errors.length === 0) report.successfulSheets++;
            parsed.students.forEach(s => {
                if (allRolls.has(s.roll)) duplicateAcrossSheets.push(s.roll);
                allRolls.add(s.roll);
            });
            progress += progressStep;
        }

        // মকতব বিভাগ পড়া
        onProgress && onProgress(progress, 'মকতব Sheet পড়া হচ্ছে...');
        const maktabAoa = XLSX.utils.sheet_to_json(workbook.Sheets[CONSTANTS.MAKTAB_SHEET], { header: 1, defval: '' });
        const maktabParsed = parseGenericSheet(maktabAoa, ['group', 'class'], 15);
        result.maktab = maktabParsed;
        report.warnings.push(...maktabParsed.warnings.map(w => `[মকতব] ${w}`));
        report.errors.push(...maktabParsed.errors.map(e => `[মকতব] ${e}`));
        report.totalStudents += maktabParsed.students.length;
        if (maktabParsed.errors.length === 0) report.successfulSheets++;
        maktabParsed.students.forEach(s => {
            if (allRolls.has(s.roll)) duplicateAcrossSheets.push(s.roll);
            allRolls.add(s.roll);
        });

        // হিফজ বিভাগ পড়া
        onProgress && onProgress(progress + progressStep, 'হিফজ Sheet পড়া হচ্ছে...');
        const hifzAoa = XLSX.utils.sheet_to_json(workbook.Sheets[CONSTANTS.HIFZ_SHEET], { header: 1, defval: '' });
        const hifzParsed = parseHifzSheet(hifzAoa);
        result.hifz = hifzParsed;
        report.warnings.push(...hifzParsed.warnings.map(w => `[হিফজ] ${w}`));
        report.errors.push(...hifzParsed.errors.map(e => `[হিফজ] ${e}`));
        report.totalStudents += hifzParsed.students.length;
        if (hifzParsed.errors.length === 0) report.successfulSheets++;
        hifzParsed.students.forEach(s => {
            if (allRolls.has(s.roll)) duplicateAcrossSheets.push(s.roll);
            allRolls.add(s.roll);
        });

        if (duplicateAcrossSheets.length > 0) {
            report.errors.push(`একাধিক Sheet-এ একই Roll পাওয়া গেছে (সম্পূর্ণ সফটওয়্যারে Roll Unique হতে হবে): ${duplicateAcrossSheets.join(', ')}`);
        }

        // ঐচ্ছিক "শিক্ষক" Sheet (থাকলে পড়া হবে, না থাকলে Import ব্যর্থ হবে না)
        if (workbook.SheetNames.includes(CONSTANTS.TEACHER_SHEET)) {
            onProgress && onProgress(97, 'শিক্ষক তথ্য পড়া হচ্ছে...');
            const teacherAoa = XLSX.utils.sheet_to_json(workbook.Sheets[CONSTANTS.TEACHER_SHEET], { header: 1, defval: '' });
            result.teachers = parseTeacherSheet(teacherAoa);
            if (result.teachers.length === 0) {
                report.warnings.push(`"${CONSTANTS.TEACHER_SHEET}" Sheet পাওয়া গেছে কিন্তু কোনো ভ্যালিড শিক্ষকের তথ্য পড়া যায়নি - কলাম হেডার/ফরম্যাট মিলিয়ে দেখুন।`);
            }
        } else {
            report.warnings.push(`"${CONSTANTS.TEACHER_SHEET}" নামে কোনো Sheet পাওয়া যায়নি (ঐচ্ছিক - শিক্ষক পরিপ্রেক্ষিত ফলাফলের কিতাব অংশের জন্য দরকার)। এই Excel-এ যেসব Sheet আছে: ${workbook.SheetNames.join(', ')}`);
        }

        // ঐচ্ছিক "গ্রুপ শিক্ষক" Sheet - "শিক্ষক" Sheet-এর ঠিক পরে থাকে (কোড দেওয়া সম্ভব নয়
        // এমন শিক্ষকদের জন্য, মূলত মকতব ও হিফজ বিভাগ)
        const groupTeacherSheetName = CONSTANTS.GROUP_TEACHER_SHEET || 'গ্রুপ শিক্ষক';
        if (workbook.SheetNames.includes(groupTeacherSheetName)) {
            onProgress && onProgress(98, 'গ্রুপ শিক্ষক তথ্য পড়া হচ্ছে...');
            const groupTeacherAoa = XLSX.utils.sheet_to_json(workbook.Sheets[groupTeacherSheetName], { header: 1, defval: '' });
            result.groupTeachers = parseGroupTeacherSheet(groupTeacherAoa);
            if (result.groupTeachers.length === 0) {
                report.warnings.push(`"${groupTeacherSheetName}" Sheet পাওয়া গেছে কিন্তু কোনো ভ্যালিড রো পড়া যায়নি - কলাম হেডার (বিভাগ/শিক্ষকের নাম/গ্রুপ) মিলিয়ে দেখুন।`);
            }
        } else {
            report.warnings.push(`"${groupTeacherSheetName}" নামে কোনো Sheet পাওয়া যায়নি (ঐচ্ছিক - শিক্ষক পরিপ্রেক্ষিত ফলাফলের মকতব ও হিফজ অংশের জন্য দরকার)। এই Excel-এ যেসব Sheet আছে: ${workbook.SheetNames.join(', ')}`);
        }

        // ঐচ্ছিক "বক্স" Sheet - জামাত/গ্রুপ ভিত্তিক ফলাফল টেবিলের উপরের তথ্য-বক্সের জন্য
        const boxSheetName = CONSTANTS.BOX_SHEET || 'বক্স';
        if (workbook.SheetNames.includes(boxSheetName)) {
            onProgress && onProgress(99, 'বক্স তথ্য পড়া হচ্ছে...');
            const boxAoa = XLSX.utils.sheet_to_json(workbook.Sheets[boxSheetName], { header: 1, defval: '' });
            result.boxData = parseBoxSheet(boxAoa);
            if (result.boxData.length === 0) {
                report.warnings.push(`"${boxSheetName}" Sheet পাওয়া গেছে কিন্তু কোনো ভ্যালিড রো পড়া যায়নি - কলাম হেডার (বিভাগ/জামাত/মুমতাজ/জায়্যিদ জিদ্দান/জায়্যিদ/মাকবুল/ইমদাদী নম্বর) মিলিয়ে দেখুন।`);
            }
        }

        onProgress && onProgress(98, 'যাচাই সম্পন্ন হচ্ছে...');

        report.importTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
        const success = report.errors.length === 0;

        onProgress && onProgress(100, 'সম্পন্ন হয়েছে।');

        return { success, report, data: success ? result : null };
    }

    return { importExcelFile, parseGenericSheet, parseHifzSheet, parseTeacherSheet, parseGroupTeacherSheet, parseBoxSheet };
})();
