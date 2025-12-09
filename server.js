// server.js

// 1. استيراد المكتبات الضرورية
const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const path = require('path'); // لإدارة المسارات

const app = express();
const port = 3000;

// 2. إعداد قاعدة البيانات (MongoDB)
// ⚠️ هام: استبدل الرابط برابط قاعدة بياناتك الفعلي 
const dbURI = 'mongodb://localhost:27017/MaaliAcademyDB'; 
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB Connected Successfully.'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// 3. تعريف مخطط (Schema) وموديل (Model) التسجيل
const registrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: { type: String, required: true }, 
  year: { type: String, required: true }, 
  subject: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  qrCodeData: { type: String, default: null }, // لتخزين بيانات رمز QR (Data URL)
  createdAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model('Registration', registrationSchema);

// 4. الإعدادات الوسطية (Middleware)
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// 5. لخدمة ملف HTML للواجهة الأمامية
// 🔴 التعديل هنا لخدمة index.html من مجلد "views"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// --- المسارات (API Endpoints) ---

// 6. المسار: إنشاء طلب تسجيل جديد (لواجهة المستخدم)
app.post('/api/register', async (req, res) => {
  try {
    const { name, level, year, subject } = req.body;
    
    // التحقق الأساسي من البيانات
    if (!name || !level || !year || !subject) {
        return res.status(400).json({ message: 'الرجاء إكمال جميع حقول التسجيل.' });
    }

    const newRegistration = new Registration({ name, level, year, subject });
    await newRegistration.save();

    res.status(201).json({ 
      success: true,
      message: 'تم إرسال طلب التسجيل بنجاح. سيتم مراجعته من قبل الإدارة.', 
      registrationId: newRegistration._id 
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء معالجة الطلب.' });
  }
});

// 7. المسار: قبول طلب التسجيل وإنشاء رمز QR (لوحة الأدمن)
app.post('/api/admin/accept/:id', async (req, res) => {
  try {
    const registrationId = req.params.id;
    const registration = await Registration.findById(registrationId);

    if (!registration) {
      return res.status(404).json({ message: 'لم يتم العثور على طلب التسجيل.' });
    }
    
    // بيانات رمز QR: استخدام ID فريد للتحقق
    const qrData = `MAALI-REG-ID:${registration._id}`;
    const qrCodeImage = await QRCode.toDataURL(qrData);

    registration.status = 'accepted';
    registration.qrCodeData = qrCodeImage;
    await registration.save();

    res.json({ 
      message: 'تم قبول التسجيل بنجاح وإنشاء رمز QR.', 
      qrCodeImage: qrCodeImage, 
      registrationDetails: registration 
    });

  } catch (error) {
    console.error('Acceptance Error:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء القبول.' });
  }
});

// 8. المسار: مسح رمز QR والتحقق من صلاحيته (جهاز الأدمن/الماسح)
app.post('/api/admin/scan', async (req, res) => {
    try {
        const { scannedData } = req.body; 

        if (!scannedData || !scannedData.startsWith('MAALI-REG-ID:')) {
            return res.status(400).json({ message: 'رمز QR غير صالح أو بتنسيق خاطئ.' });
        }

        const registrationId = scannedData.split(':')[1];
        
        const registration = await Registration.findById(registrationId);

        if (!registration) {
            return res.status(404).json({ message: 'هذا الرمز لا يمثل تسجيلًا صالحًا في النظام.' });
        }

        if (registration.status !== 'accepted') {
            return res.status(403).json({ 
                message: `التسجيل موجود، ولكن حالته: ${registration.status}. (غير مقبول بعد)`,
                details: registration
            });
        }
        
        res.json({ 
            message: '✅ تسجيل صالح ومقبول. تم التحقق بنجاح.', 
            student: registration.name, 
            course: `${registration.level} - ${registration.year} - ${registration.subject}`,
            time: new Date().toLocaleTimeString('ar-EG')
        });

    } catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء عملية المسح.' });
    }
});


// 9. تشغيل الخادم
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
