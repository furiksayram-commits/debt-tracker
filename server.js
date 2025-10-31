const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'debts.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Функции для работы с файлом
const readDebts = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
        return [];
    }
};

const writeDebts = (debts) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(debts, null, 2));
        return true;
    } catch (error) {
        console.error('Ошибка записи файла:', error);
        return false;
    }
};

// Загружаем данные при запуске
let debts = readDebts();

// Routes
app.get('/api/debts', (req, res) => {
    res.json(debts);
});

app.post('/api/debts', (req, res) => {
    const { name, amount, comment } = req.body;
    
    if (!name || !amount) {
        return res.status(400).json({ error: 'Имя и сумма обязательны' });
    }

    const normalizedName = name.trim().toLowerCase();
    
    // Проверяем существующего должника
    const existingDebtorIndex = debts.findIndex(d => d.name.toLowerCase() === normalizedName);
    
    const debtRecord = {
        id: Date.now().toString(),
        amount: Math.abs(parseFloat(amount)),
        comment: comment ? comment.trim() : '',
        date: new Date().toISOString(),
        type: 'debt'
    };

    if (existingDebtorIndex !== -1) {
        // Добавляем к существующему должнику
        // Используем поле 'debts' вместо 'transactions' для совместимости с вашим файлом
        if (!debts[existingDebtorIndex].debts) {
            debts[existingDebtorIndex].debts = [];
        }
        debts[existingDebtorIndex].debts.push(debtRecord);
        
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
        
        // Сохраняем в файл
        writeDebts(debts);
        res.json(debts[existingDebtorIndex]);
    } else {
        // Создаем нового должника
        const newDebtor = {
            id: Date.now().toString(),
            name: name.trim(),
            debts: [debtRecord], // Используем 'debts' вместо 'transactions'
            totalAmount: Math.abs(parseFloat(amount)),
            totalPaid: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        debts.push(newDebtor);
        writeDebts(debts);
        res.json(newDebtor);
    }
});

app.post('/api/debts/:id/pay', (req, res) => {
    const { id } = req.params;
    const { amount, comment } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Введите корректную сумму' });
    }

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

    writeDebts(debts);
    res.json(debts[debtorIndex]);
});

app.post('/api/debts/:id/add-debt', (req, res) => {
    const { id } = req.params;
    const { amount, comment } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Введите корректную сумму' });
    }

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

    writeDebts(debts);
    res.json(debts[debtorIndex]);
});

app.get('/api/debts/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json(debts);
    }

    const filtered = debts.filter(debt => 
        debt.name.toLowerCase().includes(q.toLowerCase())
    );
    res.json(filtered);
});

app.delete('/api/debts/:id', (req, res) => {
    const { id } = req.params;
    const debtToDelete = debts.find(d => d.id === id);
    
    if (!debtToDelete) {
        return res.status(404).json({ error: 'Должник не найден' });
    }
    
    debts = debts.filter(d => d.id !== id);
    writeDebts(debts);
    res.json({ 
        success: true, 
        deletedDebtor: debtToDelete.name 
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📱 Откройте в браузере: http://localhost:${PORT}`);
    console.log(`💾 Данные загружены из: ${DATA_FILE}`);
    console.log(`📊 Загружено должников: ${debts.length}`);
});