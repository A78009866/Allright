const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// لخدمة الملفات الثابتة (مثل index.html, CSS, الصور)
app.use(express.static(path.join(__dirname, 'views)));

// المسار الرئيسي لعرض الصفحة
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views, 'index.html'));
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});


