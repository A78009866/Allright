// server.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 
import { v4 as uuidv4 } from 'uuid'; 

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تعريف مسار ملفات الواجهات
const VIEWS_DIR = path.join(__dirname, 'views');
const INDEX_FILE_PATH = path.join(VIEWS_DIR, 'index.html'); 
const ADMIN_FILE_PATH = path.join(VIEWS_DIR, 'admin.html'); 

// قاعدة بيانات وهمية في الذاكرة لتخزين الطلبات
let enrollmentRequests = [];

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ----------------------------------------------------------------------
// 1. مسارات الواجهات الأمامية (Serving HTML)
// ----------------------------------------------------------------------

// واجهة الطالب
app.get('/', (req, res) => {
    fs.readFile(INDEX_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
             return res.status(500).send('<h1>خطأ 500: لم يتم العثور على index.html في مجلد views/</h1>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});

// واجهة الأدمن 
app.get('/admin', (req, res) => {
    fs.readFile(ADMIN_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
             // يمكنك إنشاء ملف admin.html لاحقاً بنفس التصميم
             return res.status(500).send('<h1>خطأ 500: لم يتم العثور على admin.html. يرجى إنشاء الملف.</h1>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});


// ----------------------------------------------------------------------
// 2. نقاط نهاية API لإدارة الطلبات
// ----------------------------------------------------------------------

// 2.1. استقبال طلب تسجيل جديد (الطالب)
app.post('/api/register', (req, res) => {
    const data = req.body;
    // التأكد من أن حقل المرحلة/الصف (stage) والشعبة (branch) متوفران
    if (!data.fullName || !data.subject || !data.stage || !data.branch) {
        return res.status(400).json({ success: false, message: 'الرجاء تعبئة حقول (الاسم واللقب، المرحلة/الصف، المادة، والشعبة) بشكل كامل.' });
    }
    
    const newRequest = {
        id: uuidv4(), 
        ...data,
        status: 'pending', 
        barcode: null, 
        paymentStatus: 'unpaid', 
        timestamp: new Date().toISOString()
    };
    
    enrollmentRequests.push(newRequest);
    res.json({ success: true, message: '🎉 تهانينا! تم استلام طلب تسجيلك بنجاح. يمكنك متابعة حالته في هذه الصفحة.', requestId: newRequest.id });
});

// 2.2. جلب طلبات التسجيل (للأدمن)
app.get('/api/requests', (req, res) => {
    // جلب جميع الطلبات للوحة الأدمن
    res.json(enrollmentRequests.map(req => ({ ...req })));
});

// 2.3. الموافقة على طلب (للأدمن) 
app.post('/api/approve', (req, res) => {
    const { id } = req.body;
    const request = enrollmentRequests.find(r => r.id === id);

    if (!request) {
        return res.status(404).json({ success: false, message: 'عذراً، الطلب غير موجود في النظام.' });
    }
    
    if (request.status === 'approved') {
         return res.json({ success: true, message: 'تمت الموافقة والدفع مسبقًا لهذا الطلب.' });
    }
    
    const barcode = `ACADEMY-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getTime().toString().slice(-6)}`;
    
    request.status = 'approved';
    request.paymentStatus = 'paid'; 
    request.barcode = barcode; 
    
    res.json({ success: true, message: `✅ تمت الموافقة على طلب ${request.fullName} بنجاح. تم تأكيد الدفع وتوليد كود الدخول.`, barcode });
});

// 2.4. رفض طلب (للأدمن)
app.post('/api/reject', (req, res) => {
    const { id } = req.body;
    const request = enrollmentRequests.find(r => r.id === id);

    if (!request) {
        return res.status(404).json({ success: false, message: 'عذراً، الطلب غير موجود في النظام.' });
    }
    
    request.status = 'rejected';
    request.barcode = null; 
    
    res.json({ success: true, message: `❌ تم رفض طلب التسجيل لـ ${request.fullName}.` });
});

// 2.5. التحقق من حالة الطلب باستخدام كود البار (ماسح الكود - للأدمن)
app.post('/api/check-status', (req, res) => {
    const { barcode } = req.body;
    const request = enrollmentRequests.find(r => r.barcode === barcode);

    if (!request) {
        return res.json({ success: false, status: 'Invalid', message: 'كود الدخول غير صالح أو غير موجود في قاعدة بيانات الموافقات.' });
    }
    
    if (request.status !== 'approved') {
        return res.json({ 
            success: true, 
            status: request.status, 
            message: `⚠️ تنبيه: الطلب لـ ${request.fullName} لم يتم الموافقة عليه بعد. الحالة: ${request.status === 'pending' ? 'معلق' : 'مرفوض'}`,
            request: request
        });
    }
    
    if (request.paymentStatus === 'paid') {
        return res.json({ 
            success: true, 
            status: 'paid', 
            message: `✅ تم تسجيل دخول الطالب: ${request.fullName}. مرحباً بك في شعبة ${request.branch}.`, 
            request: request 
        });
    } else {
         return res.json({ 
            success: true, 
            status: 'unpaid', 
            message: `🔴 تنبيه: الطالب ${request.fullName} موافق عليه ولكن سجل الدفع يشير إلى عدم الدفع!`, 
            request: request 
        });
    }
});

// 2.6. جلب حالة طلب محدد (للطالب)
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const request = enrollmentRequests.find(r => r.id === id);
    
    if (!request) {
        return res.status(404).json({ success: false, message: 'عذراً، رقم الطلب هذا غير مسجل لدينا.' });
    }
    
    res.json({
        success: true,
        status: request.status,
        subject: request.subject,
        stage: request.stage, // تحتوي على المرحلة والصف معاً (مثال: 'الثانوية - السنة الثالثة')
        fullName: request.fullName,
        barcode: request.barcode,
        paymentStatus: request.paymentStatus,
        branch: request.branch
    });
});


// 3. تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 خادم أكاديمية المعالي يعمل على http://localhost:${PORT}`);
});
