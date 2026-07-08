import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 1. برمجيات وسيطة لتحسين الأداء والأمان (Middlewares)
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. مصفوفة الصلاحيات الصارمة على مستوى الخادم (Server-side RBAC)
const ROLES_PERMISSIONS = {
    senior: ['view_all', 'manage_team', 'discharge', 'edit_plan', 'add_vitals', 'edit_notes', 'handover'],
    junior: ['view_all', 'edit_notes', 'handover', 'add_vitals'],
    nurse: ['view_all', 'add_vitals'],
    admin: ['view_all', 'manage_users', 'audit_log']
};

// وسيط للتحقق من الصلاحيات الأمنية
function checkPermission(requiredPermission) {
    return (req, res, next) => {
        const userRole = req.headers['x-user-role'];
        if (!userRole || !ROLES_PERMISSIONS[userRole] || !ROLES_PERMISSIONS[userRole].includes(requiredPermission)) {
            return res.status(403).json({ 
                error: `خطأ أمني: الدور الحالي (${userRole || 'غير معروف'}) لا يملك صلاحية المتابعة: [${requiredPermission}]` 
            });
        }
        next();
    };
}

// 3. دوال مساعدة للتعامل الآمن مع ملف البيانات
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // إذا كان الملف غير موجود، نقوم بإنشاء هيكلية أولية فارغة ونظيفة
        const initialStructure = { patients: [], tasks: [], clinic: [], messages: [], auditLog: [] };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialStructure, null, 2), 'utf8');
        return initialStructure;
    }
}

async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// دالة تسجيل العمليات التلقائي (Audit Logger)
async function logAction(user, action, targetId, details) {
    const data = await readData();
    const logEntry = {
        id: 'log_' + Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        user: user || 'Anonymous',
        action,
        targetId,
        details
    };
    data.auditLog.unshift(logEntry); // إضافة الحدث في البداية لسهولة الترتيب
    await writeData(data);
}

// ================================================================
// 4. نقاط الـ API المفتوحة والمؤمنة (API Routes)
// ================================================================

// جلب كافة البيانات للحالة الشاملة للتطبيق
app.get('/api/data', checkPermission('view_all'), async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "فشل الخادم في قراءة البيانات الكلية" });
    }
});

// إضافة مريض جديد (نموذج القبول 3 خطوات)
app.post('/api/patients', checkPermission('edit_notes'), async (req, res) => {
    try {
        const db = await readData();
        const newPatient = {
            ...req.body,
            id: 'pat_' + Date.now(),
            stage: 1, // البداية التلقائية من مرحلة الاستقبال
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        db.patients.push(newPatient);
        await writeData(db);
        
        await logAction(req.headers['x-user-name'], 'CREATE_PATIENT', newPatient.id, `تم قبول الطفل: ${newPatient.name}`);
        res.status(201).json(newPatient);
    } catch (error) {
        res.status(500).json({ error: "فشل في تسجيل المريض الجديد" });
    }
});

// تحديث جزئي ذكي لبيانات مريض (تعديل خطة، إضافة علامات حيوية، تغيير المرحلة)
app.patch('/api/patients/:id', checkPermission('view_all'), async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readData();
        const patientIndex = db.patients.findIndex(p => p.id === id);

        if (patientIndex === -1) return res.status(404).json({ error: "المريض غير موجود بنظام الأجنحة" });

        // التحقق الخاص بصلاحية الخروج الجراحي أو الطبي النهائي (Discharge)
        if (req.body.stage === 4 && db.patients[patientIndex].stage !== 4) {
            const userRole = req.headers['x-user-role'];
            if (!ROLES_PERMISSIONS[userRole].includes('discharge')) {
                return res.status(403).json({ error: "لا يمكن إتمام الخروج إلا بواسطة الاستشاري أو الأخصائي" });
            }
        }

        // الدمج الذكي للبيانات المتغيرة مع الحفاظ على البيانات القديمة غير المعدلة
        db.patients[patientIndex] = {
            ...db.patients[patientIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        await writeData(db);
        await logAction(req.headers['x-user-name'], 'UPDATE_PATIENT', id, `تعديل حقول في ملف المريض: ${Object.keys(req.body).join(', ')}`);
        res.json(db.patients[patientIndex]);
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ أثناء معالجة التحديث الجزئي للمريض" });
    }
});

// حذف سجل أو مهمة أو موعد عيادة
app.delete('/api/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        const userRole = req.headers['x-user-role'];

        // تقييد الحذف العشوائي للمرضى والمهام وجعلها للأدوار العليا
        let requiredPerm = 'edit_notes';
        if (collection === 'patients') requiredPerm = 'discharge';
        if (collection === 'auditLog') requiredPerm = 'manage_users';

        if (!userRole || !ROLES_PERMISSIONS[userRole] || !ROLES_PERMISSIONS[userRole].includes(requiredPerm)) {
            return res.status(403).json({ error: "ليس لديك صلاحية حذف هذه السجلات من قاعدة البيانات" });
        }

        const db = await readData();
        if (!db[collection]) return res.status(400).json({ error: "المجموعة المطلوبة غير متوفرة" });

        db[collection] = db[collection].filter(item => item.id !== id);
        await writeData(db);

        await logAction(req.headers['x-user-name'], `DELETE_${collection.toUpperCase()}`, id, `تم حذف العنصر بنجاح`);
        res.json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: "فشل الخادم في معالجة طلب الحذف" });
    }
});

// نقاط عامة للمهام، الرسائل، ومواعيد العيادة (Generic POST & PATCH لحفظ التكامل)
app.post('/api/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        const db = await readData();
        if (!db[collection]) db[collection] = [];

        const newItem = {
            ...req.body,
            id: (collection.substr(0,3)) + '_' + Date.now(),
            createdAt: new Date().toISOString()
        };

        db[collection].push(newItem);
        await writeData(db);
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ error: "فشل إضافة العنصر إلى المجموعة المطلوبة" });
    }
});

// ================================================================
// 5. آلية مكافحة الخمول ومستمع المنافذ (Self-Ping & Listen)
// ================================================================

app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بكفاءة وأمان كامل على المنفذ: ${PORT}`);
    
    // دالة التنبيه الذاتي (Self-Ping) كل 14 دقيقة لمنع السيرفر المجاني من النوم
    setInterval(() => {
        const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        fetch(`${baseUrl}/api/data`, { headers: { 'x-user-role': 'admin' } })
            .then(() => console.log('🔄 تم إرسال نبضة تنشيط داخلية ناجحة للمحافظة على استيقاظ السيرفر.'))
            .catch((e) => console.warn('⚠️ فشلت نبضة التنشيط ولكن السيرفر مستمر في العمل:', e.message));
    }, 14 * 60 * 1000);
});