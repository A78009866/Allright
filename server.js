require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const app = express();

// إعداد Firebase
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();

app.use(bodyParser.json());
app.use(express.static('views')); // لخدمة الملفات الثابتة

// --- Routes (المسارات) ---

// الصفحة الرئيسية (الطالب)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// صفحة الأدمن
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// صفحة حالة الطالب (عند مسح الكود)
app.get('/check', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'status.html'));
});

// --- API Endpoints ---

// 1. تسجيل الدخول/انشاء حساب
app.post('/api/login', async (req, res) => {
    const { fullName, phone } = req.body;
    if (!fullName || !phone) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });

    const userRef = db.ref('users/' + phone);
    
    try {
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            // مستخدم جديد
            await userRef.set({
                fullName,
                phone,
                createdAt: admin.database.ServerValue.TIMESTAMP
            });
        }
        res.json({ success: true, message: 'تم الدخول بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. إرسال طلب تسجيل مادة
app.post('/api/register-subject', async (req, res) => {
    const { phone, fullName, stage, subject, branch } = req.body;
    
    try {
        const newRequestRef = db.ref('requests').push();
        await newRequestRef.set({
            requestId: newRequestRef.key,
            phone,
            fullName,
            stage,
            subject,
            branch,
            status: 'pending', // pending, approved, rejected
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        res.json({ success: true, message: 'تم إرسال الطلب بنجاح', requestId: newRequestRef.key });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. جلب طلبات الطالب (للمتابعة)
app.get('/api/my-requests/:phone', async (req, res) => {
    const phone = req.params.phone;
    try {
        const ref = db.ref('requests');
        const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
        const requests = [];
        snapshot.forEach(child => {
            requests.push(child.val());
        });
        res.json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. جلب جميع الطلبات (للأدمن)
app.get('/api/admin/requests', async (req, res) => {
    try {
        const ref = db.ref('requests');
        const snapshot = await ref.once('value');
        const requests = [];
        snapshot.forEach(child => {
            requests.push(child.val());
        });
        // ترتيب عكسي (الأحدث أولاً)
        res.json({ success: true, data: requests.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. تحديث حالة الطلب (للأدمن)
app.post('/api/admin/update-status', async (req, res) => {
    const { requestId, status } = req.body;
    try {
        await db.ref('requests/' + requestId).update({ status });
        res.json({ success: true, message: 'تم تحديث الحالة' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. جلب بيانات الطالب عند المسح (Public)
app.get('/api/student-status/:phone', async (req, res) => {
    const phone = req.params.phone;
    try {
        // جلب بيانات المستخدم
        const userSnap = await db.ref('users/' + phone).once('value');
        if(!userSnap.exists()) return res.json({ success: false, message: 'طالب غير مسجل' });

        // جلب المواد المقبولة فقط
        const reqSnap = await db.ref('requests').orderByChild('phone').equalTo(phone).once('value');
        const approvedSubjects = [];
        
        reqSnap.forEach(child => {
            const val = child.val();
            if(val.status === 'approved') {
                approvedSubjects.push(val);
            }
        });

        res.json({ 
            success: true, 
            student: userSnap.val(), 
            subjects: approvedSubjects 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
      
