// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // تضمين UUID لإنشاء معرفات فريدة

const app = express();
const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, 'views'); // تحديد مسار مجلد views

// Middleware
app.use(bodyParser.json());

// --- FIX: استخدام express.static لخدمة الملفات الثابتة من مجلد views ---
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
            console.error("Missing Firebase environment variables. API calls will fail.");
        } else {
            // تنظيف وازالة أي علامات اقتباس محيطة
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
        }
    }
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK (CRITICAL):", error.message);
}

// بيانات المواد الشاملة (لجميع المراحل والسنوات والشعب) - مكتوبة بالكامل
const courses = {
    "المرحلة الثانوية": [
        { subject: "الرياضيات المتقدمة", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة العلمية" },
        { subject: "الفيزياء", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة العلمية" },
        { subject: "الكيمياء", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة العلمية" },
        { subject: "الأحياء", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة العلمية" },
        
        { subject: "اللغة العربية", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة الأدبية" },
        { subject: "التاريخ", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة الأدبية" },
        { subject: "الجغرافيا", level: "ثانوي", year: "السنة الأولى", stream: "الشعبة الأدبية" },
        
        { subject: "اللغة الإنجليزية", level: "ثانوي", year: "السنة الثانية", stream: "الشعبة العلمية" },
        { subject: "الحاسوب وتكنولوجيا المعلومات", level: "ثانوي", year: "السنة الثانية", stream: "الشعبة العلمية" },
        { subject: "الرياضيات التحليلية", level: "ثانوي", year: "السنة الثانية", stream: "الشعبة العلمية" },
        
        { subject: "الفلسفة والمنطق", level: "ثانوي", year: "السنة الثانية", stream: "الشعبة الأدبية" },
        { subject: "الاقتصاد", level: "ثانوي", year: "السنة الثانية", stream: "الشعبة الأدبية" },
        
        { subject: "الرياضيات العليا والتفاضل", level: "ثانوي", year: "السنة الثالثة", stream: "الشعبة العلمية" },
        { subject: "الفيزياء الحديثة", level: "ثانوي", year: "السنة الثالثة", stream: "الشعبة العلمية" },
        { subject: "علم الاجتماع والنفس", level: "ثانوي", year: "السنة الثالثة", stream: "الشعبة الأدبية" }
    ],
    "المرحلة الإعدادية": [
        { subject: "العلوم العامة", level: "إعدادي", year: "السنة الأولى", stream: "عامة" },
        { subject: "الرياضيات الأساسية", level: "إعدادي", year: "السنة الأولى", stream: "عامة" },
        { subject: "اللغة العربية والقواعد", level: "إعدادي", year: "السنة الثانية", stream: "عامة" },
        { subject: "اللغة الفرنسية", level: "إعدادي", year: "السنة الثانية", stream: "عامة" },
        { subject: "الفيزياء والكيمياء", level: "إعدادي", year: "السنة الثالثة", stream: "عامة" },
        { subject: "التاريخ والجغرافيا", level: "إعدادي", year: "السنة الثالثة", stream: "عامة" }
    ],
    "المرحلة الابتدائية": [
        { subject: "القراءة والكتابة والخط", level: "ابتدائي", year: "السنة الأولى", stream: "عامة" },
        { subject: "الحساب والأرقام", level: "ابتدائي", year: "السنة الثانية", stream: "عامة" },
        { subject: "التربية الإسلامية", level: "ابتدائي", year: "السنة الثالثة", stream: "عامة" }
    ]
};

// وظيفة مساعدة للتحقق من جاهزية Firebase
function checkFirebaseReadiness(res) {
    if (!isFirebaseReady) {
        return res.status(500).json({ 
            message: 'خطأ في تهيئة الخادم. الرجاء التأكد من ضبط متغيرات بيئة Firebase (SERVICE_ACCOUNT_KEY و FIREBASE_DATABASE_URL).',
            error: 'FirebaseNotInitialized'
        });
    }
}


// ---------------------------
// --- مسارات عرض الملفات ---
// ---------------------------

// عرض index.html كصفحة رئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'index.html'));
});

// ---------------------------
// --- مسارات API لـ CRUD ---
// ---------------------------

// 1. نقطة نهاية جلب قائمة المواد (البيانات المطلوبة)
app.get('/courses', (req, res) => {
    res.json(courses);
});


// 2. نقطة نهاية تسجيل طالب جديد
app.post('/register', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const studentId = uuidv4(); // استخدام uuidv4 لتوليد ID
    const { name, subjects } = req.body;

    if (!name || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الرجاء توفير اسم الطالب والمواد المختارة.' });
    }

    try {
        const studentData = {
            id: studentId,
            name: name,
            subjects: subjects, // يفترض أن subjects هي مصفوفة من أسماء المواد
            isActive: true, 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await studentsRef.child(studentId).set(studentData); // استخدام studentId المولد

        // إنشاء سجل حضور فارغ
        await db.ref(`attendance/${studentId}`).set({}); 

        const qrData = `/profile.html?id=${studentId}`; // تغيير المسار ليتناسب مع ملفك
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

// 4. نقطة نهاية فحص وتحديث حالة الطالب (مسح QR code) - تم تعديلها لتكون أكثر مرونة
app.post('/check-in', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const { qrData } = req.body;
    
    // استخراج studentId من بيانات QR (إذا كانت على شكل /profile.html?id=...)
    const studentIdMatch = qrData.match(/id=([^&]+)/);
    const studentId = studentIdMatch ? studentIdMatch[1] : null;

    if (!studentId) {
        return res.status(400).json({ message: 'رمز QR غير صالح أو غير معرّف.' });
    }
    
    try {
        const studentSnapshot = await studentsRef.child(studentId).once('value');
        const student = studentSnapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }

        // تسجيل الحضور
        const attendanceRef = db.ref(`attendance/${studentId}`).push();
        await attendanceRef.set({
            subject: 'غير محدد (تم تسجيل حضور عام)', 
            action: 'Check-in',
            timestamp: admin.database.ServerValue.TIMESTAMP
        });

        res.json({
            message: `تم تسجيل حضور ${student.name} بنجاح.`,
            name: student.name,
            isActive: student.isActive // إرجاع الحالة الحالية
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

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
