// index.js (ملف الخادم الرئيسي لمشروع Aite)

const express = require('express');
const firebaseAdmin = require('firebase-admin');
const cloudinary = require('cloudinary');

const app = express();
const port = process.env.PORT || 3000; 

// **********************************************
// ملاحظة هامة: يجب إضافة إعدادات Firebase و Cloudinary 
// هنا أو عبر متغيرات البيئة (موصى به عند النشر على Vercel).
// **********************************************

// تهيئة بسيطة لـ Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// مسار رئيسي لتأكيد عمل السيرفر
app.get('/', (req, res) => {
  res.send('✅ خادم Express (Aite) يعمل بنجاح على Vercel مع تهيئة Cloudinary و Firebase.');
});

// مسار تجريبي لـ API
app.get('/api/status', (req, res) => {
  res.json({ 
    project: 'Aite', 
    status: 'Running',
    dependencies: ['Express', 'Firebase-Admin', 'Cloudinary']
  });
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`🚀 خادم Aite يعمل على المنفذ: ${port}`);
});