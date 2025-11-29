// server.js

require('dotenv').config();
const express = require('express');
const path = require('path'); // ⬅️ **الخطأ الأول تم إصلاحه: استدعاء وحدة path**
const bodyParser = require('body-parser');
const firebaseAdmin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const getYouTubeID = require('get-youtube-id'); 

const app = express();
const port = process.env.PORT || 3000;

// 1. إعداد الخادم
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(bodyParser.urlencoded({ extended: true }));

// ⬅️ **الإصلاح الثاني: استخدام 'public' كمسار ثابت**
// هذا يضمن أن جميع الملفات الثابتة (بما في ذلك الصور) يتم خدمتها بشكل صحيح
// لا حاجة لتكرارها في الأسفل.
app.use(express.static(path.join(__dirname, 'public'))); 


// 2. تهيئة Firebase Admin SDK
try {
    // قراءة المفتاح من متغير البيئة وتحويله من نص JSON إلى كائن JS
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin Initialized.");
} catch (error) {
    console.error("ERROR: Failed to initialize Firebase Admin SDK. Check SERVICE_ACCOUNT_KEY in .env", error);
    process.exit(1);
}

const db = firebaseAdmin.firestore(); 

// 3. تهيئة Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- المسارات (Routes) ---

// مسار الصفحة الرئيسية (الطلاب)
app.get('/', async (req, res) => {
  try {
    const videosSnapshot = await db.collection('videos').orderBy('createdAt', 'desc').get();
    const videos = videosSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            // استخدام المكتبة الجديدة
            videoId: getYouTubeID(data.youtubeUrl || '') 
        };
    }).filter(video => video.videoId); 
    
    // ملاحظة: تأكد من أن ملف index.ejs الآن موجود في مجلد /views
    res.render('index', { pageTitle: '📚 BacTube - فيديوهات دراسية', videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).send("حدث خطأ أثناء تحميل الفيديوهات.");
  }
});

// مسار لوحة تحكم الأدمن (عرض النموذج)
app.get('/admin', (req, res) => {
    // TODO: يجب تطبيق نظام مصادقة هنا (Authentication)!
    res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: null, messageType: null });
});

// معالجة طلب إضافة فيديو جديد
app.post('/admin', async (req, res) => {
    // TODO: يجب تطبيق نظام مصادقة هنا!
    const { title, youtubeUrl, description } = req.body;
    
    if (!title || !youtubeUrl) {
        return res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: 'الرجاء إدخال العنوان والرابط.', messageType: 'error' });
    }
    
    try {
        // استخدام المكتبة الجديدة
        const videoId = getYouTubeID(youtubeUrl);
        if (!videoId) {
             return res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: 'رابط يوتيوب غير صالح. تأكد من أنه رابط كامل (مثل: https://www.youtube.com/watch?v=...).', messageType: 'error' });
        }

        await db.collection('videos').add({
            title,
            youtubeUrl,
            description,
            videoId, 
            createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });
        
        // بعد النجاح، نعرض رسالة النجاح
        res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: '✅ تم إضافة الفيديو بنجاح!', messageType: 'success' }); 

    } catch (error) {
        console.error("Error adding video:", error);
        res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: `❌ حدث خطأ في قاعدة البيانات: ${error.message}`, messageType: 'error' });
    }
});

// ⬅️ **تم حذف الكود المكرر هنا**
/*
// افترض أن مجلد "images" موجود داخل مجلد المشروع الرئيسي
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
*/


// 4. تشغيل الخادم
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
