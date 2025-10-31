class DebtTracker {
    constructor() {
        this.debts = [];
        this.init();
    }

    async init() {
        await this.loadDebts();
        this.setupEventListeners();
    }

    async loadDebts() {
        try {
            const response = await fetch('/api/debts');
            if (!response.ok) throw new Error('Network error');
            this.debts = await response.json();
            this.renderDebts();
            this.renderStats();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showError('Не удалось загрузить данные');
        }
    }

    setupEventListeners() {
        const debtForm = document.getElementById('debtForm');
        if (debtForm) {
            debtForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addDebt();
            });
        }

        const searchInput = document.getElementById('search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchDebts(e.target.value);
            });
        }
    }

    async addDebt() {
        const nameInput = document.getElementById('name');
        const amountInput = document.getElementById('amount');
        const commentInput = document.getElementById('comment');

        if (!nameInput || !amountInput) {
            this.showError('Форма не найдена');
            return;
        }

        const name = nameInput.value.trim();
        const amount = amountInput.value;
        const comment = commentInput.value.trim();

        if (!name || !amount) {
            this.showError('Заполните имя и сумму');
            return;
        }

        const btn = document.querySelector('#debtForm button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Добавляем...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/debts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, amount, comment })
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.clearForm();
                this.showSuccess('Долг успешно добавлен!');
            } else {
                this.showError(result.error || 'Ошибка при добавлении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка сети');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    clearForm() {
        const form = document.getElementById('debtForm');
        if (form) {
            form.reset();
        }
    }

    async addMoreDebt(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        
        const amount = prompt(
            `Добавить долг для ${debtor.name}:\nТекущий остаток: ${remaining.toFixed(2)}₸\nВведите сумму:`, 
            "0"
        );
        
        if (!amount || amount <= 0) return;
        
        const comment = prompt('Комментарий к долгу (необязательно):', '');
        if (comment === null) return;

        try {
            const response = await fetch(`/api/debts/${debtorId}/add-debt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    amount: parseFloat(amount),
                    comment: comment || '' 
                })
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.showSuccess(`Долг добавлен для ${result.name}!`);
            } else {
                this.showError(result.error || 'Ошибка');
            }
        } catch (error) {
            this.showError('Ошибка сети');
        }
    }

    showPaymentDialog(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        
        const amount = prompt(
            `Внести платеж от ${debtor.name}:\nТекущий остаток: ${remaining.toFixed(2)}₸\nВведите сумму платежа:`, 
            Math.max(0, remaining).toFixed(0)
        );
        
        if (!amount || amount <= 0) return;
        
        const comment = prompt('Комментарий к платежу (необязательно):', '');
        if (comment === null) return;

        this.processPayment(debtorId, amount, comment);
    }

    async processPayment(debtorId, amount, comment) {
        try {
            const response = await fetch(`/api/debts/${debtorId}/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    amount: parseFloat(amount),
                    comment: comment || ''
                })
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.showSuccess('Платеж внесен!');
                
                // Закрываем диалоги
                document.querySelectorAll('.debt-details-dialog').forEach(dialog => dialog.remove());
            } else {
                this.showError(result.error || 'Ошибка');
            }
        } catch (error) {
            this.showError('Ошибка сети');
        }
    }

    showDebtDetails(debtor) {
        // Закрываем предыдущее окно
        const existingDialog = document.querySelector('.debt-details-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'debt-details-dialog';
        
        // Сортируем записи по дате (новые сверху)
        const sortedRecords = [...debtor.debts].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let runningBalance = 0;
        
        // Сначала считаем баланс с начала
        const initialBalance = sortedRecords.reduce((balance, record) => {
            return record.type === 'debt' ? balance + record.amount : balance - record.amount;
        }, 0);
        
        // Теперь строим записи с правильным балансом
        const recordsHtml = sortedRecords.map(record => {
            if (record.type === 'debt') {
                runningBalance += record.amount;
            } else {
                runningBalance -= record.amount;
            }
            
            const isOverpaid = runningBalance < 0;
            
            return `
                <div class="history-record">
                    <div class="record-info">
                        <div class="record-type ${record.type}">
                            ${record.type === 'debt' ? '📝 Долг' : '💳 Платеж'}
                        </div>
                        <div class="record-date">
                            ${new Date(record.date).toLocaleDateString('ru-RU')}
                            ${record.comment ? ` • ${this.escapeHtml(record.comment)}` : ''}
                        </div>
                    </div>
                    <div class="record-amounts">
                        <div class="record-sum ${record.type}">
                            ${record.type === 'debt' ? '+' : '-'}${record.amount.toFixed(2)}₸
                        </div>
                        <div class="record-balance ${isOverpaid ? 'overpaid' : ''}">
                            Баланс: ${runningBalance.toFixed(2)}₸
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const totalBalance = debtor.totalAmount - debtor.totalPaid;
        const isOverpaidTotal = totalBalance < 0;

        dialog.innerHTML = `
            <div class="debt-details-content">
                <div class="debt-details-header">
                    <h3>📋 ${this.escapeHtml(debtor.name)}</h3>
                    <button class="btn-close" onclick="this.closest('.debt-details-dialog').remove()">✕</button>
                </div>
                
                <div class="debt-summary-card">
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-label">Общий долг</div>
                            <div class="summary-value total-debt">${debtor.totalAmount.toFixed(2)}₸</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Оплачено</div>
                            <div class="summary-value total-paid">${debtor.totalPaid.toFixed(2)}₸</div>
                        </div>
                        <div class="summary-item full-width">
                            <div class="summary-label">Текущий баланс</div>
                            <div class="summary-value total-balance ${isOverpaidTotal ? 'overpaid' : ''}">
                                ${totalBalance.toFixed(2)}₸
                                ${isOverpaidTotal ? ' (переплата)' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="history-section">
                    <h4>История операций</h4>
                    <div class="history-list">
                        ${recordsHtml || '<div class="no-records">Нет записей</div>'}
                    </div>
                </div>
                
                <div class="details-actions">
                    <button class="btn-action btn-add-debt" onclick="debtTracker.addMoreDebt('${debtor.id}')">
                        ➕ Добавить долг
                    </button>
                    <button class="btn-action btn-add-payment" onclick="debtTracker.showPaymentDialog('${debtor.id}')">
                        💳 Внести платеж
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Закрытие по клику на фон
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    async deleteDebt(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        
        let message = `Удалить должника "${debtor.name}"?\n`;
        message += `Общий долг: ${debtor.totalAmount.toFixed(2)}₸\n`;
        message += `Оплачено: ${debtor.totalPaid.toFixed(2)}₸\n`;
        
        if (remaining > 0) {
            message += `Неоплаченный остаток: ${remaining.toFixed(2)}₸`;
        } else if (remaining < 0) {
            message += `Переплата: ${Math.abs(remaining).toFixed(2)}₸`;
        } else {
            message += `Баланс: 0₸`;
        }
            
        if (!confirm(message)) return;

        try {
            const response = await fetch(`/api/debts/${debtorId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.showSuccess(`Должник "${result.deletedDebtor}" удален`);
            } else {
                this.showError('Ошибка удаления');
            }
        } catch (error) {
            this.showError('Ошибка сети');
        }
    }

    async searchDebts(query) {
        try {
            const response = await fetch(`/api/debts/search?q=${encodeURIComponent(query)}`);
            const filteredDebts = await response.json();
            this.renderDebts(filteredDebts);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        if (!container) return;

        const totalDebt = this.debts.reduce((sum, debtor) => sum + debtor.totalAmount, 0);
        const totalPaid = this.debts.reduce((sum, debtor) => sum + debtor.totalPaid, 0);
        const totalRemaining = totalDebt - totalPaid;
        const activeDebts = this.debts.filter(debtor => debtor.totalAmount > debtor.totalPaid).length;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${totalDebt.toFixed(0)}₸</div>
                    <div class="stat-label">Всего долг</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalRemaining.toFixed(0)}₸</div>
                    <div class="stat-label">Осталось</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalPaid.toFixed(0)}₸</div>
                    <div class="stat-label">Оплачено</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${activeDebts}</div>
                    <div class="stat-label">Активных</div>
                </div>
            </div>
        `;
    }

    renderDebts(debtsToRender = this.debts) {
        const container = document.getElementById('debtsContainer');
        if (!container) return;
        
        if (debtsToRender.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📝 Нет долгов</h3>
                    <p>Добавьте первый долг</p>
                </div>
            `;
            return;
        }

        container.innerHTML = debtsToRender.map(debtor => {
            const remaining = debtor.totalAmount - debtor.totalPaid;
            const progress = debtor.totalAmount > 0 ? (debtor.totalPaid / debtor.totalAmount) * 100 : 100;
            const isPaid = remaining <= 0;
            const isOverpaid = remaining < 0;

            return `
                <div class="debt-item ${isPaid ? 'paid' : ''}">
                    <div class="debt-row">
                        <div class="debt-main" onclick="debtTracker.showDebtDetails(${JSON.stringify(debtor).replace(/"/g, '&quot;')})">
                            <div class="debt-name">${this.escapeHtml(debtor.name)}</div>
                            <div class="debt-summary">
                                <span class="debt-total">${debtor.totalAmount.toFixed(0)}₸</span>
                                <span class="debt-separator">→</span>
                                <span class="debt-paid">${debtor.totalPaid.toFixed(0)}₸</span>
                                <span class="debt-separator">=</span>
                                <span class="debt-balance ${isOverpaid ? 'overpaid' : ''}">${remaining.toFixed(0)}₸</span>
                                ${isOverpaid ? '<span class="overpaid-badge">🔴</span>' : ''}
                            </div>
                        </div>
                        
                        <div class="debt-actions-compact">
                            <button class="btn-icon btn-pay" 
                                    onclick="debtTracker.showPaymentDialog('${debtor.id}')"
                                    title="Внести платеж">
                                💳
                            </button>
                            <button class="btn-icon btn-add" 
                                    onclick="debtTracker.addMoreDebt('${debtor.id}')"
                                    title="Добавить долг">
                                ➕
                            </button>
                            <button class="btn-icon btn-delete" 
                                    onclick="debtTracker.deleteDebt('${debtor.id}')"
                                    title="Удалить должника">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-bar">
                            <div class="progress" style="width: ${Math.min(progress, 100)}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Удаляем старые уведомления
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            left: 20px;
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            text-align: center;
            ${type === 'error' ? 'background: #ef4444;' : 'background: #10b981;'}
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Инициализация приложения
const debtTracker = new DebtTracker();