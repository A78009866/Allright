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
            console.error("Missing Firebase environment variables. API calls will fail. Check SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL.");
        } else {
            // معالجة سلسلة JSON وتجربة التحليل
            try {
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
            } catch (jsonError) {
                 console.error("Failed to parse SERVICE_ACCOUNT_KEY JSON. Ensure it is a valid, unescaped JSON string in the environment variable.", jsonError.message);
            }
        }
    }
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK (CRITICAL):", error.message);
}


// =======================================================
// بيانات المواد الشاملة (حسب نظام الدراسة الجزائري) - مفصلة وكاملة
// =======================================================
const courses = {
    "المرحلة الابتدائية": {
        "السنة الأولى ابتدائي": {
            "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية فنية", "تربية بدنية"]
        },
        "السنة الثانية ابتدائي": { 
            "عامة": ["لغة عربية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تربية علمية", "تربية فنية"]
        },
        "السنة الثالثة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "تربية فنية"]
        },
        "السنة الرابعة ابتدائي": { 
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "علوم طبيعية"]
        },
        "السنة الخامسة ابتدائي": {
            "عامة": ["لغة عربية", "لغة فرنسية", "تربية إسلامية", "تربية مدنية", "رياضيات", "تاريخ وجغرافيا", "علوم طبيعية"]
        }
    },
    "المرحلة المتوسطة": {
        "السنة الأولى متوسط": {
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "إعلام آلي"]
        },
        "السنة الثانية متوسط": { 
            "عامة": ["لغة عربية", "لغة فرنسية", "لغة إنجليزية", "رياضيات", "علوم فيزيائية وتكنولوجية", "علوم طبيعية", "تاريخ وجغرافيا", "تربية إسلامية", "تربية مدنية"]
        },
        "السنة الثالثة متوسط": { 
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
            // رسالة أوضح للطالب في حال فشل الخادم
            message: 'خطأ في تهيئة الخادم. الرجاء التأكد من ضبط متغيرات بيئة Firebase (SERVICE_ACCOUNT_KEY و FIREBASE_DATABASE_URL).',
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


// 2. نقطة نهاية تسجيل طالب جديد
app.post('/register', async (req, res) => {
    if (!isFirebaseReady) return checkFirebaseReadiness(res); 

    const { name, lastName, phase, year, stream, subjects } = req.body; 
    const studentId = uuidv4(); 
    const fullName = `${name} ${lastName}`;

    if (!fullName || !phase || !year || !stream || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الرجاء توفير جميع بيانات الطالب والمواد المختارة.' });
    }

    try {
        const studentData = {
            id: studentId,
            name: fullName,
            phase: phase,      
            year: year,        
            stream: stream,    
            subjects: subjects, 
            isActive: true, 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await studentsRef.child(studentId).set(studentData); 

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

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
