// server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const firebaseAdmin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
// الحل: تم تعديل الاستيراد ليتناسب مع كيفية عمل مكتبة youtube-parser
const getYouTubeID = require('youtube-parser'); 

const app = express();
const port = process.env.PORT || 3000;

// 1. إعداد الخادم
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); 

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
    // الخروج إذا فشل الإعداد لضمان عدم تشغيل الخادم ببيانات غير صحيحة
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
            // الاستخدام الصحيح للمكتبة لحل المشكلة
            videoId: getYouTubeID(data.youtubeUrl || '') 
        };
    }).filter(video => video.videoId); 
    
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
        // الاستخدام الصحيح للمكتبة لحل المشكلة
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
        
        res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: '✅ تم إضافة الفيديو بنجاح!', messageType: 'success' }); 

    } catch (error) {
        console.error("Error adding video:", error);
        res.render('admin', { pageTitle: 'إضافة فيديو جديد', message: `❌ حدث خطأ: ${error.message}`, messageType: 'error' });
    }
});


// 4. تشغيل الخادم
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
