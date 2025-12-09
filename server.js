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
    console.error("❌ ERROR: ADMIN_SECRET_KEY is not defined in .env file.");
    process.exit(1);
}

// 3. الإعدادات الوسطية (Middleware)
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// --- المسارات (API Endpoints) ---

// 4. لخدمة ملف HTML للواجهة الأمامية (الطلاب)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 🔴 5. المسار المحمي لصفحة الإدارة (Admin)
// لا يمكن الوصول للصفحة إلا عبر URL يحتوي على المفتاح السري
app.get(`/admin/${ADMIN_SECRET}`, (req, res) => {
    // يمكن حذف الرابط من الواجهة الأمامية index.html الآن
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});


// 6. المسار: إنشاء طلب تسجيل جديد (لواجهة المستخدم)
app.post('/api/register', async (req, res) => {
  try {
    const { name, level, year, subject, contact } = req.body;
    
    if (!name || !level || !year || !subject) {
        return res.status(400).json({ message: 'الرجاء إكمال جميع حقول التسجيل الأساسية.' });
    }

    // إضافة تسجيل جديد إلى Firebase
    const newRegistrationRef = registrationsRef.push();
    const registrationId = newRegistrationRef.key;
    
    const newRegistration = { 
        id: registrationId,
        name, 
        level, 
        year, 
        subject, 
        contact: contact || 'غير متوفر', // إضافة حقل اتصال اختياري
        status: 'pending', 
        qrCodeData: null,
        createdAt: admin.database.ServerValue.TIMESTAMP // للحصول على وقت الخادم
    };

    await newRegistrationRef.set(newRegistration);

    res.status(201).json({ 
      success: true,
      message: 'تم إرسال طلب التسجيل بنجاح. سيتم مراجعته من قبل الإدارة.', 
      registrationId 
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء معالجة الطلب.' });
  }
});

// 🔴 7. المسار الجديد: جلب كل طلبات التسجيل المعلقة (للأدمن)
app.get('/api/admin/pending', async (req, res) => {
    // التحقق من المفتاح السري الممرر في Header
    if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
        return res.status(403).json({ message: 'وصول غير مصرح به.' });
    }

    try {
        const snapshot = await registrationsRef.orderByChild('status').equalTo('pending').once('value');
        
        const pendingRegistrations = [];
        snapshot.forEach(childSnapshot => {
            pendingRegistrations.push(childSnapshot.val());
        });

        // فرز الطلبات حسب تاريخ الإنشاء (الأقدم أولاً)
        pendingRegistrations.sort((a, b) => a.createdAt - b.createdAt);
        
        res.json(pendingRegistrations);
    } catch (error) {
        console.error('Fetch Pending Error:', error);
        res.status(500).json({ message: 'فشل في جلب الطلبات المعلقة.' });
    }
});


// 🔴 8. المسار: قبول/رفض طلب التسجيل (لوحة الأدمن)
app.post('/api/admin/:action/:id', async (req, res) => {
  const { action, id } = req.params;
  
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(403).json({ message: 'وصول غير مصرح به.' });
  }

  if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ message: 'الإجراء غير صالح.' });
  }

  try {
    const registrationRef = registrationsRef.child(id);
    const snapshot = await registrationRef.once('value');
    const registration = snapshot.val();

    if (!registration) {
      return res.status(404).json({ message: 'لم يتم العثور على طلب التسجيل.' });
    }

    let updateData = { status: action };
    let message;

    if (action === 'accept') {
        const qrData = `MAALI-REG-ID:${id}`;
        const qrCodeImage = await QRCode.toDataURL(qrData);

        updateData.qrCodeData = qrCodeImage;
        message = 'تم قبول التسجيل بنجاح وإنشاء رمز QR.';

    } else if (action === 'reject') {
        message = 'تم رفض طلب التسجيل بنجاح.';
        updateData.qrCodeData = null; 
    }
    
    await registrationRef.update(updateData);

    res.json({ success: true, message });

  } catch (error) {
    console.error(`${action} Error:`, error);
    res.status(500).json({ success: false, message: `حدث خطأ أثناء معالجة ${action}.` });
  }
});

// 9. المسار: مسح رمز QR والتحقق من صلاحيته (جهاز الأدمن/الماسح) (لم يتغير)
app.post('/api/admin/scan', async (req, res) => {
    // ... (الكود كما هو، لكن يستخدم Firebase)
    if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
        return res.status(403).json({ message: 'وصول غير مصرح به.' });
    }

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


// 10. تشغيل الخادم
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`🔒 Admin URL (Secret): http://localhost:${port}/admin/${ADMIN_SECRET}`);
});
