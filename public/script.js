class DebtTracker {
    constructor() {
        this.debts = [];
        this.currentFilter = 'all';
        this.init();
    }

    formatNumber(num) {
        return Math.round(num).toLocaleString('ru-RU');
    }

    async init() {
        await this.loadDebts();
        this.setupEventListeners();
        this.setupFilterButtons();
    }

    async loadDebts() {
        try {
            const response = await fetch('/api/debts');
            if (!response.ok) throw new Error('Network error');
            this.debts = await response.json();
            this.sortDebts();
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

        // Автодополнение для поля имени
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.handleNameInput(e.target.value);
            });
            
            nameInput.addEventListener('focus', (e) => {
                this.handleNameInput(e.target.value);
            });
            
            nameInput.addEventListener('blur', () => {
                setTimeout(() => this.hideSuggestions(), 200);
            });
        }
    }

    handleNameInput(value) {
        const suggestionsContainer = document.getElementById('nameSuggestions');
        if (!suggestionsContainer) {
            this.createSuggestionsContainer();
        }
        
        if (value.length < 1) {
            this.hideSuggestions();
            return;
        }
        
        const matches = this.findNameMatches(value);
        this.showSuggestions(matches, value);
    }

    createSuggestionsContainer() {
        const nameInput = document.getElementById('name');
        const container = document.createElement('div');
        container.id = 'nameSuggestions';
        container.className = 'suggestions-container';
        nameInput.parentNode.appendChild(container);
    }

    findNameMatches(query) {
        const lowerQuery = query.toLowerCase();
        return this.debts
            .filter(debtor => debtor.name.toLowerCase().includes(lowerQuery))
            .slice(0, 5)
            .map(debtor => debtor.name);
    }

    showSuggestions(matches, currentValue) {
        const container = document.getElementById('nameSuggestions');
        if (!container) return;
        
        if (matches.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        const suggestionsHtml = matches.map(name => {
            const debtor = this.debts.find(d => d.name === name);
            const remaining = debtor.totalAmount - debtor.totalPaid;
            const status = remaining > 0 ? ` (остаток: ${this.formatNumber(remaining)}₸)` : ' (оплачено)';
            
            return `
                <div class="suggestion-item" data-name="${name}">
                    <span class="suggestion-name">${this.escapeHtml(name)}</span>
                    <span class="suggestion-status">${status}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = suggestionsHtml;
        container.style.display = 'block';
        
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.getAttribute('data-name');
                document.getElementById('name').value = name;
                this.hideSuggestions();
                this.showExistingDebtorInfo(name);
            });
        });
    }

    showExistingDebtorInfo(name) {
        const debtor = this.debts.find(d => d.name === name);
        if (!debtor) return;
        
        const remaining = debtor.totalAmount - debtor.totalPaid;
        let message = `Должник "${name}" уже существует.\n`;
        message += `Общий долг: ${this.formatNumber(debtor.totalAmount)}₸\n`;
        message += `Оплачено: ${this.formatNumber(debtor.totalPaid)}₸\n`;
        
        if (remaining > 0) {
            message += `Остаток: ${this.formatNumber(remaining)}₸`;
        } else if (remaining < 0) {
            message += `Переплата: ${this.formatNumber(Math.abs(remaining))}₸`;
        } else {
            message += `Баланс: 0₸`;
        }
        
        this.showInfo(message);
    }

    showInfo(message) {
        const info = document.createElement('div');
        info.className = 'notification info';
        info.style.cssText = `position:fixed;top:20px;right:20px;left:20px;padding:15px;border-radius:8px;color:white;font-weight:600;z-index:1001;text-align:center;background:#3b82f6;box-shadow:0 4px 12px rgba(0,0,0,0.2);`;
        info.textContent = message;
        document.body.appendChild(info);
        setTimeout(() => info.remove(), 4000);
    }

    hideSuggestions() {
        const container = document.getElementById('nameSuggestions');
        if (container) {
            container.style.display = 'none';
        }
    }

    setupFilterButtons() {
        const statsContainer = document.getElementById('statsContainer');
        if (!statsContainer) return;

        statsContainer.addEventListener('click', (e) => {
            const statItem = e.target.closest('.stat-item');
            if (!statItem) return;

            const label = statItem.querySelector('.stat-label').textContent;
            
            if (label === 'Активных') {
                this.filterDebts('active');
            } else if (label === 'Всего долг' || label === 'Осталось') {
                this.filterDebts('all');
            } else if (label === 'Оплачено') {
                this.filterDebts('paid');
            }
        });
    }

    filterDebts(filterType) {
        this.currentFilter = filterType;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.filter-btn[data-filter="${filterType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        this.renderDebts();
    }

    sortDebts() {
        this.debts.sort((a, b) => {
            const aRemaining = a.totalAmount - a.totalPaid;
            const bRemaining = b.totalAmount - b.totalPaid;
            
            if (aRemaining > 0 && bRemaining <= 0) return -1;
            if (aRemaining <= 0 && bRemaining > 0) return 1;
            
            if (aRemaining > 0 && bRemaining > 0) {
                return bRemaining - aRemaining;
            }
            
            return a.name.localeCompare(b.name);
        });
    }

    getFilteredDebts() {
        switch (this.currentFilter) {
            case 'active':
                return this.debts.filter(debtor => debtor.totalAmount > debtor.totalPaid);
            case 'paid':
                return this.debts.filter(debtor => debtor.totalAmount <= debtor.totalPaid);
            default:
                return this.debts;
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

        this.hideSuggestions();

        const btn = document.querySelector('#debtForm button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Добавляем...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/debts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, amount, comment })
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.clearForm();
                this.showSuccess('Долг успешно добавлен!');
                this.filterDebts('all');
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
        if (form) form.reset();
    }

    async addMoreDebt(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        const amount = prompt(
            `Добавить долг для ${debtor.name}:\nТекущий остаток: ${this.formatNumber(remaining)}₸\nВведите сумму:`,
            "0"
        );

        if (!amount || amount <= 0) return;

        const comment = prompt('Комментарий к долгу (необязательно):', '');
        if (comment === null) return;

        try {
            const response = await fetch(`/api/debts/${debtorId}/add-debt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(amount), comment: comment || '' })
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
            `Внести платеж от ${debtor.name}:\nТекущий остаток: ${this.formatNumber(remaining)}₸\nВведите сумму платежа:`,
            this.formatNumber(Math.max(0, remaining))
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(amount), comment: comment || '' })
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadDebts();
                this.showSuccess('Платеж внесен!');
                document.querySelectorAll('.debt-details-dialog').forEach(d => d.remove());
            } else this.showError(result.error || 'Ошибка');
        } catch {
            this.showError('Ошибка сети');
        }
    }

    showDebtDetails(debtor) {
        const existingDialog = document.querySelector('.debt-details-dialog');
        if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.className = 'debt-details-dialog';

        const sortedRecords = [...debtor.debts].sort((a, b) => new Date(b.date) - new Date(a.date));
        let runningBalance = 0;

        const recordsHtml = sortedRecords.map(record => {
            runningBalance += record.type === 'debt' ? record.amount : -record.amount;
            const isOverpaid = runningBalance < 0;
            return `
                <div class="history-record">
                    <div class="record-info">
                        <div class="record-type ${record.type}">
                            ${record.type === 'debt' ? '📝 Долг' : '💵 Платеж'}
                        </div>
                        <div class="record-date">
                            ${new Date(record.date).toLocaleDateString('ru-RU')}
                            ${record.comment ? ` • ${this.escapeHtml(record.comment)}` : ''}
                        </div>
                    </div>
                    <div class="record-amounts">
                        <div class="record-sum ${record.type}">
                            ${record.type === 'debt' ? '+' : '-'}${this.formatNumber(record.amount)}₸
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
                        <div class="summary-item"><div class="summary-label">Общий долг</div><div class="summary-value total-debt">${this.formatNumber(debtor.totalAmount)}₸</div></div>
                        <div class="summary-item"><div class="summary-label">Оплачено</div><div class="summary-value total-paid">${this.formatNumber(debtor.totalPaid)}₸</div></div>
                        <div class="summary-item full-width"><div class="summary-label">Текущий баланс</div><div class="summary-value total-balance ${isOverpaidTotal ? 'overpaid' : ''}">${this.formatNumber(totalBalance)}₸ ${isOverpaidTotal ? '(переплата)' : ''}</div></div>
                    </div>
                </div>
                <div class="history-section"><h4>История операций</h4><div class="history-list">${recordsHtml || '<div class="no-records">Нет записей</div>'}</div></div>
                <div class="details-actions">
                    <button class="btn-action btn-add-debt" onclick="debtTracker.addMoreDebt('${debtor.id}')">➕ Добавить долг</button>
                    <button class="btn-action btn-add-payment" onclick="debtTracker.showPaymentDialog('${debtor.id}')">💵 Внести платеж</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
    }

    async deleteDebt(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        let message = `Удалить должника \"${debtor.name}\"?\nОбщий долг: ${this.formatNumber(debtor.totalAmount)}₸\nОплачено: ${this.formatNumber(debtor.totalPaid)}₸\n`;
        if (remaining > 0) message += `Неоплаченный остаток: ${this.formatNumber(remaining)}₸`;
        else if (remaining < 0) message += `Переплата: ${this.formatNumber(Math.abs(remaining))}₸`;
        else message += `Баланс: 0₸`;

        if (!confirm(message)) return;

        try {
            const response = await fetch(`/api/debts/${debtorId}`, { method: 'DELETE' });
            const result = await response.json();
            if (response.ok) {
                await this.loadDebts();
                this.showSuccess(`Должник \"${result.deletedDebtor}\" удален`);
            } else this.showError('Ошибка удаления');
        } catch {
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

        const totalDebt = this.debts.reduce((s, d) => s + d.totalAmount, 0);
        const totalPaid = this.debts.reduce((s, d) => s + d.totalPaid, 0);
        const totalRemaining = totalDebt - totalPaid;
        const activeDebts = this.debts.filter(d => d.totalAmount > d.totalPaid).length;
        const paidDebts = this.debts.filter(d => d.totalAmount <= d.totalPaid).length;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item clickable">
                    <div class="stat-value">${this.formatNumber(totalDebt)}₸</div>
                    <div class="stat-label">Всего долг</div>
                </div>
                <div class="stat-item clickable">
                    <div class="stat-value">${this.formatNumber(totalRemaining)}₸</div>
                    <div class="stat-label">Осталось</div>
                </div>
                <div class="stat-item clickable">
                    <div class="stat-value">${this.formatNumber(totalPaid)}₸</div>
                    <div class="stat-label">Оплачено</div>
                </div>
                <div class="stat-item clickable">
                    <div class="stat-value">${activeDebts}</div>
                    <div class="stat-label">Активных</div>
                </div>
            </div>
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all" onclick="debtTracker.filterDebts('all')">Все</button>
                <button class="filter-btn" data-filter="active" onclick="debtTracker.filterDebts('active')">Активные (${activeDebts})</button>
                <button class="filter-btn" data-filter="paid" onclick="debtTracker.filterDebts('paid')">Оплаченные (${paidDebts})</button>
            </div>
        `;
    }

    renderDebts(debtsToRender = null) {
        const container = document.getElementById('debtsContainer');
        if (!container) return;

        const debts = debtsToRender || this.getFilteredDebts();

        if (debts.length === 0) {
            let message = '';
            switch (this.currentFilter) {
                case 'active':
                    message = '<div class="empty-state"><h3>✅ Все долги оплачены</h3><p>Нет активных долгов</p></div>';
                    break;
                case 'paid':
                    message = '<div class="empty-state"><h3>📝 Нет оплаченных долгов</h3><p>Все долги активны</p></div>';
                    break;
                default:
                    message = '<div class="empty-state"><h3>📝 Нет долгов</h3><p>Добавьте первый долг</p></div>';
            }
            container.innerHTML = message;
            return;
        }

        container.innerHTML = debts.map(debtor => {
            const remaining = debtor.totalAmount - debtor.totalPaid;
            const progress = debtor.totalAmount > 0 ? (debtor.totalPaid / debtor.totalAmount) * 100 : 100;
            const isPaid = remaining <= 0;
            const isOverpaid = remaining < 0;

            return `
                <div class="debt-item ${isPaid ? 'paid' : ''}">
                    <div class="debt-row">
                        <div class="debt-main" onclick="debtTracker.showDebtDetails(${JSON.stringify(debtor).replace(/\"/g, '&quot;')})">
                            <div class="debt-name">${this.escapeHtml(debtor.name)}</div>
                            <div class="debt-summary">
                                <span class="debt-total">${this.formatNumber(debtor.totalAmount)}₸</span>
                                <span class="debt-separator">→</span>
                                <span class="debt-paid">${this.formatNumber(debtor.totalPaid)}₸</span>
                                <span class="debt-separator">=</span>
                                <span class="debt-balance ${isOverpaid ? 'overpaid' : ''}">${this.formatNumber(remaining)}₸</span>
                                ${isOverpaid ? '<span class="overpaid-badge">🔴</span>' : ''}
                            </div>
                        </div>
                        <div class="debt-actions-compact">
                            <button class="btn-icon btn-pay" onclick="debtTracker.showPaymentDialog('${debtor.id}')">💵</button>
                            <button class="btn-icon btn-add" onclick="debtTracker.addMoreDebt('${debtor.id}')">➕</button>
                            <button class="btn-icon btn-delete" onclick="debtTracker.deleteDebt('${debtor.id}')">🗑️</button>
                        </div>
                    </div>
                    <div class="progress-section"><div class="progress-bar"><div class="progress" style="width: ${Math.min(progress, 100)}%"></div></div></div>
                </div>
            `;
        }).join('');
    }

    showError(msg) { this.showNotification(msg, 'error'); }
    showSuccess(msg) { this.showNotification(msg, 'success'); }

    showNotification(message, type) {
        document.querySelectorAll('.notification').forEach(n => n.remove());
        const n = document.createElement('div');
        n.className = 'notification';
        n.style.cssText = `position:fixed;top:20px;right:20px;left:20px;padding:15px;border-radius:8px;color:white;font-weight:600;z-index:1001;text-align:center;${type==='error'?'background:#ef4444;':'background:#10b981;'}box-shadow:0 4px 12px rgba(0,0,0,0.2);`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
    }
}

const debtTracker = new DebtTracker();