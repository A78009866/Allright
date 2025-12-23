// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 
const fs = require('fs'); // تأكد من وجود هذا السطر في أعلى الملف مع الـ requires
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, 'views'); 

app.use(bodyParser.json());
app.use(express.static(VIEWS_PATH)); 

let db;
let studentsRef;
let isFirebaseReady = false; 

try {
    if (!admin.apps.length) { 
        const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
        const databaseURL = process.env.FIREBASE_DATABASE_URL;

        if (!serviceAccountJson || !databaseURL) {
            console.error("Critical: Missing Firebase vars.");
        } else {
            try {
                const cleanJsonString = serviceAccountJson.replace(/^[\"]+|[\"]+$/g, '');
                const serviceAccount = JSON.parse(cleanJsonString);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: databaseURL
                });
                console.log("Firebase initialized.");
                db = admin.database();
                studentsRef = db.ref('students');
                isFirebaseReady = true;
            } catch (jsonError) {
                 console.error("Critical: JSON Parse Error", jsonError.message);
            }
        }
    }
} catch (error) {
    console.error("Firebase Init Error:", error.message);
}

// نفس هيكل البيانات السابق (courses)
const courses = {
    "المرحلة الابتدائية": {
        "السنة الأولى ابتدائي": { "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية فنية", "تربية بدنية"] },
        "السنة الثانية ابتدائي": { "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية علمية", "تربية فنية"] },
        "السنة الثالثة ابتدائي": { "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية"] },
        "السنة الرابعة ابتدائي": { "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "علوم طبيعية"] },
        "السنة الخامسة ابتدائي": { "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "علوم طبيعية"] }
    },
    "المرحلة المتوسطة": {
        "السنة الأولى متوسط": { "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "إعلام آلي"] },
        "السنة الثانية متوسط": { "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية"] },
        "السنة الثالثة متوسط": { "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "إعلام آلي"] },
        "السنة الرابعة متوسط": { "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية"] }
    },
    "المرحلة الثانوية": {
        "السنة الأولى ثانوي": {
            "جذع مشترك علوم وتكنولوجيا": ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "جذع مشترك آداب": ["لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية", "علوم إسلامية"]
        },
        "السنة الثانية ثانوي": {
            "شعبة علوم تجريبية": ["علوم طبيعية", "فيزياء", "رياضيات", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تقني رياضي": ["هندسة ميكانيكية/كهربائية/مدنية/طرائق", "رياضيات", "فيزياء", "علوم طبيعية/تكنولوجيا", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تسيير واقتصاد": ["المحاسبة والمالية", "القانون", "الاقتصاد والمناجمنت", "الرياضيات", "التاريخ والجغرافيا", "لغة عربية", "لغة فرنسية", "لغة إنجليزية"], 
            "شعبة آداب وفلسفة": ["فلسفة", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة لغات أجنبية": ["لغة أجنبية 1 (فرنسية)", "لغة أجنبية 2 (إنجليزية)", "لغة أجنبية 3 (إسبانية)", "فلسفة", "لغة عربية", "تاريخ وجغرافيا"]
        },
        "السنة الثالثة ثانوي (بكالوريا)": {
            "شعبة علوم تجريبية": ["علوم طبيعية", "فيزياء", "رياضيات", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة رياضيات": ["رياضيات", "فيزياء", "علوم طبيعية/تكنولوجيا", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تقني رياضي": ["هندسة ميكانيكية/كهربائية/مدنية/طرائق", "رياضيات", "فيزياء", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تسيير واقتصاد": ["المحاسبة والمالية", "القانون", "الاقتصاد والمناجمنت", "الرياضيات", "التاريخ والجغرافيا", "لغة عربية", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة آداب وفلسفة": ["فلسفة", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة لغات أجنبية": ["لغة أجنبية 1 (فرنسية)", "لغة أجنبية 2 (إنجليزية)", "لغة أجنبية 3 (إسبانية)", "فلسفة", "لغة عربية", "تاريخ وجغرافيا"]
        }
    }
};

function checkFirebaseReadiness(res) {
    if (!isFirebaseReady) {
        return res.status(500).json({ message: 'Database Error', error: 'FirebaseNotInitialized' });
    }
}

// Routes
app.get('/', (req, res) => res.sendFile(path.join(VIEWS_PATH, 'index.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(VIEWS_PATH, 'profile.html')));
app.get('/courses', (req, res) => res.json(courses));

// Register
app.post('/register', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const { name, lastName, phase, year, stream, subjects } = req.body; 
    const studentId = uuidv4(); 
    const fullName = `${name} ${lastName}`;

    const studentSubjects = subjects.map(s => ({
        name: s.name,
        totalSessions: parseInt(s.sessionCount, 10),
        completedSessions: 0, 
    }));

    try {
        await studentsRef.child(studentId).set({
            id: studentId, name: fullName, phase, year, stream, 
            subjects: studentSubjects, isActive: true, 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        }); 
        await db.ref(`attendance/${studentId}`).set({}); 
        const qrCodeUrl = await QRCode.toDataURL(studentId);
        res.status(201).json({ message: 'Success', studentId, qrCodeUrl });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed.' });
    }
});

// Get Students
app.get('/students', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    try {
        const snapshot = await studentsRef.once('value');
        res.json(snapshot.val() || {});
    } catch (error) { res.status(500).json({ message: 'Error fetching students' }); }
});

// Check-in (QR)
app.post('/check-in', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const { qrData } = req.body;
    let studentId = qrData.includes('id=') ? qrData.match(/id=([^&]+)/)[1] : qrData; // Simplified logic

    try {
        const student = (await studentsRef.child(studentId).once('value')).val();
        if (!student) return res.status(404).json({ message: 'Student not found.' });

        await db.ref(`attendance/${studentId}`).push({
            phase: student.phase, year: student.year, stream: student.stream,
            action: 'Check-in', timestamp: admin.database.ServerValue.TIMESTAMP
        });
        res.json({ message: `Welcome ${student.name}`, name: student.name });
    } catch (error) { res.status(500).json({ message: 'Check-in failed.' }); }
});

// Get Student Details
app.get('/student-details/:id', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    try {
        const student = (await studentsRef.child(req.params.id).once('value')).val();
        if (!student) return res.status(404).json({ message: 'Not found' });
        const attendance = (await db.ref(`attendance/${req.params.id}`).once('value')).val() || {};
        res.json({ student, attendance });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// --- UPDATED: Record Session with Payment ---
app.post('/record-session-attended/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;
    const { subjectName, isPaid } = req.body; // Receive Payment Status

    try {
        const studentRef = studentsRef.child(studentId);
        const student = (await studentRef.once('value')).val();
        if (!student) return res.status(404).json({ message: 'Student not found' });
        
        let sessionNumber = null;
        const updatedSubjects = student.subjects.map(s => {
            if (s.name === subjectName) {
                if (s.completedSessions < s.totalSessions) {
                    s.completedSessions += 1; 
                    sessionNumber = s.completedSessions;
                }
            }
            return s;
        });

        if (!sessionNumber) return res.status(400).json({ message: 'Max sessions reached or subject not found.' });
        
        // Log with Payment Status
        await db.ref(`attendance/${studentId}`).push().set({
            type: 'Session Registered',
            subject: subjectName,
            sessionNumber: sessionNumber,
            isPaid: isPaid, // Storing Payment Status
            action: `تسجيل حصة رقم ${sessionNumber} (${isPaid ? 'مدفوعة' : 'غير مدفوعة'})`,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        
        await studentRef.update({ subjects: updatedSubjects });
        res.json({ message: 'Session recorded', subjects: updatedSubjects });
    } catch (error) { res.status(500).json({ message: 'Error recording session' }); }
});

// Undo Session
app.post('/undo-session-attended/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;
    const { subjectName } = req.body; 

    try {
        const studentRef = studentsRef.child(studentId);
        const student = (await studentRef.once('value')).val();
        
        let sessionNumber = null; 
        const updatedSubjects = student.subjects.map(s => {
            if (s.name === subjectName && s.completedSessions > 0) {
                sessionNumber = s.completedSessions;
                s.completedSessions -= 1; 
            }
            return s;
        });

        if (!sessionNumber) return res.status(400).json({ message: 'No sessions to undo.' });
        
        await db.ref(`attendance/${studentId}`).push().set({
            type: 'Session Undone',
            subject: subjectName,
            sessionNumber: sessionNumber,
            action: `شطب الحصة رقم ${sessionNumber}`,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });

        await studentRef.update({ subjects: updatedSubjects });
        res.json({ message: 'Session undone', subjects: updatedSubjects });
    } catch (error) { res.status(500).json({ message: 'Error undoing session' }); }
});

// --- NEW: Add Subject to Existing Student ---
app.post('/add-subject/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res);
    const { studentId } = req.params;
    const { subjectName, sessionCount } = req.body;

    try {
        const studentRef = studentsRef.child(studentId);
        const student = (await studentRef.once('value')).val();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        let subjects = student.subjects || [];
        // Check if subject exists
        if (subjects.some(s => s.name === subjectName)) {
            return res.status(400).json({ message: 'المادة موجودة بالفعل.' });
        }

        subjects.push({
            name: subjectName,
            totalSessions: parseInt(sessionCount, 10),
            completedSessions: 0
        });

        await studentRef.update({ subjects });
        res.json({ message: 'Subject added successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to add subject' });
    }
});

// --- NEW: Add Sessions to Existing Subject ---
app.post('/add-sessions/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res);
    const { studentId } = req.params;
    const { subjectName, sessionsToAdd } = req.body;
    
    try {
        const studentRef = studentsRef.child(studentId);
        const student = (await studentRef.once('value')).val();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        let updated = false;
        const subjects = student.subjects.map(s => {
            if (s.name === subjectName) {
                s.totalSessions += parseInt(sessionsToAdd, 10);
                updated = true;
            }
            return s;
        });

        if (!updated) return res.status(400).json({ message: 'Subject not found' });

        await studentRef.update({ subjects });
        res.json({ message: 'Sessions added successfully' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to update sessions' });
    }
});

// Other Utilities (QR, Delete, etc.)
app.get('/qr-code/:id', async (req, res) => {
    try { res.json({ qrCodeUrl: await QRCode.toDataURL(req.params.id) }); }
    catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.delete('/attendance/:studentId/:attendanceId', async (req, res) => {
    try { await db.ref(`attendance/${req.params.studentId}/${req.params.attendanceId}`).remove(); res.json({message: 'Deleted'}); }
    catch(e) { res.status(500).json({message: 'Error'}); }
});

app.delete('/student/:studentId', async (req, res) => {
    try { await studentsRef.child(req.params.studentId).remove(); await db.ref(`attendance/${req.params.studentId}`).remove(); res.json({message:'Deleted'}); }
    catch(e) { res.status(500).json({message: 'Error'}); }
});
// --- أضف هذا الكود في server.js قبل السطر الأخير app.listen ---

// 1. مسار عرض صفحة الإحصائيات
app.get('/stats.html', (req, res) => res.sendFile(path.join(VIEWS_PATH, 'stats.html')));

// 2. API لجلب بيانات الإحصائيات الحقيقية
app.get('/api/dashboard-stats', async (req, res) => {
    if (!isFirebaseReady) return res.status(500).json({ message: 'Database not ready' });

    try {
        // جلب كل الطلاب
        const studentsSnapshot = await studentsRef.once('value');
        const students = studentsSnapshot.val() || {};

        // جلب كل سجلات الحضور
        const attendanceSnapshot = await db.ref('attendance').once('value');
        const attendanceData = attendanceSnapshot.val() || {};

        // --- معالجة البيانات ---
        let totalStudents = 0;
        let studentsByPhase = { "المرحلة الابتدائية": 0, "المرحلة المتوسطة": 0, "المرحلة الثانوية": 0 };
        
        // إحصائيات الطلاب
        Object.values(students).forEach(student => {
            if (student.isActive !== false) { // حساب الطلاب النشطين فقط
                totalStudents++;
                if (studentsByPhase[student.phase] !== undefined) {
                    studentsByPhase[student.phase]++;
                }
            }
        });

        // إحصائيات الحصص والمدفوعات (من سجل الحضور)
        let totalPaidSessions = 0;
        let totalUnpaidSessions = 0;
        let sessionsLast7Days = [0, 0, 0, 0, 0, 0, 0]; // [Today, Yesterday, ..., 6 days ago]
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        Object.values(attendanceData).forEach(studentRecords => {
            Object.values(studentRecords).forEach(record => {
                // حساب المدفوع وغير المدفوع
                if (record.type === 'Session Registered') {
                    if (record.isPaid === true) totalPaidSessions++;
                    else totalPaidSessions++; // افتراضاً نحسبها كإجمالي (أو يمكن فصلها إذا أردت حساب الديون)
                    
                    if (record.isPaid === false) totalUnpaidSessions++;
                }

                // حساب النشاط في آخر 7 أيام
                if (record.timestamp) {
                    const diffTime = today - new Date(record.timestamp).setHours(0,0,0,0);
                    const diffDays = Math.floor(diffTime / oneDay);
                    if (diffDays >= 0 && diffDays < 7) {
                        sessionsLast7Days[diffDays]++;
                    }
                }
            });
        });

        res.json({
            totalStudents,
            studentsByPhase,
            totalPaidSessions,
            totalUnpaidSessions,
            activityLastWeek: sessionsLast7Days.reverse() // لعرضها من الأقدم للأحدث
        });

    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: 'Error calculating stats' });
    }
});
// --- Login API ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (!correctPassword) {
        return res.status(500).json({ success: false, message: 'Server Config Error' });
    }

    if (password === correctPassword) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    }
});
// --- Change Password API ---
app.post('/api/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const currentPassword = process.env.ADMIN_PASSWORD;

    // 1. التحقق من كلمة المرور القديمة
    if (oldPassword !== currentPassword) {
        return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة قصيرة جداً' });
    }

    try {
        // 2. قراءة ملف .env
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        // 3. استبدال كلمة المرور القديمة بالجديدة (باستخدام Regex لضمان الدقة)
        // يبحث عن سطر يبدأ بـ ADMIN_PASSWORD= ويستبدله بالكامل
        const regex = /^ADMIN_PASSWORD=.*$/m;
        
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `ADMIN_PASSWORD=${newPassword}`);
        } else {
            // إذا لم يجد المتغير (نادر الحدوث)، يقوم بإضافته
            envContent += `\nADMIN_PASSWORD=${newPassword}`;
        }

        // 4. كتابة الملف وتحديث الذاكرة
        fs.writeFileSync(envPath, envContent);
        process.env.ADMIN_PASSWORD = newPassword; // تحديث فوري بدون إعادة تشغيل

        res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });

    } catch (error) {
        console.error('Error updating .env:', error);
        res.status(500).json({ success: false, message: 'فشل في تحديث ملف النظام' });
    }
});
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


