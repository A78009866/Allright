const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 1. إعداد EJS كمحرك العرض (View Engine)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. لخدمة الملفات الثابتة (مثل CSS إذا أنشأته مستقبلاً)
app.use(express.static(path.join(__dirname, 'public')));

// المسار الرئيسي لعرض الصفحة
app.get('/', (req, res) => {
    // نستخدم res.render بدلاً من res.sendFile
    res.render('index', { 
        pageTitle: 'أكاديمية المعالي',
        // يمكن تمرير بيانات المستويات هنا لاحقاً
    });
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
