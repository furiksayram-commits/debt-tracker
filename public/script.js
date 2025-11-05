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
                this.toggleClearButton(searchInput);
            });
            this.addClearButton(searchInput);
        }

        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                const value = e.target.value;
                this.toggleClearButton(nameInput);
                this.handleNameInput(value);
            });
            
            nameInput.addEventListener('focus', (e) => {
                const value = e.target.value;
                this.toggleClearButton(nameInput);
                this.handleNameInput(value);
            });
            
            nameInput.addEventListener('blur', () => {
                setTimeout(() => {
                    this.hideContactSuggestions();
                }, 200);
            });
            
            this.addClearButton(nameInput);
        }

        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            this.addClearButton(phoneInput);
        }

        const amountInput = document.getElementById('amount');
        if (amountInput) {
            amountInput.setAttribute('inputmode', 'numeric');
            amountInput.setAttribute('pattern', '[0-9]*');
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.form-group') && !e.target.closest('.contact-suggestions')) {
                this.hideContactSuggestions();
            }
        });
    }

    handleNameInput(value) {
        if (value.length < 1) {
            this.hideContactSuggestions();
            return;
        }

        const matches = this.findContactMatches(value);
        this.showContactSuggestions(matches);
    }

    findContactMatches(query) {
        const lowerQuery = query.toLowerCase();
        return this.debts
            .filter(debtor => 
                debtor.name.toLowerCase().includes(lowerQuery)
            )
            .slice(0, 5);
    }

    showContactSuggestions(contacts) {
        let container = document.getElementById('contactSuggestions');
        if (!container) {
            container = document.createElement('div');
            container.id = 'contactSuggestions';
            container.className = 'contact-suggestions';
            document.getElementById('name').parentNode.appendChild(container);
        }

        if (contacts.length === 0) {
            this.hideContactSuggestions();
            return;
        }

        const suggestionsHtml = contacts.map(contact => {
            const remaining = contact.totalAmount - contact.totalPaid;
            const status = remaining > 0 ? `остаток: ${this.formatNumber(remaining)}₸` : 'оплачено';
            const statusClass = remaining > 0 ? 'debt' : 'paid';
            
            return `
                <div class="contact-suggestion" data-name="${contact.name}" data-phone="${contact.phone || ''}">
                    <div class="contact-info">
                        <div class="contact-name">${this.escapeHtml(contact.name)}</div>
                        ${contact.phone ? `<div class="contact-phone">${this.escapeHtml(contact.phone)}</div>` : ''}
                    </div>
                    <div class="contact-balance ${statusClass}">
                        ${status}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = suggestionsHtml;
        container.style.display = 'block';

        container.querySelectorAll('.contact-suggestion').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.getAttribute('data-name');
                const phone = item.getAttribute('data-phone');
                
                document.getElementById('name').value = name;
                if (phone) {
                    document.getElementById('phone').value = phone;
                }
                
                this.hideContactSuggestions();
                this.showExistingDebtorInfo(name);
            });
        });
    }

    hideContactSuggestions() {
        const container = document.getElementById('contactSuggestions');
        if (container) {
            container.style.display = 'none';
        }
    }

    addClearButton(inputElement) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'clear-input';
        clearButton.innerHTML = '×';
        clearButton.title = 'Очистить поле';
        
        clearButton.addEventListener('click', (e) => {
            e.stopPropagation();
            inputElement.value = '';
            inputElement.focus();
            this.toggleClearButton(inputElement);
            
            if (inputElement.id === 'search') {
                this.searchDebts('');
            }
            
            if (inputElement.id === 'name') {
                this.hideContactSuggestions();
            }
        });
        
        inputElement.classList.add('has-clear-button');
        inputElement.parentNode.appendChild(clearButton);
        this.toggleClearButton(inputElement);
    }

    toggleClearButton(inputElement) {
        const clearButton = inputElement.parentNode.querySelector('.clear-input');
        if (clearButton) {
            if (inputElement.value.length > 0) {
                clearButton.classList.add('visible');
            } else {
                clearButton.classList.remove('visible');
            }
        }
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
        info.style.background = '#3b82f6';
        info.textContent = message;
        document.body.appendChild(info);
        setTimeout(() => info.remove(), 4000);
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
        const phoneInput = document.getElementById('phone');
        const amountInput = document.getElementById('amount');
        const commentInput = document.getElementById('comment');

        if (!nameInput || !amountInput) {
            this.showError('Форма не найдена');
            return;
        }

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const amount = amountInput.value;
        const comment = commentInput.value.trim();

        if (!name || !amount) {
            this.showError('Заполните имя и сумму');
            return;
        }

        this.hideContactSuggestions();

        const btn = document.querySelector('#debtForm button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Добавляем...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/debts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, amount, comment })
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
        if (form) {
            form.reset();
            const inputs = form.querySelectorAll('input');
            inputs.forEach(input => this.toggleClearButton(input));
        }
    }

    sendWhatsAppMessage(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        const remaining = debtor.totalAmount - debtor.totalPaid;
        
        if (!debtor.phone) {
            this.showError('У должника не указан номер телефона');
            return;
        }

        const phoneNumber = debtor.phone.replace(/[^\d+]/g, '');
        const message = `Здравствуйте! Напоминаю о долге: ${this.formatNumber(remaining)}₸`;
        
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    makePhoneCall(debtorId) {
        const debtor = this.debts.find(d => d.id === debtorId);
        if (!debtor) return;

        if (!debtor.phone) {
            this.showError('У должника не указан номер телефона');
            return;
        }

        const phoneNumber = debtor.phone.replace(/[^\d+]/g, '');
        const telUrl = `tel:${phoneNumber}`;
        window.location.href = telUrl;
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
                ${debtor.phone ? `
                    <div class="debtor-phone-section">
                        <div class="phone-info-compact">
                            <span class="phone-label">📱 Телефон:</span>
                            <span class="phone-number">${this.escapeHtml(debtor.phone)}</span>
                            <div class="phone-actions">
                                <button class="btn-call" onclick="debtTracker.makePhoneCall('${debtor.id}')" title="Позвонить">📞</button>
                                ${totalBalance > 0 ? `<button class="btn-whatsapp-compact" onclick="debtTracker.sendWhatsAppMessage('${debtor.id}')" title="Написать в WhatsApp">💬</button>` : ''}
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="debt-summary-card">
                    <div class="summary-grid">
                        <div class="summary-item"><div class="summary-label">Общий долг</div><div class="summary-value total-debt">${this.formatNumber(debtor.totalAmount)}₸</div></div>
                        <div class="summary-item"><div class="summary-label">Оплачено</div><div class="summary-value total-paid">${this.formatNumber(debtor.totalPaid)}₸</div></div>
                        <div class="summary-item full-width"><div class="summary-label">Текущий Долг</div><div class="summary-value total-balance ${isOverpaidTotal ? 'overpaid' : ''}">${this.formatNumber(totalBalance)}₸ ${isOverpaidTotal ? '(переплата)' : ''}</div></div>
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
                            ${debtor.phone && remaining > 0 ? `<button class="btn-icon btn-whatsapp" onclick="debtTracker.sendWhatsAppMessage('${debtor.id}')" title="Написать в WhatsApp">💬</button>` : ''}
                            <button class="btn-icon btn-pay" onclick="debtTracker.showPaymentDialog('${debtor.id}')" title="Внести платеж">💵</button>
                            <button class="btn-icon btn-add" onclick="debtTracker.addMoreDebt('${debtor.id}')" title="Добавить долг">➕</button>
                            <button class="btn-icon btn-delete" onclick="debtTracker.deleteDebt('${debtor.id}')" title="Удалить">🗑️</button>
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
        n.style.background = type === 'error' ? '#ef4444' : '#10b981';
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