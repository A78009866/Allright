// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// لا نحتاج لـ require('dotenv').config() في بيئة Vercel حيث يتم جلب المتغيرات تلقائيًا.

const app = express();
const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, 'views'); 

// Middleware
app.use(bodyParser.json());

// --- تهيئة Firebase Admin SDK ---
let db;
let studentsRef;
let isFirebaseReady = false;

try {
    // التحقق لمنع إعادة التهيئة في بيئات الاختبار
    if (!admin.apps.length) { 
        // جلب المفتاح كـ JSON String من متغير البيئة في Vercel
        const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
        const databaseURL = process.env.FIREBASE_DATABASE_URL;

        if (!serviceAccountJson) {
            throw new Error("SERVICE_ACCOUNT_KEY environment variable is missing.");
        }
        if (!databaseURL) {
            throw new Error("FIREBASE_DATABASE_URL environment variable is missing.");
        }

        // تنظيف وتحليل سلسلة JSON
        const cleanJsonString = serviceAccountJson.replace(/^[\"]+|[\"]+$/g, '');
        const serviceAccount = JSON.parse(cleanJsonString);

        // تهيئة Firebase
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
        });
        console.log("Firebase Admin SDK initialized successfully.");
    }
    
    // تعريف المراجع بعد التأكد من التهيئة
    db = admin.database();
    studentsRef = db.ref('students');
    isFirebaseReady = true;

} catch (error) {
    console.error('Firebase Initialization Error (CRITICAL):', error.message);
    // إذا فشلت التهيئة، يجب أن نبدأ الخادم، ولكن يجب أن تقوم نقاط النهاية بالتحقق
    // في بيئة Serverless، هذا يؤدي إلى الفشل 500، لذلك يجب على المستخدم ضبط المتغيرات.
    
    // لضمان استجابة بسيطة في حال فشل التهيئة قبل البدء
    if (error.message.includes("SERVICE_ACCOUNT_KEY")) {
         console.error(">>> FIX REQUIRED: Please set SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL environment variables on Vercel. <<<");
    }
}

// بيانات المواد الشاملة (لجميع المراحل والسنوات والشعب)
const courses = {
    "الثانوية": [
        { subject: "الرياضيات", level: "ثانوي", year: "أولى", stream: "علمي" },
        { subject: "الفيزياء", level: "ثانوي", year: "أولى", stream: "علمي" },
        { subject: "الكيمياء", level: "ثانوي", year: "أولى", stream: "علمي" },
        { subject: "الأحياء", level: "ثانوي", year: "أولى", stream: "علمي" },
        { subject: "اللغة العربية", level: "ثانوي", year: "أولى", stream: "أدبي" },
        { subject: "التاريخ", level: "ثانوي", year: "أولى", stream: "أدبي" },
        { subject: "الجغرافيا", level: "ثانوي", year: "أولى", stream: "أدبي" },
        
        { subject: "اللغة الإنجليزية", level: "ثانوي", year: "ثانية", stream: "علمي" },
        { subject: "الحاسوب", level: "ثانوي", year: "ثانية", stream: "علمي" },
        { subject: "الرياضيات المتقدمة", level: "ثانوي", year: "ثانية", stream: "علمي" },
        { subject: "الفلسفة", level: "ثانوي", year: "ثانية", stream: "أدبي" },
        { subject: "الاقتصاد", level: "ثانوي", year: "ثانية", stream: "أدبي" },
        
        { subject: "الرياضيات العليا", level: "ثانوي", year: "ثالثة", stream: "علمي" },
        { subject: "الفيزياء المتقدمة", level: "ثانوي", year: "ثالثة", stream: "علمي" },
        { subject: "علم الاجتماع", level: "ثانوي", year: "ثالثة", stream: "أدبي" }
    ],
    "الإعدادية": [
        { subject: "العلوم", level: "إعدادي", year: "أولى", stream: "" },
        { subject: "الرياضيات", level: "إعدادي", year: "أولى", stream: "" },
        { subject: "اللغة العربية", level: "إعدادي", year: "ثانية", stream: "" },
        { subject: "اللغة الفرنسية", level: "إعدادي", year: "ثانية", stream: "" },
        { subject: "الفيزياء", level: "إعدادي", year: "ثالثة", stream: "" },
        { subject: "التاريخ والجغرافيا", level: "إعدادي", year: "ثالثة", stream: "" }
    ],
    "الابتدائية": [
        { subject: "القراءة والكتابة", level: "ابتدائي", year: "أولى", stream: "" },
        { subject: "الحساب", level: "ابتدائي", year: "ثانية", stream: "" },
        { subject: "التربية الإسلامية", level: "ابتدائي", year: "ثالثة", stream: "" }
    ]
};

// وظيفة مساعدة للتحقق من جاهزية Firebase قبل تنفيذ أي عملية قاعدة بيانات
function checkFirebaseReadiness(res) {
    if (!isFirebaseReady) {
        return res.status(500).json({ 
            message: 'خطأ في تهيئة الخادم. الرجاء التأكد من ضبط متغيرات بيئة Firebase (SERVICE_ACCOUNT_KEY و FIREBASE_DATABASE_URL).',
            error: 'FirebaseNotInitialized'
        });
    }
}

// 1. نقطة نهاية لخدمة ملف index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// نقطة نهاية لخدمة ملف profile.html 
app.get('/profile.html', (req, res) => {
    // يجب أن يكون ملف profile.html في نفس مسار server.js أو في مجلد views إن كنت تستخدمه
    res.sendFile(path.join(__dirname, 'profile.html')); 
});

// نقطة نهاية لجلب قائمة المواد (لـ index.html)
app.get('/courses', (req, res) => {
    res.json(courses);
});

// نقطة نهاية لجلب قائمة الطلاب
app.get('/students', async (req, res) => {
    if (checkFirebaseReadiness(res)) return;

    try {
        const snapshot = await studentsRef.once('value');
        res.json(snapshot.val() || {});
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'فشل داخلي في جلب البيانات.' });
    }
});

// [تحديث] 2. نقطة نهاية لإضافة طالب جديد
app.post('/add-student', async (req, res) => {
    if (checkFirebaseReadiness(res)) return;

    const studentId = uuidv4();
    const { name, selectedSubjects } = req.body; 

    if (!name || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
        return res.status(400).json({ message: 'الاسم والمواد المختارة مطلوبة (يجب اختيار مادة واحدة على الأقل).' });
    }

    try {
        const validSubjects = selectedSubjects.map(sub => {
            const sessionsCount = parseInt(sub.sessionsCount) || 1; 
            return {
                subject: sub.subject,
                level: sub.level,
                year: sub.year,
                stream: sub.stream || '',
                sessionsCount: sessionsCount // عدد الحصص الذي تم إدخاله
            };
        });

        const studentData = {
            name: name,
            isActive: true, // يبدأ الطالب بنشاط
            registrationDate: Date.now(),
            subjects: validSubjects, 
        };

        await studentsRef.child(studentId).set(studentData);

        // إنشاء سجل حضور فارغ لكل طالب
        const attendanceData = {};
        await db.ref(`attendance/${studentId}`).set(attendanceData);

        // توليد رمز QR
        const qrCodeData = `https://qr.example.com/student/${studentId}`; 
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);

        res.status(201).json({ 
            message: `تم تسجيل الطالب ${name} بنجاح.`,
            id: studentId,
            qrCode: qrCodeImage,
            studentData: studentData
        });

    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'فشل داخلي في التسجيل.' });
    }
});


// [تحديث] 3. نقطة نهاية لتفحص حالة الحضور (Check-in)
app.post('/check-in', async (req, res) => {
    if (checkFirebaseReadiness(res)) return;

    const { qrData } = req.body;
    
    // استخراج studentId من بيانات QR
    const studentIdMatch = qrData.match(/\/student\/([^/]+)$/);
    const studentId = studentIdMatch ? studentIdMatch[1] : null;

    if (!studentId) {
        return res.status(400).json({ message: 'رمز QR غير صالح أو غير معرّف.' });
    }

    try {
        const studentSnapshot = await studentsRef.child(studentId).once('value');
        const student = studentSnapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير مسجل في النظام.' });
        }

        if (!student.isActive) {
            return res.status(403).json({ 
                message: `حساب الطالب ${student.name} غير نشط أو انتهت صلاحيته.`, 
                status: 'inactive',
                name: student.name
            });
        }
        
        const attendanceSnapshot = await db.ref(`attendance/${studentId}`).once('value');
        const attendance = attendanceSnapshot.val() || {};
        
        // حساب عدد مرات الحضور لكل مادة
        const subjectAttendanceCounts = {};
        Object.values(attendance).forEach(entry => {
            const key = `${entry.subject}-${entry.level}-${entry.stream || ''}`;
            subjectAttendanceCounts[key] = (subjectAttendanceCounts[key] || 0) + 1;
        });

        // التحقق مما إذا كانت أي مادة لم تكتمل حصصها
        const uncompletedSubject = student.subjects.find(sub => {
            const key = `${sub.subject}-${sub.level}-${sub.stream || ''}`;
            const attendedSessions = subjectAttendanceCounts[key] || 0;
            return attendedSessions < sub.sessionsCount; // الحصص المكتملة < الإجمالي
        });

        if (!uncompletedSubject) {
            // إذا كان الطالب قد أكمل جميع حصصه في جميع مواده، قم بتغيير حالته إلى غير نشط
            await studentsRef.child(studentId).update({ isActive: false });
            return res.status(403).json({ 
                message: `تم إنهاء جميع الحصص للطالب ${student.name}، وتم تعطيل حسابه. (انتهت صلاحية QR)`, 
                status: 'expired',
                name: student.name
            });
        }
        
        // تسجيل الحضور في أول مادة غير مكتملة
        const timestamp = Date.now().toString();
        const currentSubject = uncompletedSubject;

        const attendanceEntry = {
            subject: currentSubject.subject,
            level: currentSubject.level,
            stream: currentSubject.stream || '',
            status: 'present', 
            date: new Date().toISOString()
        };

        await db.ref(`attendance/${studentId}/${timestamp}`).set(attendanceEntry);

        res.json({
            message: `تم تسجيل حضور ${student.name} بنجاح في مادة ${currentSubject.subject}.`,
            name: student.name,
            status: 'present',
            subject: currentSubject.subject,
            attended: (subjectAttendanceCounts[`${currentSubject.subject}-${currentSubject.level}-${currentSubject.stream || ''}`] || 0) + 1,
            total: currentSubject.sessionsCount
        });

    } catch (error) {
        console.error('Error processing check-in:', error);
        res.status(500).json({ message: 'فشل داخلي في تسجيل الحضور.' });
    }
});


// [تحديث] 4. نقطة نهاية لجلب بيانات طالب واحد مع سجل الحضور
app.get('/student-details/:id', async (req, res) => {
    if (checkFirebaseReadiness(res)) return;

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

        const subjectAttendanceCounts = {};
        Object.values(attendanceData).forEach(entry => {
            const key = `${entry.subject}-${entry.level}-${entry.stream || ''}`;
            subjectAttendanceCounts[key] = (subjectAttendanceCounts[key] || 0) + 1;
        });

        // توليد رمز QR الآن لتمريره إلى الواجهة
        const qrCodeData = `https://qr.example.com/student/${studentId}`;
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);


        res.json({
            student: studentData,
            attendance: attendanceData,
            attendanceCounts: subjectAttendanceCounts,
            qrCode: qrCodeImage 
        });

    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ message: 'فشل في جلب بيانات الطالب' });
    }
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
