// server.js



const express = require('express');

const bodyParser = require('body-parser');

const admin = require('firebase-admin');

const QRCode = require('qrcode');

const path = require('path');



// تحميل متغيرات البيئة من ملف .env

require('dotenv').config();



const app = express();

const PORT = process.env.PORT || 3000;

const VIEWS_PATH = path.join(__dirname, 'views'); // تحديد مسار مجلد views



// Middleware

app.use(bodyParser.json());



// --- تهيئة Firebase Admin SDK ---

let serviceAccount;

try {

    // جلب المفتاح كـ JSON String من متغير البيئة

    const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;

    

    if (serviceAccountJson) {

        // تنظيف وازالة أي علامات اقتباس محيطة قد تضيفها البيئة

        const cleanJsonString = serviceAccountJson.replace(/^["]+|["]+$/g, '');

        // تحليل سلسلة JSON إلى كائن

        serviceAccount = JSON.parse(cleanJsonString);

    } else {

        throw new Error("SERVICE_ACCOUNT_KEY environment variable is missing in .env.");

    }



    // تهيئة Firebase

    admin.initializeApp({

        credential: admin.credential.cert(serviceAccount),

        databaseURL: process.env.FIREBASE_DATABASE_URL

    });

    console.log("Firebase Admin SDK initialized successfully.");

} catch (error) {

    console.error("Failed to initialize Firebase Admin SDK. Please check your .env file format (SERVICE_ACCOUNT_KEY must be a valid, single-line JSON string):", error.message);

    process.exit(1);

}



const db = admin.database();

const studentsRef = db.ref('students');



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



// ---------------------------

// --- مسارات API لـ CRUD ---

// ---------------------------



// 1. نقطة نهاية تسجيل طالب جديد

app.post('/register', async (req, res) => {

    const { name, subjects } = req.body;



    if (!name || !subjects || subjects.length === 0) {

        return res.status(400).json({ message: 'الرجاء توفير اسم الطالب والمواد المختارة.' });

    }



    try {

        const newStudentRef = studentsRef.push();

        const studentId = newStudentRef.key;



        const studentData = {

            id: studentId,

            name: name,

            subjects: subjects,

            isActive: true, // افتراضياً، نشط عند التسجيل

            registeredAt: admin.database.ServerValue.TIMESTAMP

        };



        await newStudentRef.set(studentData);



        // بيانات QR Code تشير إلى المسار الجديد لـ status.html

        const qrData = `/status.html?id=${studentId}`; 

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



// 2. نقطة نهاية جلب جميع الطلاب

app.get('/students', async (req, res) => {

    try {

        const snapshot = await studentsRef.once('value');

        const students = snapshot.val() || {};

        res.json(students);

    } catch (error) {

        console.error('Error fetching students:', error);

        res.status(500).json({ message: 'فشل في جلب بيانات الطلاب.' });

    }

});



// 3. نقطة نهاية فحص وتحديث حالة الطالب (مسح QR code)

app.post('/check-status/:id', async (req, res) => {

    const studentId = req.params.id;



    try {

        const studentSnapshot = await studentsRef.child(studentId).once('value');

        const student = studentSnapshot.val();



        if (!student) {

            return res.status(404).json({ message: 'الطالب غير موجود.' });

        }



        // تبديل حالة النشاط

        const newStatus = !student.isActive;

        await studentsRef.child(studentId).update({ isActive: newStatus });



        // تسجيل حدث الحضور/الانصراف

        const attendanceRef = db.ref(`attendance/${studentId}`).push();

        await attendanceRef.set({

            action: newStatus ? 'Check-in' : 'Check-out',

            timestamp: admin.database.ServerValue.TIMESTAMP

        });



        res.json({

            message: `تم تحديث حالة الطالب بنجاح إلى: ${newStatus ? 'نشط' : 'غير نشط'}`,

            name: student.name,

            newStatus: newStatus

        });



    } catch (error) {

        console.error('Error checking/toggling status:', error);

        res.status(500).json({ message: 'فشل داخلي في تحديث الحالة.' });

    }

});





// بدء تشغيل الخادم

app.listen(PORT, () => {

    console.log(`Server is running on http://localhost:${PORT}`);

    console.log(`(Make sure 'index.html' and 'status.html' are inside the 'views' folder)`);

});
