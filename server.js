const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// لخدمة الملفات الثابتة (مثل CSS أو الصور) إذا وضعتها في public
app.use(express.static(path.join(__dirname, 'public')));

// المسار الرئيسي لعرض الصفحة
app.get('/', (req, res) => {
    // نستخدم res.sendFile بدلاً من res.render
    // ونشير إلى المسار الكامل لملف index.html داخل مجلد views
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
