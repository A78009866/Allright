const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// التأكد من تثبيت حزمة Express أولاً: npm install express

// 1. تحديد المجلد الذي يحتوي على ملفات الواجهة (Frontend)
const publicDirectoryPath = path.join(__dirname, 'public');

// 2. استخدام Express لخدمة الملفات الثابتة (Static Files)
// هذا يعني أن http://localhost:3000/ سيخدم ملف public/index.html
app.use(express.static(publicDirectoryPath));

// 3. تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`⚠️ Note: This is a FAKE hacking tool for educational/fun purposes only.`);
});

