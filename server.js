const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// تخزين التوكنات
let tokenPool = [];
let currentIndex = 0;

// إضافة توكن جديد
app.post('/api/tokens', (req, res) => {
    const { token, account } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'التوكن مطلوب' });
    }
    
    tokenPool.push({
        token: token,
        account: account || `حساب ${tokenPool.length + 1}`,
        usageCount: 0,
        active: true
    });
    
    res.json({ 
        success: true, 
        message: 'تم إضافة التوكن بنجاح',
        total: tokenPool.length 
    });
});

// إرسال برومبت إلى Lovable
app.post('/api/send', async (req, res) => {
    const { prompt, projectId } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'البرومبت مطلوب' });
    }
    
    if (!projectId) {
        return res.status(400).json({ error: 'معرف المشروع مطلوب' });
    }
    
    if (tokenPool.length === 0) {
        return res.status(429).json({ error: 'لا توجد توكنات متاحة. أضف توكن أولاً!' });
    }
    
    // اختيار توكن (تدوير)
    const tokenObj = tokenPool[currentIndex % tokenPool.length];
    currentIndex = (currentIndex + 1) % tokenPool.length;
    tokenObj.usageCount++;
    
    console.log(`📤 إرسال برومبت باستخدام حساب: ${tokenObj.account}`);
    
    try {
        const response = await axios.post(
            `https://api.lovable.dev/projects/${projectId}/chat`,
            { message: prompt },
            {
                headers: {
                    'Authorization': `Bearer ${tokenObj.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        res.json({
            success: true,
            data: response.data,
            accountUsed: tokenObj.account
        });
        
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message);
        
        // إذا كان التوكن غير صالح
        if (error.response && error.response.status === 401) {
            tokenObj.active = false;
            console.warn(`⚠️ توكن ${tokenObj.account} غير صالح! تم إلغاء تنشيطه.`);
        }
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message,
            accountUsed: tokenObj.account
        });
    }
});

// عرض حالة الحسابات
app.get('/api/status', (req, res) => {
    res.json({
        total: tokenPool.length,
        active: tokenPool.filter(t => t.active).length,
        accounts: tokenPool.map(t => ({
            account: t.account,
            usageCount: t.usageCount,
            active: t.active
        }))
    });
});

// حذف حساب
app.delete('/api/tokens/:account', (req, res) => {
    const { account } = req.params;
    const index = tokenPool.findIndex(t => t.account === account);
    
    if (index === -1) {
        return res.status(404).json({ error: 'الحساب غير موجود' });
    }
    
    tokenPool.splice(index, 1);
    res.json({ success: true, message: `تم حذف الحساب ${account}` });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    console.log(`📋 نقاط النهاية:`);
    console.log(`   POST   /api/tokens   - إضافة توكن`);
    console.log(`   POST   /api/send     - إرسال برومبت`);
    console.log(`   GET    /api/status   - حالة الحسابات`);
    console.log(`   DELETE /api/tokens/:account - حذف حساب`);
});
