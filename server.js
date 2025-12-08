// server.js
// استدعاء الوحدات المطلوبة
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// تهيئة dotenv لقراءة المتغيرات البيئية من ملف .env
dotenv.config();

// الحصول على المسار المطلق للملف الحالي (مطلوب عند استخدام 'type: "module"' في package.json)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// استخدام المتغير البيئي PORT، أو 3000 كقيمة افتراضية
const PORT = process.env.PORT || 3000;

// تعيين محرك القوالب (EJS كمثال، لكن يمكن استخدام plain HTML)
// إذا كنت تريد خدمة ملفات HTML ثابتة فقط، يمكن حذف هذا الجزء واستخدام express.static
app.set('view engine', 'html');
app.engine('html', (filePath, options, callback) => {
    import('fs').then(fs => {
        fs.readFile(filePath, 'utf-8', callback);
    });
});

// خدمة الملفات الثابتة (CSS، صور، JavaScript) من مجلد 'public'
app.use(express.static(path.join(__dirname, 'views)));

// التوجيه للصفحة الرئيسية
app.get('/', (req, res) => {
    // عرض ملف index.html
    res.render(path.join(__dirname, 'views', 'index.html'), {});
});

// مثال على قراءة وعرض متغير بيئي (للتأكد من عمل dotenv)
console.log(`✅ تم تحميل متغير بيئي: DATABASE_URL = ${process.env.DATABASE_URL}`);
console.log(`⚙️  الخادم يعمل على المنفذ: ${PORT}`);

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 خادم أكاديمية الأعالي يعمل على http://localhost:${PORT}`);
});


