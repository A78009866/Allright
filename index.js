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
// 1. تهيئة المكتبات (Configuration)
// ملاحظة: يجب وضع متغيرات البيئة في إعدادات Vercel كما ذكرنا سابقاً
// ====================================================

try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
        });
        cloudinary.config({ 
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
            api_key: process.env.CLOUDINARY_API_KEY, 
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
        console.log("Firebase and Cloudinary initialized.");
    } else {
        console.warn("Service account not found. Firebase/Cloudinary not fully initialized.");
    }
} catch (e) {
    console.error("Error during initialization:", e.message);
}

// 2. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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
    // *************************************************************************
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
            // يجب تشفير كلمة المرور (Hashing)
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
    // منطق التحقق من البيانات وتعريف جلسة المستخدم هنا
    
    res.redirect('/home'); // توجيه لصفحة الرئيسية بعد الدخول
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`🚀 خادم Aite (Trimer) يعمل على المنفذ: ${port}`);
});
