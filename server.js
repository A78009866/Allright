// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // إضافة uuidv4 لإنشاء معرفات فريدة

// تحميل متغيرات البيئة من ملف .env (إذا كنت تستخدمه محليًا)
// require('dotenv').config(); // هذا الكود يجب إزالته أو تركه معطّلاً عند النشر على Vercel

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
        // استخدام متغيرات البيئة مباشرةً كما يجب في بيئات الإنتاج (مثل Vercel)
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


// =======================================================
// بيانات المواد الشاملة (حسب نظام الدراسة الجزائري) - مفصلة
// الهيكل: المرحلة (Phase) -> السنة (Year) -> الشعبة (Stream) -> المواد (Subjects)
// =======================================================
const courses = {
    "المرحلة الابتدائية": {
        "السنة الأولى ابتدائي": {
            "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية فنية", "تربية بدنية"]
        },
        "السنة الثالثة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية"]
        },
        "السنة الخامسة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "علوم طبيعية"]
        }
    },
    "المرحلة المتوسطة": {
        "السنة الأولى متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "إعلام آلي"]
        },
        "السنة الرابعة متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية"]
        }
    },
    "المرحلة الثانوية": {
        "السنة الأولى ثانوي": {
            "جذع مشترك علوم وتكنولوجيا": ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "جذع مشترك آداب": ["لغة عربية", "تاريخ وجغرافيا", "فلسفة", "لغة فرنسية", "لغة إنجليزية", "علوم إسلامية"]
        },
        "السنة الثانية ثانوي": {
            "شعبة علوم تجريبية": ["علوم طبيعية", "فيزياء", "رياضيات", "لغة عربية", "فلسفة", "لغة فرنسية", "لغة إنجليزية"],
            "شعبة تسيير واقتصاد": ["المحاسبة والمالية", "القانون", "الاقتصاد والمناجمنت", "الرياضيات", "التاريخ والجغرافيا", "لغة عربية", "لغة فرنسية", "لغة إنجليزية"], // المواد المتخصصة المطلوبة
            "شعبة لغات أجنبية": ["لغة أجنبية 1 (فرنسية)", "لغة أجنبية 2 (إنجليزية)", "لغة أجنبية 3 (إسبانية)", "فلسفة", "لغة عربية", "تاريخ وجغرافيا"] // إضافة الإسبانية
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

// عرض status.html عند مسح QR code
app.get('/status.html', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'status.html'));
});

// عرض profile.html لملف الطالب
app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(VIEWS_PATH, 'profile.html'));
});


// ---------------------------
// --- مسارات API لـ CRUD ---
// ---------------------------

// 1. نقطة نهاية جلب قائمة المواد (البيانات المطلوبة)
app.get('/courses', (req, res) => {
    res.json(courses);
});


// 2. نقطة نهاية تسجيل طالب جديد
// تم تحديثها لاستقبال المرحلة، السنة، والشعبة
app.post('/register', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const { name, phase, year, stream, subjects } = req.body; 
    const studentId = uuidv4(); 

    if (!name || !phase || !year || !stream || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الرجاء توفير اسم الطالب والمرحلة والسنة والشعبة والمواد المختارة.' });
    }

    try {
        const studentData = {
            id: studentId,
            name: name,
            phase: phase,      // مثال: "المرحلة الثانوية"
            year: year,        // مثال: "السنة الثالثة ثانوي (بكالوريا)"
            stream: stream,    // مثال: "شعبة تسيير واقتصاد"
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
            phase: student.phase || 'N/A', // استخدام البيانات الجديدة
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


// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
