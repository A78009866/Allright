// server.js

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    console.error("Failed to initialize Firebase Admin SDK. Please check your .env file format:", error.message);
    process.exit(1);
}

const db = admin.database();
const studentsRef = db.ref('students');

// دالة مساعدة لإنشاء مفتاح موحد للمادة
const getSubjectKey = (subject) => {
    // يستخدم لتوليد مفتاح موحد بناءً على مستوى التعليم والسنة والمسار والمادة
    const streamPart = subject.stream ? `_${subject.stream.replace(/\s/g, '-')}` : '';
    return `${subject.level.replace(/\s/g, '-')}_${subject.year.replace(/\s/g, '-')}${streamPart}_${subject.subject.replace(/\s/g, '-')}`;
};

// ---------------------------
// --- مسارات عرض الملفات ---
// ---------------------------

// عرض index.html كصفحة رئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// عرض status.html عند مسح QR code
app.get('/status.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'status.html'));
});

// ---------------------------
// --- مسارات API للطلاب ---
// ---------------------------

// 1. نقطة نهاية تسجيل طالب جديد (POST)
app.post('/register', async (req, res) => {
    const { name, subjects } = req.body;

    if (!name || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الاسم والمواد مطلوبة.' });
    }

    try {
        const newStudentRef = studentsRef.push();
        const studentId = newStudentRef.key;
        const subjectsObject = {};
        const subjectNames = [];

        subjects.forEach(sub => {
            const subjectKey = getSubjectKey(sub);
            subjectsObject[subjectKey] = {
                name: sub.fullInfo, // الاسم الكامل الذي تم إنشاؤه في الفرونت
                status: 'نشط', // الحالة الافتراضية عند التسجيل
                registeredAt: admin.database.ServerValue.TIMESTAMP
            };
            subjectNames.push(sub.fullInfo); // للاستخدام في العرض المختصر
        });

        const studentData = {
            id: studentId,
            name: name,
            subjects: subjectsObject, // هذا هو كائن المواد المفصل
            subjectsNames: subjectNames, // قائمة بأسماء المواد للعرض المختصر 
            isActive: true, // الحالة الإجمالية للطالب (للحضور/الانصراف العام)
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await newStudentRef.set(studentData);

        // إنشاء رمز QR
        const qrCodeData = `https://yourdomain.com/status.html?id=${studentId}`; // يجب تغيير yourdomain.com
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);

        res.json({
            message: 'تم تسجيل الطالب بنجاح.',
            studentId: studentId,
            qrCodeImage: qrCodeImage
        });
    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ message: 'فشل داخلي في التسجيل.' });
    }
});

// 2. نقطة نهاية جلب قائمة الطلاب (GET)
app.get('/students', async (req, res) => {
    try {
        const snapshot = await studentsRef.once('value');
        const students = snapshot.val() || {};
        
        // تحويل البيانات للفرونت إند: دمج الـ id وإرسال قائمة مبسطة من المواد
        const studentsList = Object.entries(students).map(([id, student]) => ({
            id: id,
            name: student.name,
            isActive: student.isActive,
            subjects: student.subjectsNames || [], // استخدام subjectsNames للعرض المختصر
        }));

        res.json(studentsList);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'فشل داخلي في جلب بيانات الطلاب.' });
    }
});

// 3. نقطة نهاية جلب تفاصيل طالب واحد (GET) - *ميزة جديدة*
app.get('/students/:id', async (req, res) => {
    const studentId = req.params.id;
    try {
        const studentSnapshot = await studentsRef.child(studentId).once('value');
        const studentData = studentSnapshot.val();

        if (!studentData) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }

        res.json(studentData);
    } catch (error) {
        console.error('Error fetching single student:', error);
        res.status(500).json({ message: 'فشل داخلي في جلب بيانات الطالب.' });
    }
});

// 4. نقطة نهاية حذف الطالب (DELETE)
app.delete('/students/:id', async (req, res) => {
    const studentId = req.params.id;
    try {
        await studentsRef.child(studentId).remove();
        res.json({ message: 'تم حذف الطالب بنجاح.' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'فشل داخلي في حذف الطالب.' });
    }
});

// 5. نقطة نهاية إضافة مادة جديدة للطالب (POST)
app.post('/students/:id/subject', async (req, res) => {
    const studentId = req.params.id;
    const { subject } = req.body; // 'subject' هو الكائن الذي يحتوي على (level, year, stream, subject)

    if (!subject) {
        return res.status(400).json({ message: 'بيانات المادة غير كاملة.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const studentSnapshot = await studentRef.once('value');
        const studentData = studentSnapshot.val();

        if (!studentData) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }
        
        const subjectKey = getSubjectKey(subject);
        const newSubjectData = {
            name: subject.fullInfo,
            status: 'نشط', 
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        // التحقق من تكرار المادة
        if (studentData.subjects && studentData.subjects[subjectKey]) {
            return res.status(409).json({ message: 'المادة موجودة مسبقاً لهذا الطالب.' });
        }

        // تحديث كائن المواد
        const updateData = {};
        updateData[`subjects/${subjectKey}`] = newSubjectData;
        
        // تحديث قائمة الأسماء المختصرة للمواد
        const updatedSubjectsNames = [...(studentData.subjectsNames || []), subject.fullInfo];
        updateData.subjectsNames = updatedSubjectsNames;

        await studentRef.update(updateData);

        res.json({ message: 'تمت إضافة المادة بنجاح', newSubject: newSubjectData });
    } catch (error) {
        console.error('Error adding subject:', error);
        res.status(500).json({ message: 'فشل داخلي في إضافة المادة.' });
    }
});

// 6. نقطة نهاية تحديث حالة مادة معينة للطالب (PATCH) - *ميزة جديدة*
app.patch('/students/:id/subject-status', async (req, res) => {
    const studentId = req.params.id;
    const { subjectKey, newStatus } = req.body; // subjectKey هو المفتاح الموحد للمادة

    if (!subjectKey || !newStatus) {
        return res.status(400).json({ message: 'بيانات التحديث غير كاملة (مفتاح المادة والحالة الجديدة).' });
    }

    const validStatuses = ['نشط', 'غير نشط'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: 'الحالة الجديدة غير صالحة.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const subjectPath = `subjects/${subjectKey}`;
        const subjectSnapshot = await studentRef.child(subjectPath).once('value');
        
        if (!subjectSnapshot.exists()) {
            return res.status(404).json({ message: 'المادة غير موجودة لهذا الطالب.' });
        }

        const updateData = {};
        updateData[subjectPath + '/status'] = newStatus;

        await studentRef.update(updateData);
        
        res.json({ message: `تم تحديث حالة المادة إلى: ${newStatus}`, newStatus });
    } catch (error) {
        console.error('Error updating subject status:', error);
        res.status(500).json({ message: 'فشل داخلي في تحديث حالة المادة.' });
    }
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
