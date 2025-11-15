// index.js - ملف الخادم النهائي لمشروع Trimer (Aite) مع حل مشكلة EROFS

const express = require('express');
const firebaseAdmin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const multer = require('multer');
// لم تعد هناك حاجة لـ fs بعد الآن، لكن سنبقيها احتياطاً إذا كان هناك استخدام آخر

// ====================================================
// حل مشكلة EROFS: استخدام تخزين الذاكرة (Memory Storage) بدلاً من القرص
// ====================================================
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const port = process.env.PORT || 3000; 

// ====================================================
// 1. تهيئة المكتبات (Configuration) - ثبات عالٍ
// ====================================================

let isFirebaseInitialized = false;

try {
    // 1.1. تهيئة Firebase
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountString && serviceAccountString.trim() !== '') {
        try {
            const serviceAccount = JSON.parse(serviceAccountString); 
            
            if (!firebaseAdmin.apps.length) {
                firebaseAdmin.initializeApp({
                    credential: firebaseAdmin.credential.cert(serviceAccount),
                });
                isFirebaseInitialized = true;
                console.log("SUCCESS: Firebase initialized.");
            }
        } catch (jsonError) {
            console.error("CRITICAL ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Error:", jsonError.message);
        }
    } else {
        console.warn("WARNING: Skipping Firebase initialization. FIREBASE_SERVICE_ACCOUNT is empty.");
    }

    // 1.2. تهيئة Cloudinary
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        cloudinary.config({ 
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
            api_key: process.env.CLOUDINARY_API_KEY, 
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
        console.log("SUCCESS: Cloudinary initialized.");
    } else {
        console.warn("WARNING: Skipping Cloudinary initialization. CLOUDINARY_CLOUD_NAME is missing.");
    }

} catch (e) {
    console.error("UNEXPECTED SERVER STARTUP CRASH:", e.message);
}

// 2. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ====================================================
// 3. مسارات خدمة ملفات HTML (Views)
// ====================================================

// المسار الأساسي: سيعرض شاشة البداية (Splash)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'splash.html'));
});

// المسار الذي يتم توجيه المستخدم إليه بعد انتهاء عرض Splash
app.get('/auth-check', (req, res) => {
    // منطق وهمي: يجب استبداله بمنطق التحقق من الجلسات
    const isAuthenticated = false; 

    if (isAuthenticated) {
        res.redirect('/home');
    } else {
        res.redirect('/login');
    }
});

// مسار تسجيل الدخول
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// مسار إنشاء حساب جديد
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// مسار الصفحة الرئيسية
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});


// ====================================================
// 4. مسارات معالجة النماذج (Form Handling)
// ====================================================

// معالجة نموذج إنشاء الحساب (POST /register)
app.post('/register', upload.single('profile_picture'), async (req, res) => {
    if (!isFirebaseInitialized || !process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(503).send('فشل الخدمة: تهيئة Firebase/Cloudinary غير مكتملة. يرجى مراجعة إعدادات Vercel.');
    }
    
    const { username, password } = req.body;
    const file = req.file;

    try {
        let profileImageUrl = null;
        if (file) {
            // أ. رفع الصورة إلى Cloudinary باستخدام المخزن المؤقت (buffer)
            const result = await cloudinary.uploader.upload(
                `data:${file.mimetype};base64,${file.buffer.toString('base64')}`, 
                {
                    folder: "Aite/Trimer_Profiles"
                }
            );
            profileImageUrl = result.secure_url;
        }

        // ب. تسجيل المستخدم في Firebase Firestore 
        const db = firebaseAdmin.firestore();
        await db.collection('users').doc(username).set({
            username: username,
            password_hash: password, 
            profile_image_url: profileImageUrl,
            created_at: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });

        res.redirect('/login?success=true');

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).send('فشل إنشاء الحساب: ' + error.message);
    }
});

// مسار معالجة نموذج تسجيل الدخول (POST /login)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    res.redirect('/home'); 
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`🚀 خادم Aite (Trimer) يعمل على المنفذ: ${port}`);
});
