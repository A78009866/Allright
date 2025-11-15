// index.js - ملف الخادم النهائي لمشروع Trimer (Aite)

const express = require('express');
const firebaseAdmin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const multer = require('multer');
const fs = require('fs'); // لعملية حذف الملف المؤقت بعد الرفع

const upload = multer({ dest: 'uploads/' });

const app = express();
const port = process.env.PORT || 3000; 

// ====================================================
// 1. تهيئة المكتبات (Configuration) - الكود المُعدَّل لزيادة الثبات
// ====================================================

let isFirebaseInitialized = false;

try {
    // 1.1. تهيئة Firebase
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    // التحقق من وجود المفتاح وعدم كونه فارغاً
    if (serviceAccountString && serviceAccountString.trim() !== '') {
        try {
            // محاولة تحليل JSON بحذر
            const serviceAccount = JSON.parse(serviceAccountString); 
            
            // التأكد من عدم تهيئة Firebase مسبقاً في بيئة Vercel
            if (!firebaseAdmin.apps.length) {
                firebaseAdmin.initializeApp({
                    credential: firebaseAdmin.credential.cert(serviceAccount),
                });
                isFirebaseInitialized = true;
                console.log("SUCCESS: Firebase initialized.");
            }
        } catch (jsonError) {
            // هذا الخطأ سيظهر في سجلات Vercel إذا كانت صيغة JSON غير صالحة
            console.error("CRITICAL ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Check Vercel value format. Error:", jsonError.message);
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
    // التقاط أي خطأ غير متوقع في بداية تشغيل الخادم
    console.error("UNEXPECTED SERVER STARTUP CRASH:", e.message);
}

// 2. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// لخدمة الملفات الثابتة (إذا كان لديك مجلد public)
// app.use(express.static(path.join(__dirname, 'public'))); 


// ====================================================
// 3. مسارات خدمة ملفات HTML (Views)
// ====================================================

// المسار الأساسي: سيعرض شاشة البداية (Splash) أولاً
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'splash.html'));
});

// المسار الذي يتم توجيه المستخدم إليه بعد انتهاء عرض Splash
app.get('/auth-check', (req, res) => {
    // *** منطق وهمي: يجب استبداله بمنطق التحقق من الجلسات (Sessions/Cookies) ***
    
    // مثال: افترض أن المستخدم غير مسجل دخول
    const isAuthenticated = false; 

    if (isAuthenticated) {
        res.redirect('/home'); // توجيه إلى الصفحة الرئيسية
    } else {
        res.redirect('/login'); // توجيه إلى صفحة تسجيل الدخول
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

// مسار الصفحة الرئيسية (بعد تسجيل الدخول الناجح)
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});


// ====================================================
// 4. مسارات معالجة النماذج (Form Handling)
// ====================================================

// معالجة نموذج إنشاء الحساب (POST /register)
app.post('/register', upload.single('profile_picture'), async (req, res) => {
    if (!isFirebaseInitialized) {
        return res.status(500).send('فشل الخادم: تهيئة Firebase غير مكتملة.');
    }
    
    const { username, password } = req.body;
    const file = req.file;

    try {
        let profileImageUrl = null;
        if (file) {
            // أ. رفع الصورة إلى Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
                folder: "Aite/Trimer_Profiles"
            });
            profileImageUrl = result.secure_url;
            
            // حذف الملف المؤقت بعد الرفع
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }

        // ب. تسجيل المستخدم في Firebase Firestore (كمثال)
        const db = firebaseAdmin.firestore();
        await db.collection('users').doc(username).set({
            username: username,
            password_hash: password, // يجب تشفير كلمة المرور (Hashing)
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
    // منطق التحقق من البيانات وتعريف جلسة المستخدم هنا
    const { username, password } = req.body;
    
    res.redirect('/home'); // توجيه لصفحة الرئيسية بعد الدخول
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`🚀 خادم Aite (Trimer) يعمل على المنفذ: ${port}`);
});
