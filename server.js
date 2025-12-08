// server.js

// استدعاء الوحدات المطلوبة
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // لاستخدام وظيفة قراءة الملفات

// 1. تهيئة dotenv لقراءة المتغيرات البيئية من ملف .env
dotenv.config();

// إعداد المسارات المطلوبة
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// تحديد مسار ملف HTML داخل مجلد views
const INDEX_FILE_PATH = path.join(__dirname, 'views', 'index.html');

const app = express();
const PORT = process.env.PORT || 3000;

// --- إزالة: لا يوجد استخدام لـ express.static لخدمة مجلد public ---

// 2. التوجيه للصفحة الرئيسية (/)
app.get('/', (req, res) => {
    // قراءة ملف index.html وإرساله كاستجابة
    fs.readFile(INDEX_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
            // في حالة حدوث خطأ (مثل عدم العثور على الملف)
            console.error(`❌ خطأ في قراءة ملف index.html: ${err.message}`);
            return res.status(500).send('<h1>خطأ 500: لم يتم العثور على الصفحة الرئيسية. تأكد من وجود الملف في مجلد views/index.html</h1>');
        }
        
        // إرسال محتوى الملف إلى المتصفح
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});

// 3. رسالة تأكيد القراءة والتشغيل
console.log(`✅ تم تحميل متغير بيئي: DATABASE_URL = ${process.env.DATABASE_URL || 'غير محدد'}`);

// 4. تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 خادم أكاديمية المعالي يعمل على http://localhost:${PORT}`);
    console.log(`💡 الخادم يخدم ملف index.html فقط من المسار: ${INDEX_FILE_PATH}`);
});
