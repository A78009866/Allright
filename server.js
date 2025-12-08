// server.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 
import { v4 as uuidv4 } from 'uuid'; // وحدة UUID ضرورية لإنشاء IDs فريدة

// 1. تهيئة dotenv
dotenv.config();

// إعداد المسارات
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحديد مسار مجلد views
const VIEWS_DIR = path.join(__dirname, 'views');
const INDEX_FILE_PATH = path.join(VIEWS_DIR, 'index.html'); 
const ADMIN_FILE_PATH = path.join(VIEWS_DIR, 'admin.html'); 

// قاعدة بيانات وهمية في الذاكرة لتخزين الطلبات
// الحالة (status): pending (معلق), approved (موافق عليه), rejected (مرفوض)
// paymentStatus: unpaid (لم يتم الدفع), paid (تم الدفع)
let enrollmentRequests = [];

const app = express();
const PORT = process.env.PORT || 3000;

// 2. تفعيل Body-parser لقراءة بيانات JSON
app.use(express.json());

// ----------------------------------------------------------------------
// 3. مسارات الواجهات الأمامية (Serving HTML)
// ----------------------------------------------------------------------

// واجهة الطالب
app.get('/', (req, res) => {
    fs.readFile(INDEX_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
             console.error(`❌ خطأ في قراءة ملف index.html: ${err.message}`);
             return res.status(500).send('<h1>خطأ 500: لم يتم العثور على index.html. يرجى التأكد من وجوده في مجلد views/</h1>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});

// واجهة الأدمن 
app.get('/admin', (req, res) => {
    fs.readFile(ADMIN_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
             console.error(`❌ خطأ في قراءة ملف admin.html: ${err.message}`);
             return res.status(500).send('<h1>خطأ 500: لم يتم العثور على admin.html. يرجى التأكد من وجوده في مجلد views/</h1>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});


// ----------------------------------------------------------------------
// 4. نقاط نهاية API لإدارة الطلبات
// ----------------------------------------------------------------------

// 4.1. استقبال طلب تسجيل جديد (الطالب)
app.post('/api/register', (req, res) => {
    const data = req.body;
    if (!data.fullName || !data.subject || !data.stage) {
        return res.status(400).json({ success: false, message: 'بيانات التسجيل غير كاملة.' });
    }
    
    const newRequest = {
        id: uuidv4(), 
        ...data,
        status: 'pending', 
        barcode: null, 
        paymentStatus: 'unpaid', // يبدأ دائماً بـ "لم يتم الدفع"
        timestamp: new Date().toISOString()
    };
    
    enrollmentRequests.push(newRequest);
    res.json({ success: true, message: 'تم إرسال طلبك. حالته معلق.', requestId: newRequest.id });
});

// 4.2. جلب طلبات التسجيل (للأدمن)
app.get('/api/requests', (req, res) => {
    res.json(enrollmentRequests.map(req => ({ ...req })));
});

// 4.3. الموافقة على طلب (للأدمن) - الموافقة تعني الدفع وتوليد الباركود
app.post('/api/approve', (req, res) => {
    const { id } = req.body;
    const request = enrollmentRequests.find(r => r.id === id);

    if (!request) {
        return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    
    if (request.status === 'approved' && request.paymentStatus === 'paid') {
         return res.json({ success: true, message: 'تمت الموافقة والدفع مسبقًا.' });
    }
    
    // 1. توليد كود بار فريد (محاكاة QR Code)
    const barcode = `ACADEMY-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getTime().toString().slice(-6)}`;
    
    // 2. تحديث الحالة
    request.status = 'approved';
    request.paymentStatus = 'paid'; // ******* تم تعيين الدفع تلقائياً *******
    request.barcode = barcode; 
    
    res.json({ success: true, message: 'تمت الموافقة وتسجيل الدفع وتوليد كود البار.', barcode });
});

// 4.4. رفض طلب (للأدمن)
app.post('/api/reject', (req, res) => {
    const { id } = req.body;
    const request = enrollmentRequests.find(r => r.id === id);

    if (!request) {
        return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    
    request.status = 'rejected';
    request.barcode = null; 
    
    res.json({ success: true, message: 'تم رفض طلب التسجيل.' });
});

// 4.5. التحقق من حالة الدفع (ماسح الكود - للأدمن)
app.post('/api/check-status', (req, res) => {
    const { barcode } = req.body;
    const request = enrollmentRequests.find(r => r.barcode === barcode);

    if (!request) {
        return res.json({ success: false, status: 'Invalid', message: 'كود غير صالح أو لم تتم الموافقة عليه بعد.', barcode });
    }
    
    // عرض حالة الطالب
    if (request.paymentStatus === 'paid') {
        return res.json({ success: true, status: 'paid', message: 'تم تسجيل الطالب بنجاح (مدفوع).', request: request });
    } else {
        // هذا لن يحدث في سيناريو الموافقة التلقائية، ولكنه يترك للحماية
        return res.json({ success: true, status: 'unpaid', message: 'الطالب موافق عليه ولكن لم يسجل الدفع بعد.', request: request });
    }

});

// 4.6. جلب حالة طلب محدد (للطالب)
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const request = enrollmentRequests.find(r => r.id === id);
    
    if (!request) {
        return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    
    res.json({
        success: true,
        status: request.status,
        subject: request.subject,
        stage: request.stage,
        fullName: request.fullName,
        barcode: request.barcode,
        paymentStatus: request.paymentStatus,
    });
});

// 5. تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 خادم أكاديمية المعالي يعمل على http://localhost:${PORT}`);
});
