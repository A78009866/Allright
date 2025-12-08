// server.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 
import { v4 as uuidv4 } from 'uuid'; // لإنشاء معرّفات فريدة (سنحتاج npm install uuid)

// 1. تهيئة dotenv
dotenv.config();

// إعداد المسارات
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// *تحديث: نفترض أن index.html و admin.html في نفس المجلد حاليًا للتبسيط*
const INDEX_FILE_PATH = path.join(__dirname, 'index.html'); 
const ADMIN_FILE_PATH = path.join(__dirname, 'admin.html'); 

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات وهمية في الذاكرة لتخزين الطلبات
// الحالة (status): pending (معلق), approved (موافق عليه), rejected (مرفوض)
// paymentStatus: unpaid (لم يتم الدفع), paid (تم الدفع)
let enrollmentRequests = [];

// 2. تفعيل Body-parser لقراءة بيانات JSON
app.use(express.json());

// ----------------------------------------------------------------------
// 3. مسارات الواجهات الأمامية (Serving HTML)
// ----------------------------------------------------------------------

// واجهة الطالب
app.get('/', (req, res) => {
    fs.readFile(INDEX_FILE_PATH, 'utf-8', (err, data) => {
        if (err) return res.status(500).send('<h1>خطأ 500: لم يتم العثور على index.html</h1>');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});

// واجهة الأدمن (تتطلب حماية في بيئة حقيقية)
app.get('/admin', (req, res) => {
    fs.readFile(ADMIN_FILE_PATH, 'utf-8', (err, data) => {
        if (err) {
             console.error(`❌ خطأ في قراءة ملف admin.html: ${err.message}`);
             // إذا لم يكن ملف admin.html موجودًا بعد، قم بإخبار المستخدم
             return res.status(500).send('<h1>خطأ 500: يجب إنشاء ملف admin.html أولاً.</h1>');
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
    
    // إنشاء طلب جديد
    const newRequest = {
        id: uuidv4(), // معرّف فريد للطلب
        ...data,
        status: 'pending', // حالة معلقة دائمًا في البداية
        barcode: null, // لا يوجد كود بار حتى الموافقة
        paymentStatus: 'unpaid', // لم يتم الدفع بعد
        timestamp: new Date().toISOString()
    };
    
    enrollmentRequests.push(newRequest);

    console.log(`\n🎉 طلب تسجيل جديد معلق (${newRequest.id}): ${newRequest.fullName}`);
    
    // إرجاع ID الطلب للطالب لمتابعة حالته
    res.json({ success: true, message: 'تم إرسال طلبك. حالته معلق.', requestId: newRequest.id });
});

// 4.2. جلب طلبات التسجيل (للأدمن)
app.get('/api/requests', (req, res) => {
    // إرسال نسخة من القائمة لتجنب التعديل المباشر غير المقصود
    res.json(enrollmentRequests.map(req => ({ ...req })));
});

// 4.3. الموافقة على طلب (للأدمن)
app.post('/api/approve', (req, res) => {
    const { id } = req.body;
    const request = enrollmentRequests.find(r => r.id === id);

    if (!request) {
        return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    
    if (request.status === 'approved') {
         return res.json({ success: true, message: 'تمت الموافقة عليه مسبقًا.' });
    }
    
    // توليد كود بار فريد بعد الموافقة
    const barcode = `ACADEMY-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getTime().toString().slice(-6)}`;
    
    request.status = 'approved';
    request.barcode = barcode; 
    
    console.log(`\n✅ تمت الموافقة على الطلب ${id}. كود البار: ${barcode}`);
    res.json({ success: true, message: 'تمت الموافقة وتوليد كود البار.', barcode });
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
    
    console.log(`\n❌ تم رفض الطلب ${id}.`);
    res.json({ success: true, message: 'تم رفض طلب التسجيل.' });
});

// 4.5. التحقق من حالة الدفع (ماسح الكود - للأدمن)
app.post('/api/check-status', (req, res) => {
    const { barcode } = req.body;
    const request = enrollmentRequests.find(r => r.barcode === barcode);

    if (!request) {
        return res.json({ success: false, status: 'Invalid', message: 'كود غير صالح أو لم تتم الموافقة عليه بعد.', barcode });
    }
    
    // يمكن هنا التبديل بين حالتي الدفع
    // محاكاة التبديل لغرض الاختبار (في الإنتاج يكون زر منفصل)
    if (request.paymentStatus === 'unpaid') {
        request.paymentStatus = 'paid';
        console.log(`\n💰 تم تسجيل الدفع بنجاح لكود: ${barcode}`);
        return res.json({ success: true, status: 'paid', message: 'تم تسجيل الدفع بنجاح.', request: request });
    } else {
        request.paymentStatus = 'unpaid';
        console.log(`\n💸 تم إعادة تعيين حالة الدفع إلى "لم يتم الدفع" لكود: ${barcode}`);
        return res.json({ success: true, status: 'unpaid', message: 'تم إلغاء حالة الدفع (للتجربة).', request: request });
    }

});

// 4.6. جلب حالة طلب محدد (للطالب)
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const request = enrollmentRequests.find(r => r.id === id);
    
    if (!request) {
        return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    
    // إرجاع البيانات الهامة للطالب فقط
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
    console.log(`💻 لوحة تحكم الأدمن: http://localhost:${PORT}/admin`);
    console.log(`💡 [هام]: تذكر تشغيل 'npm install uuid' لاستخدام هذا الكود.`);
});
