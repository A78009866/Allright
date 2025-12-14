// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 

// 1. استخدام dotenv لقراءة متغيرات البيئة محلياً
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, 'views'); 

// Middleware
app.use(bodyParser.json());
// لخدمة ملفات HTML و CSS و JS من مجلد views
app.use(express.static(VIEWS_PATH)); 


// --- تهيئة Firebase Admin SDK ---
let db;
let studentsRef;
let isFirebaseReady = false; 

try {
    if (!admin.apps.length) { 
        const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
        const databaseURL = process.env.FIREBASE_DATABASE_URL;

        if (!serviceAccountJson || !databaseURL) {
            console.error("Critical: Missing Firebase environment variables. Please ensure SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL are set in your environment or a .env file.");
        } else {
            try {
                const cleanJsonString = serviceAccountJson.replace(/^[\"]+|[\"]+$/g, '');
                const serviceAccount = JSON.parse(cleanJsonString);

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: databaseURL
                });
                console.log("Firebase Admin SDK initialized successfully.");
                
                db = admin.database();
                studentsRef = db.ref('students');
                isFirebaseReady = true;
            } catch (jsonError) {
                 console.error("Critical: Failed to parse SERVICE_ACCOUNT_KEY JSON. Ensure it is a valid, unescaped JSON string in the environment variable.", jsonError.message);
            }
        }
    }
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK (CRITICAL):", error.message);
}


// =======================================================
// بيانات المواد الشاملة (حسب نظام الدراسة الجزائري) - كاملة
// =======================================================
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
// =======================================================


function checkFirebaseReadiness(res) {
    if (!isFirebaseReady) {
        return res.status(500).json({ 
            message: 'خطأ في تهيئة الخادم. يرجى التأكد من أن متغيرات بيئة Firebase مضبوطة بشكل صحيح في ملف .env أو إعدادات النشر.',
            error: 'FirebaseNotInitialized'
        });
    }
}


// --- مسارات عرض الملفات ---
app.get('/', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'index.html'));
});

app.get('/status.html', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'status.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'profile.html'));
});


// --- مسارات API لـ CRUD ---
// 1. نقطة نهاية جلب قائمة المواد 
app.get('/courses', (req, res) => {
    res.json(courses);
});


// 2. نقطة نهاية تسجيل طالب جديد (محدثة لدعم عدد الحصص)
app.post('/register', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const { name, lastName, phase, year, stream, subjects } = req.body; 
    const studentId = uuidv4(); 
    const fullName = `${name} ${lastName}`;

    if (!fullName || !phase || !year || !stream || !subjects || !Array.isArray(subjects) || subjects.length === 0 || 
        !subjects.every(s => s.name && s.sessionCount !== undefined && s.sessionCount > 0)) {
        return res.status(400).json({ message: 'الرجاء توفير جميع بيانات الطالب وتحديد المواد وعدد الحصص الكلي لكل مادة.' });
    }

    const studentSubjects = subjects.map(s => ({
        name: s.name,
        totalSessions: parseInt(s.sessionCount, 10),
        completedSessions: 0, 
    }));

    try {
        const studentData = {
            id: studentId,
            name: fullName,
            phase: phase,      
            year: year,        
            stream: stream,    
            subjects: studentSubjects, 
            isActive: true, 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await studentsRef.child(studentId).set(studentData); 
        await db.ref(`attendance/${studentId}`).set({}); 

        // استخدام مُعرِّف الطالب النظيف لرمز QR
        const qrData = studentId; 
        const qrCodeUrl = await QRCode.toDataURL(qrData);

        res.status(201).json({
            message: 'تم تسجيل الطالب بنجاح',
            studentId: studentId,
            qrCodeUrl: qrCodeUrl
        });

    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ message: 'فشل التسجيل الداخلي.' });
    }
});


// 3. نقطة نهاية جلب جميع الطلاب
app.get('/students', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    
    try {
        const snapshot = await studentsRef.once('value');
        const students = snapshot.val() || {};
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'فشل في جلب بيانات الطلاب.' });
    }
});

// 4. نقطة نهاية فحص وتحديث حالة الطالب (مسح QR code) 
app.post('/check-in', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const { qrData } = req.body;
    
    // منطق قوي لاستخلاص مُعرِّف الطالب (UUID) من محتوى رمز QR
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let studentId = null;

    if (uuidRegex.test(qrData)) {
        studentId = qrData;
    } else {
         const studentIdMatch = qrData.match(/id=([^&]+)/);
         const extractedId = studentIdMatch ? studentIdMatch[1] : null;

         if (extractedId && uuidRegex.test(extractedId)) {
            studentId = extractedId;
         }
    }

    if (!studentId) {
        return res.status(400).json({ message: 'رمز QR غير صالح أو غير معرّف.' });
    }
    
    try {
        const studentSnapshot = await studentsRef.child(studentId).once('value');
        const student = studentSnapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }

        const attendanceRef = db.ref(`attendance/${studentId}`).push();
        await attendanceRef.set({
            phase: student.phase || 'N/A', 
            year: student.year || 'N/A',
            stream: student.stream || 'N/A',
            action: 'Check-in',
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        
        res.json({
            message: `تم تسجيل حضور ${student.name} بنجاح.`,
            name: student.name,
            isActive: student.isActive 
        });

    } catch (error) {
        console.error('Error checking in:', error);
        res.status(500).json({ message: 'فشل داخلي في تسجيل الحضور.' });
    }
});


// 5. نقطة نهاية لجلب بيانات طالب واحد مع سجل الحضور
app.get('/student-details/:id', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const studentId = req.params.id;

    try {
        const studentSnapshot = await studentsRef.child(studentId).once('value');
        const studentData = studentSnapshot.val();

        if (!studentData) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        const attendanceRef = db.ref(`attendance/${studentId}`);
        const attendanceSnapshot = await attendanceRef.once('value');
        const attendanceData = attendanceSnapshot.val() || {};

        res.json({
            student: studentData,
            attendance: attendanceData
        });

    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ message: 'فشل في جلب بيانات الطالب' });
    }
});

// 6. نقطة نهاية تسجيل حصة مكتملة (إداري - زيادة العداد وتسجيل الحضور) - مُعدّل
app.post('/record-session-attended/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;
    const { subjectName } = req.body; 

    if (!subjectName) {
        return res.status(400).json({ message: 'الرجاء توفير اسم المادة.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const snapshot = await studentRef.once('value');
        const student = snapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }
        
        let updated = false;
        let sessionNumber = null;

        const updatedSubjects = student.subjects.map(s => {
            if (s.name === subjectName) {
                if (s.completedSessions < s.totalSessions) {
                    s.completedSessions += 1; 
                    sessionNumber = s.completedSessions; // رقم الحصة الجديدة
                    updated = true;
                } else {
                    return res.status(400).json({ message: `تم بالفعل إكمال جميع حصص مادة ${subjectName}.` });
                }
            }
            return s;
        });

        if (!updated) {
             return res.status(404).json({ message: `المادة ${subjectName} غير مسجلة للطالب.` });
        }
        
        // 🌟 الخطوة الهامة: تسجيل العملية في سجل الحضور
        if (sessionNumber !== null) {
            await db.ref(`attendance/${studentId}`).push().set({
                type: 'Session Registered',
                subject: subjectName,
                sessionNumber: sessionNumber,
                action: `تم تسجيل الحصة رقم ${sessionNumber}`,
                timestamp: admin.database.ServerValue.TIMESTAMP
            });
        }
        // 🌟 نهاية الخطوة الهامة
        
        await studentRef.update({ subjects: updatedSubjects });
        
        res.json({
            message: `تم تسجيل حصة مكتملة جديدة بنجاح لمادة ${subjectName}. الحصة رقم ${sessionNumber}.`,
            subjects: updatedSubjects
        });

    } catch (error) {
        console.error('Error recording session:', error);
        res.status(500).json({ message: 'فشل داخلي في تسجيل الحصة.' });
    }
});


// 7. نقطة نهاية التراجع عن حصة مكتملة (إداري - إنقاص العداد وتسجيل الشطب) - مُعدّل
app.post('/undo-session-attended/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;
    const { subjectName } = req.body; 

    if (!subjectName) {
        return res.status(400).json({ message: 'الرجاء توفير اسم المادة.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const snapshot = await studentRef.once('value');
        const student = snapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }
        
        let updated = false;
        let sessionNumber = null; 

        const updatedSubjects = student.subjects.map(s => {
            if (s.name === subjectName) {
                if (s.completedSessions > 0) {
                    sessionNumber = s.completedSessions; // رقم الحصة التي سيتم شطبها
                    s.completedSessions -= 1; 
                    updated = true;
                } else {
                    return res.status(400).json({ message: `لا توجد حصص مكتملة يمكن التراجع عنها لمادة ${subjectName}.` });
                }
            }
            return s;
        });

        if (!updated) {
             return res.status(404).json({ message: `المادة ${subjectName} غير مسجلة للطالب.` });
        }
        
        // 🌟 الخطوة الهامة: تسجيل العملية في سجل الحضور
        if (sessionNumber !== null) {
            await db.ref(`attendance/${studentId}`).push().set({
                type: 'Session Undone',
                subject: subjectName,
                sessionNumber: sessionNumber,
                action: `تم شطب الحصة رقم ${sessionNumber}`,
                timestamp: admin.database.ServerValue.TIMESTAMP
            });
        }
        // 🌟 نهاية الخطوة الهامة

        await studentRef.update({ subjects: updatedSubjects });
        
        res.json({
            message: `تم التراجع عن تسجيل الحصة رقم ${sessionNumber} لمادة ${subjectName}.`,
            subjects: updatedSubjects
        });

    } catch (error) {
        console.error('Error undoing session:', error);
        res.status(500).json({ message: 'فشل داخلي في التراجع عن الحصة.' });
    }
});


// 8. نقطة نهاية لجلب QR Code للطالب
app.get('/qr-code/:id', async (req, res) => {
    const studentId = req.params.id;
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    try {
        const qrData = studentId; 
        const qrCodeUrl = await QRCode.toDataURL(qrData);
        res.json({ qrCodeUrl });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ message: 'فشل في توليد رمز QR.' });
    }
});

// 9. نقطة نهاية لحذف سجل حضور (Check-in/Check-out)
app.delete('/attendance/:studentId/:attendanceId', async (req, res) => {
    const { studentId, attendanceId } = req.params;
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    try {
        await db.ref(`attendance/${studentId}/${attendanceId}`).remove();
        res.status(200).json({ message: 'تم حذف سجل الحضور بنجاح.' });
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        res.status(500).json({ message: 'فشل داخلي في حذف السجل.' });
    }
});

// 10. نقطة نهاية لحذف طالب بالكامل
app.delete('/student/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;

    try {
        // حذف بيانات الطالب الأساسية
        await studentsRef.child(studentId).remove();
        // حذف سجل الحضور المرتبط
        await db.ref(`attendance/${studentId}`).remove();

        res.status(200).json({ message: 'تم حذف الطالب وسجل حضوره بنجاح.' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'فشل داخلي في حذف الطالب.' });
    }
});

// 11. نقطة نهاية لتعطيل حالة الطالب (للاستخدام في منطق profile.html)
app.post('/deactivate-student/:studentId', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 
    const studentId = req.params.studentId;

    try {
        const studentRef = studentsRef.child(studentId);
        await studentRef.update({ isActive: false });

        res.status(200).json({ message: 'تم تعطيل حالة الطالب بنجاح.' });
    } catch (error) {
        console.error('Error deactivating student:', error);
        res.status(500).json({ message: 'فشل داخلي في تعطيل حالة الطالب.' });
    }
});


// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
