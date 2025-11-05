const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Готовый bin ID - я создал его для вас
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6905c636ae596e708f3c09a8';
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || '$2a$10$J24VfFSehaO.P78eeSB/feH0/x9TKke3QBNn5eaCyqzwEnwv/w4sC';

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const JSONBIN_HEADERS = {
    'X-Master-Key': JSONBIN_API_KEY,
    'Content-Type': 'application/json'
};

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Функции для работы с JSONBin.io
const readDebts = async () => {
    try {
        const response = await axios.get(JSONBIN_URL, {
            headers: JSONBIN_HEADERS
        });
        console.log('✅ Данные загружены из JSONBin');
        return response.data.record.debts || [];
    } catch (error) {
        console.error('❌ Ошибка чтения:', error.response?.data || error.message);
        
        // Если bin не существует или пустой, возвращаем пустой массив
        if (error.response?.status === 404 || error.response?.status === 400) {
            console.log('Bin не найден или пустой, создаем начальные данные...');
            const initialData = { debts: [] };
            await axios.put(JSONBIN_URL, initialData, { headers: JSONBIN_HEADERS });
            return [];
        }
        
        return [];
    }
};

const writeDebts = async (debts) => {
    try {
        const data = { debts: debts };
        await axios.put(JSONBIN_URL, data, {
            headers: JSONBIN_HEADERS
        });
        console.log('✅ Данные сохранены в JSONBin');
        return true;
    } catch (error) {
        console.error('❌ Ошибка записи:', error.response?.data || error.message);
        return false;
    }
};

// Инициализация данных
let debts = [];

const initializeData = async () => {
    debts = await readDebts();
    console.log(`📊 Загружено должников: ${debts.length}`);
    console.log(`🔑 JSONBin ID: ${JSONBIN_BIN_ID}`);
};

initializeData();

// Routes
app.get('/api/debts', async (req, res) => {
    try {
        debts = await readDebts();
        res.json(debts);
    } catch (error) {
        console.error('Ошибка получения долгов:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

app.post('/api/debts', async (req, res) => {
    try {
        const { name, amount, comment, phone } = req.body;
        
        if (!name || !amount) {
            return res.status(400).json({ error: 'Имя и сумма обязательны' });
        }

        // Обновляем данные из JSONBin
        debts = await readDebts();

        const normalizedName = name.trim().toLowerCase();
        
        // Проверяем существующего должника
        const existingDebtorIndex = debts.findIndex(d => d.name.toLowerCase() === normalizedName);
        
        const debtRecord = {
            id: Date.now().toString(),
            amount: Math.abs(parseFloat(amount)),
            comment: comment ? comment.trim() : '',
            phone: phone || '',
            date: new Date().toISOString(),
            type: 'debt'
        };

        if (existingDebtorIndex !== -1) {
            // Добавляем к существующему должнику
            if (!debts[existingDebtorIndex].debts) {
                debts[existingDebtorIndex].debts = [];
            }
            debts[existingDebtorIndex].debts.push(debtRecord);
            
            // Обновляем телефон если он предоставлен
            if (phone) {
                debts[existingDebtorIndex].phone = phone;
            }
            
            // Пересчитываем общую сумму
            const totalDebt = debts[existingDebtorIndex].debts
                .filter(d => d.type === 'debt')
                .reduce((sum, debt) => sum + debt.amount, 0);
                
            const totalPaid = debts[existingDebtorIndex].debts
                .filter(d => d.type === 'payment')
                .reduce((sum, payment) => sum + payment.amount, 0);
                
            debts[existingDebtorIndex].totalAmount = totalDebt;
            debts[existingDebtorIndex].totalPaid = totalPaid;
            debts[existingDebtorIndex].updatedAt = new Date().toISOString();
            
            // Сохраняем в JSONBin
            await writeDebts(debts);
            res.json(debts[existingDebtorIndex]);
        } else {
            // Создаем нового должника
            const newDebtor = {
                id: Date.now().toString(),
                name: name.trim(),
                phone: phone || '',
                debts: [debtRecord],
                totalAmount: Math.abs(parseFloat(amount)),
                totalPaid: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            debts.push(newDebtor);
            await writeDebts(debts);
            res.json(newDebtor);
        }
    } catch (error) {
        console.error('Ошибка добавления долга:', error);
        res.status(500).json({ error: 'Ошибка при добавлении долга' });
    }
});

app.post('/api/debts/:id/pay', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, comment } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Введите корректную сумму' });
        }

        // Обновляем данные из JSONBin
        debts = await readDebts();

        const debtorIndex = debts.findIndex(d => d.id === id);

        if (debtorIndex === -1) {
            return res.status(404).json({ error: 'Должник не найден' });
        }

        const paymentRecord = {
            id: Date.now().toString(),
            amount: parseFloat(amount),
            comment: comment ? comment.trim() : '',
            date: new Date().toISOString(),
            type: 'payment'
        };

        // Добавляем платеж в поле 'debts'
        if (!debts[debtorIndex].debts) {
            debts[debtorIndex].debts = [];
        }
        debts[debtorIndex].debts.push(paymentRecord);
        
        // Пересчитываем баланс
        const totalDebt = debts[debtorIndex].debts
            .filter(d => d.type === 'debt')
            .reduce((sum, debt) => sum + debt.amount, 0);
            
        const totalPaid = debts[debtorIndex].debts
            .filter(d => d.type === 'payment')
            .reduce((sum, payment) => sum + payment.amount, 0);
            
        debts[debtorIndex].totalAmount = totalDebt;
        debts[debtorIndex].totalPaid = totalPaid;
        debts[debtorIndex].updatedAt = new Date().toISOString();

        await writeDebts(debts);
        res.json(debts[debtorIndex]);
    } catch (error) {
        console.error('Ошибка обработки платежа:', error);
        res.status(500).json({ error: 'Ошибка при обработке платежа' });
    }
});

app.post('/api/debts/:id/add-debt', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, comment } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Введите корректную сумму' });
        }

        // Обновляем данные из JSONBin
        debts = await readDebts();

        const debtorIndex = debts.findIndex(d => d.id === id);

        if (debtorIndex === -1) {
            return res.status(404).json({ error: 'Должник не найден' });
        }

        const debtRecord = {
            id: Date.now().toString(),
            amount: parseFloat(amount),
            comment: comment ? comment.trim() : '',
            date: new Date().toISOString(),
            type: 'debt'
        };

        // Добавляем долг в поле 'debts'
        if (!debts[debtorIndex].debts) {
            debts[debtorIndex].debts = [];
        }
        debts[debtorIndex].debts.push(debtRecord);
        
        // Пересчитываем баланс
        const totalDebt = debts[debtorIndex].debts
            .filter(d => d.type === 'debt')
            .reduce((sum, debt) => sum + debt.amount, 0);
            
        const totalPaid = debts[debtorIndex].debts
            .filter(d => d.type === 'payment')
            .reduce((sum, payment) => sum + payment.amount, 0);
            
        debts[debtorIndex].totalAmount = totalDebt;
        debts[debtorIndex].totalPaid = totalPaid;
        debts[debtorIndex].updatedAt = new Date().toISOString();

        await writeDebts(debts);
        res.json(debts[debtorIndex]);
    } catch (error) {
        console.error('Ошибка добавления долга:', error);
        res.status(500).json({ error: 'Ошибка при добавлении долга' });
    }
});

app.get('/api/debts/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        // Обновляем данные из JSONBin
        debts = await readDebts();
        
        if (!q) {
            return res.json(debts);
        }

        const filtered = debts.filter(debt => 
            debt.name.toLowerCase().includes(q.toLowerCase())
        );
        res.json(filtered);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Ошибка при поиске' });
    }
});

app.delete('/api/debts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Обновляем данные из JSONBin
        debts = await readDebts();
        
        const debtToDelete = debts.find(d => d.id === id);
        
        if (!debtToDelete) {
            return res.status(404).json({ error: 'Должник не найден' });
        }
        
        debts = debts.filter(d => d.id !== id);
        await writeDebts(debts);
        res.json({ 
            success: true, 
            deletedDebtor: debtToDelete.name 
        });
    } catch (error) {
        console.error('Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка при удалении' });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await readDebts();
        res.json({ 
            status: 'OK', 
            message: 'JSONBin.io connection working',
            binId: JSONBIN_BIN_ID 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'JSONBin.io connection failed' 
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте в браузере: http://localhost:${PORT}`);
    console.log(`💾 Данные хранятся в JSONBin.io`);
    console.log(`🔑 Bin ID: ${JSONBIN_BIN_ID}`);
});