// server.js

// 1. استيراد المكتبات الضرورية و dotenv
require('dotenv').config(); // تحميل المتغيرات من .env
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const QRCode = require('qrcode');
const admin = require('firebase-admin');

const app = express();
const port = 3000;

// 2. إعداد Firebase باستخدام متغيرات .env
const serviceAccount = require('./serviceAccountKey.json'); // ⚠️ تأكد من وجود ملف مفتاح الخدمة الخاص بك

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
const registrationsRef = db.ref('registrations'); // اسم العقدة في قاعدة البيانات

// سحب المفتاح السري من .env
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
if (!ADMIN_SECRET) {
    console.error("❌ ERROR: ADMIN_SECRET_KEY is not defined in .env file. Please create a .env file.");
    process.exit(1);
}

// 3. الإعدادات الوسطية (Middleware)
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// --- المسارات (API Endpoints) ---

// 4. لخدمة ملف HTML للواجهة الأمامية (الطلاب)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. لخدمة ملف HTML للواجهة الإدارية (المسؤول)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 6. مسار التسجيل (للمستخدمين الجدد)
app.post('/api/register', async (req, res) => {
    try {
        const { name, level, year, subject, contact } = req.body;
        
        if (!name || !level || !year || !subject) {
            return res.status(400).json({ message: 'الرجاء ملء جميع الحقول المطلوبة (الاسم، المستوى، السنة، المادة).' });
        }

        const registrationData = {
            name,
            level,
            year,
            subject,
            contact: contact || 'غير متوفر',
            status: 'pending', // الافتراضية هي قيد الانتظار
            timestamp: admin.database.ServerValue.TIMESTAMP
        };

        const newRegistrationRef = registrationsRef.push(registrationData);
        const registrationId = newRegistrationRef.key;

        res.json({ 
            message: 'تم استلام طلب التسجيل بنجاح. سيتم مراجعته من قبل الإدارة.', 
            registrationId: registrationId,
            status: 'pending' 
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء عملية التسجيل.' });
    }
});

// 7. مسار التحقق من الحالة وعرض QR (للطالب)
app.post('/api/status', async (req, res) => {
    try {
        const { registrationId } = req.body;

        if (!registrationId) {
            return res.status(400).json({ message: 'الرجاء إدخال رقم التسجيل للتحقق.' });
        }

        const snapshot = await registrationsRef.child(registrationId).once('value');
        const registration = snapshot.val();

        if (!registration) {
            return res.status(404).json({ message: 'لا يوجد تسجيل بهذا الرقم.' });
        }
        
        // إذا كان التسجيل مقبولاً، نقوم بإنشاء رمز الـ QR
        if (registration.status === 'accepted') {
            // صياغة البيانات التي ستحملها الـ QR
            const qrData = `MAALI-REG-ID:${registrationId}`; 
            const qrCodeImage = await QRCode.toDataURL(qrData); // إنشاء رمز QR كصورة Base64

            return res.json({
                message: '✅ تسجيلك مقبول وجاهز!',
                status: 'accepted',
                qrCode: qrCodeImage,
                details: registration
            });
        }
        
        // للحالات الأخرى
        res.json({
            message: `حالة التسجيل الحالية: ${registration.status}. (لم يتم القبول بعد)`,
            status: registration.status,
            details: registration
        });

    } catch (error) {
        console.error('Status Check Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء عملية التحقق من الحالة.' });
    }
});

// 8. مسار مسح رمز QR (لجهاز المسح/التحقق)
app.post('/api/scan', async (req, res) => {
    try {
        const { scannedData } = req.body; 

        if (!scannedData || !scannedData.startsWith('MAALI-REG-ID:')) {
            return res.status(400).json({ message: 'رمز QR غير صالح أو بتنسيق خاطئ.' });
        }

        const registrationId = scannedData.split(':')[1];
        
        const snapshot = await registrationsRef.child(registrationId).once('value');
        const registration = snapshot.val();

        if (!registration) {
            return res.status(404).json({ message: 'هذا الرمز لا يمثل تسجيلًا صالحًا في النظام.' });
        }

        if (registration.status !== 'accepted') {
            return res.status(403).json({ 
                message: `التسجيل موجود، ولكن حالته: ${registration.status}. (غير مقبول بعد)`,
                details: registration
            });
        }
        
        res.json({ 
            message: '✅ تسجيل صالح ومقبول. تم التحقق بنجاح.', 
            student: registration.name, 
            course: `${registration.level} - ${registration.year} - ${registration.subject}`,
            time: new Date().toLocaleTimeString('ar-EG')
        });

    } catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء عملية المسح.' });
    }
});


// --- مسارات الإدارة (Admin Endpoints) ---

// 9. مسار عرض جميع التسجيلات (للمسؤول)
app.post('/api/admin/registrations', async (req, res) => {
    const { adminSecret } = req.body;

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({ message: 'مفتاح المسؤول غير صحيح.' });
    }

    try {
        const snapshot = await registrationsRef.once('value');
        const registrations = snapshot.val() || {};
        
        // تحويل الكائن إلى مصفوفة لسهولة التعامل معه في الواجهة الأمامية
        const registrationList = Object.keys(registrations).map(key => ({
            id: key,
            ...registrations[key]
        }));

        res.json({ registrations: registrationList });
    } catch (error) {
        console.error('Admin Fetch Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب التسجيلات.' });
    }
});

// 10. مسار تحديث حالة التسجيل (للمسؤول)
app.post('/api/admin/status', async (req, res) => {
    const { adminSecret, registrationId, newStatus } = req.body;

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({ message: 'مفتاح المسؤول غير صحيح.' });
    }

    if (!registrationId || !['accepted', 'pending', 'rejected'].includes(newStatus)) {
        return res.status(400).json({ message: 'بيانات غير صالحة.' });
    }

    try {
        await registrationsRef.child(registrationId).update({ status: newStatus });
        res.json({ 
            message: `تم تحديث حالة التسجيل ${registrationId} إلى ${newStatus} بنجاح.`,
            id: registrationId,
            status: newStatus
        });
    } catch (error) {
        console.error('Admin Update Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث الحالة.' });
    }
});


// 11. تشغيل الخادم
app.listen(port, () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${port}`);
    console.log(`🔑 واجهة المسؤول: http://localhost:${port}/admin (تحتاج إلى مفتاح ADMIN_SECRET)`);
});
