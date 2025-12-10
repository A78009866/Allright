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

// ---------------------------
// --- مسارات عرض الملفات ---
// ---------------------------

// عرض index.html كصفحة رئيسية
app.get('/', (req, res) => {
    // تم الافتراض بوجود مجلد views لتشغيل التطبيق، وإلا يجب تغيير المسار
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// عرض status.html عند مسح QR code
app.get('/status.html', (req, res) => {
    // تم الافتراض بوجود مجلد views لتشغيل التطبيق، وإلا يجب تغيير المسار
    res.sendFile(path.join(__dirname, 'status.html'));
});

// ---------------------------
// --- مسارات API لـ الإدارة ---
// ---------------------------

/**
 * دالة مساعدة لتوحيد تنسيق بيانات المادة
 * @param {object} subjectInfo - يحتوي على level, year, stream, subject
 * @returns {string} - مفتاح موحد للمادة
 */
function getSubjectKey({ level, year, stream, subject }) {
    // استخدام fullInfo إذا كان متاحًا لإنشاء مفتاح
    const streamKey = stream ? stream.trim() : 'NO_STREAM';
    return `${level.trim()}|${year.trim()}|${streamKey}|${subject.trim()}`;
}

// 1. نقطة نهاية تسجيل طالب جديد (مُحدّثة لدعم هيكل المواد الجديد)
app.post('/register', async (req, res) => {
    const { name, subjects } = req.body; // subjects هنا هي مصفوفة من كائنات { level, year, stream, subject, fullInfo }

    if (!name || !subjects || subjects.length === 0) {
        return res.status(400).json({ message: 'الرجاء توفير اسم الطالب والمواد المختارة.' });
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
            subjectsNames: subjectNames, // قائمة بأسماء المواد للعرض المختصر (للتوافق مع الواجهة)
            isActive: true, // الحالة الإجمالية للطالب (للحضور/الانصراف العام)
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await newStudentRef.set(studentData);

        // بيانات QR Code
        const qrData = `/status.html?id=${studentId}`;
        const qrCodeUrl = await QRCode.toDataURL(qrData);

        res.status(201).json({ message: 'تم تسجيل الطالب بنجاح', studentId: studentId, qrCodeUrl: qrCodeUrl });
    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ message: 'فشل التسجيل الداخلي.' });
    }
});

// 2. نقطة نهاية جلب جميع الطلاب (مُعدّلة لدعم هيكل المواد الجديد)
app.get('/students', async (req, res) => {
    try {
        const snapshot = await studentsRef.once('value');
        const studentsData = snapshot.val() || {};
        
        // تحويل البيانات لتهيئة العرض في الفرونت إند
        const students = {};
        for (const [id, student] of Object.entries(studentsData)) {
            // للتأكد من وجود subjectsNames في حالة الطلاب القدامى
            if (!student.subjectsNames && student.subjects) {
                student.subjectsNames = Object.values(student.subjects).map(sub => sub.name);
            }
            
            students[id] = {
                ...student,
                id: id,
            };
        }

        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'فشل في جلب بيانات الطلاب.' });
    }
});

// 3. نقطة نهاية فحص وتحديث حالة QR Code (الحضور/الانصراف العام)
app.post('/check-in-out', async (req, res) => {
    const { studentId } = req.body;

    if (!studentId) {
        return res.status(400).json({ message: 'الرجاء توفير معرف الطالب.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const snapshot = await studentRef.once('value');
        const student = snapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير مسجل.' });
        }

        const newStatus = !student.isActive; // عكس الحالة الحالية
        const statusText = newStatus ? 'حضور' : 'انصراف';

        await studentRef.update({
            isActive: newStatus,
            lastStatusChange: admin.database.ServerValue.TIMESTAMP
        });

        res.json({ 
            message: `تم تسجيل ${statusText} الطالب ${student.name} بنجاح.`,
            newStatus: newStatus,
            studentName: student.name
        });

    } catch (error) {
        console.error('Error checking in/out student:', error);
        res.status(500).json({ message: 'فشل داخلي في تحديث حالة الطالب.' });
    }
});

// 4. نقطة نهاية حذف طالب (DELETE)
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
    const { subjectInfo } = req.body; // subjectInfo هو الكائن الناتج من getSubjectInfo

    if (!subjectInfo || !subjectInfo.fullInfo) {
        return res.status(400).json({ message: 'بيانات المادة غير كاملة.' });
    }

    try {
        const studentRef = studentsRef.child(studentId);
        const studentSnapshot = await studentRef.once('value');
        const student = studentSnapshot.val();

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود.' });
        }
        
        const subjectKey = getSubjectKey(subjectInfo);
        
        if (student.subjects && student.subjects[subjectKey]) {
             return res.status(400).json({ message: 'المادة مضافة بالفعل لهذا الطالب.' });
        }
        
        const subjectRef = studentRef.child('subjects').child(subjectKey);

        const newSubjectData = {
            name: subjectInfo.fullInfo,
            status: 'نشط', // الحالة الافتراضية عند الإضافة
            registeredAt: admin.database.ServerValue.TIMESTAMP
        };

        await subjectRef.set(newSubjectData);

        // تحديث قائمة أسماء المواد للعرض المختصر
        const currentSubjectsNames = student.subjectsNames || [];
        const newSubjectsNames = [...currentSubjectsNames, subjectInfo.fullInfo];
        
        await studentRef.update({ subjectsNames: newSubjectsNames });

        res.json({ message: 'تمت إضافة المادة بنجاح', newSubject: newSubjectData });
    } catch (error) {
        console.error('Error adding subject:', error);
        res.status(500).json({ message: 'فشل داخلي في إضافة المادة.' });
    }
});

// 6. نقطة نهاية تحديث حالة مادة معينة للطالب (PATCH)
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

        const updateData = {};
        updateData[subjectPath + '/status'] = newStatus;

        await studentRef.update(updateData);
        
        res.json({ message: `تم تحديث حالة المادة بنجاح إلى: ${newStatus}` });
    } catch (error) {
        console.error('Error updating subject status:', error);
        res.status(500).json({ message: 'فشل داخلي في تحديث حالة المادة.' });
    }
});


// ابدأ تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
