// server.js

// 1. استيراد المكتبات الضرورية
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const path = require('path');
const crypto = require('crypto'); // لتوليد معرفات فريدة

// 2. تحميل متغيرات البيئة من ملف .env
dotenv.config();

// 3. تهيئة Express
const app = express();
const PORT = 3000;

// 4. إعداد Firebase Admin
// نستخدم JSON.parse لتحويل متغير البيئة SERVICE_ACCOUNT_KEY إلى كائن JSON
try {
  const serviceAccountKey = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  
  console.log("Firebase Admin SDK initialized successfully.");
  
  const db = admin.database();

  // 5. إعداد Middlewares
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // لخدمة الملفات الثابتة (مثل الصور أو CSS/JS الخارجية في مجلد public)
  app.use(express.static(path.join(__dirname, 'public'))); 
  
  // **********************************************
  // ************ مسارات الخادم (Routes) *************
  // **********************************************

  // 1. المسار الرئيسي - يعرض الصفحة الرئيسية (index.html) من مجلد views
  app.get('/', (req, res) => {
    // يخدم ملف index.html من مجلد views/
    res.sendFile(path.join(__dirname, 'views', 'index.html')); 
  });

  // 2. مسار تسجيل مادة
  app.post('/api/register', async (req, res) => {
    const { name, year, subject, fullName } = req.body;

    if (!name || !year || !subject || !fullName) {
      return res.status(400).json({ success: false, message: 'الرجاء ملء جميع الحقول المطلوبة.' });
    }

    try {
      // توليد معرف فريد للتسجيل (Registration ID)
      const registrationId = crypto.randomBytes(8).toString('hex');
      const status = 'مسجل - قيد المراجعة';
      const timestamp = admin.database.ServerValue.TIMESTAMP;
      
      const registrationData = {
        name: name, // الاسم المستخدم في الرئيسية
        fullName: fullName, // الاسم واللقب الكامل
        year: year, // المستوى التعليمي
        subject: subject, // المادة
        status: status,
        createdAt: timestamp,
        registrationId: registrationId // حفظ المعرف داخل البيانات
      };

      // حفظ بيانات التسجيل في قاعدة البيانات
      await db.ref(`registrations/${registrationId}`).set(registrationData);

      // إنشاء محتوى الـ QR Code (المعرف هو الأهم هنا)
      const qrData = JSON.stringify({ id: registrationId, name: fullName, subject: subject });

      // توليد QR Code كـ Data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, { type: 'image/png', errorCorrectionLevel: 'H' });

      // إرسال البيانات إلى العميل
      res.json({ 
        success: true, 
        message: 'تم التسجيل بنجاح!',
        registrationId: registrationId,
        qrCodeDataURL: qrCodeDataURL,
        userData: { name: name, status: status, registrationId: registrationId }
      });

    } catch (error) {
      console.error("خطأ في معالجة التسجيل:", error);
      res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم.' });
    }
  });

  // 3. مسار جلب تفاصيل تسجيل المستخدم
  app.get('/api/user/:registrationId', async (req, res) => {
    const { registrationId } = req.params;

    try {
      const snapshot = await db.ref(`registrations/${registrationId}`).once('value');
      const userData = snapshot.val();

      if (userData) {
        res.json({ success: true, userData: userData });
      } else {
        res.status(404).json({ success: false, message: 'لم يتم العثور على بيانات التسجيل.' });
      }
    } catch (error) {
      console.error("خطأ في جلب بيانات المستخدم:", error);
      res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم.' });
    }
  });

  // 6. بدء تشغيل الخادم
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
  
} catch (error) {
    console.error("Critical Error: Failed to initialize Firebase or load config.", error.message);
    console.log("Please ensure .env and serviceAccountKey.json are correctly configured.");
}
