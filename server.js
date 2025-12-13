// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, 'views'); 

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

// =======================================================
// بيانات المواد الشاملة (حسب نظام الدراسة الجزائري) - مكتوبة بالكامل ومفصلة
// تم تغيير الهيكل ليتناسب مع التسلسل: المرحلة -> السنة -> الشعبة -> المواد
// =======================================================
const courses = {
    "المرحلة الابتدائية": {
        "السنة الأولى ابتدائي": {
            "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية فنية", "تربية بدنية"]
        },
        "السنة الثانية ابتدائي": {
            "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية فنية", "تربية بدنية"]
        },
        "السنة الثالثة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية", "تربية بدنية"]
        },
        "السنة الرابعة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية", "تربية بدنية"]
        },
        "السنة الخامسة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية", "تربية بدنية"]
        }
    },
    "المرحلة المتوسطة": {
        "السنة الأولى متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "فيزياء وتكنولوجيا", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية", "تربية فنية", "تربية بدنية", "إعلام آلي"]
        },
        "السنة الثانية متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "فيزياء وتكنولوجيا", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية", "تربية فنية", "تربية بدنية", "إعلام آلي"]
        },
        "السنة الثالثة متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "فيزياء وتكنولوجيا", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية", "تربية فنية", "تربية بدنية", "إعلام آلي"]
        },
        "السنة الرابعة متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "فيزياء وتكنولوجيا", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية", "تربية فنية", "تربية بدنية", "إعلام آلي"]
        }
    },
    "المرحلة الثانوية": {
        "السنة الأولى ثانوي": {
            "جذع مشترك علوم وتكنولوجيا": ["لغة عربية", "رياضيات", "فيزياء", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "فلسفة", "لغة فرنسية", "لغة إنجليزية", "تربية بدنية"],
            "جذع مشترك آداب": ["لغة عربية", "تاريخ وجغرافيا", "فلسفة", "رياضيات", "لغة فرنسية", "لغة إنجليزية", "تربية إسلامية", "تربية بدنية"]
        },
        "السنة الثانية ثانوي": {
            "شعبة علوم تجريبية": ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة رياضيات": ["رياضيات متقدمة", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تقني رياضي": ["رياضيات", "فيزياء", "تكنولوجيا", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تسيير واقتصاد": ["القانون", "المحاسبة والمالية", "الاقتصاد والمناجمنت", "الرياضيات", "التاريخ والجغرافيا", "اللغة العربية", "اللغة الفرنسية", "اللغة الإنجليزية"], // المواد المتخصصة المطلوبة
            "شعبة آداب وفلسفة": ["فلسفة", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة لغات أجنبية": ["لغة أجنبية 1 (فرنسية)", "لغة أجنبية 2 (إنجليزية)", "لغة أجنبية 3 (إسبانية)", "فلسفة", "لغة عربية", "تاريخ وجغرافيا"] // إضافة الإسبانية
        },
        "السنة الثالثة ثانوي": { // (البكالوريا)
            "شعبة علوم تجريبية": ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة رياضيات": ["رياضيات متقدمة", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تقني رياضي": ["رياضيات", "فيزياء", "تكنولوجيا", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تسيير واقتصاد": ["القانون", "المحاسبة والمالية", "الاقتصاد والمناجمنت", "الرياضيات", "التاريخ والجغرافيا", "اللغة العربية", "اللغة الفرنسية", "اللغة الإنجليزية"],
            "شعبة آداب وفلسفة": ["فلسفة", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة لغات أجنبية": ["لغة أجنبية 1 (فرنسية)", "لغة أجنبية 2 (إنجليزية)", "لغة أجنبية 3 (إسبانية)", "فلسفة", "لغة عربية", "تاريخ وجغرافيا"]
        }
    }
};
// =======================================================


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

    const studentId = uuidv4(); 
    const { name, phase, year, stream, subjects } = req.body; 

    if (!name || !phase || !year || !stream || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الرجاء توفير اسم الطالب والمرحلة والسنة والشعبة والمواد المختارة.' });
    }

    try {
        const studentData = {
            id: studentId,
            name: name,
            phase: phase,      
            year: year,        
            stream: stream,    
            subjects: subjects, // مصفوفة بأسماء المواد التي اختارها الطالب
            isActive: true, 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await studentsRef.child(studentId).set(studentData); 

        // إنشاء سجل حضور فارغ
        await db.ref(`attendance/${studentId}`).set({}); 

        const qrData = `/profile.html?id=${studentId}`; 
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
            phase: student.phase,
            year: student.year,
            stream: student.stream,
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

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
