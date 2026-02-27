document.addEventListener('DOMContentLoaded', () => {
    const extraPaymentsContainer = document.getElementById('extra-payments-container');
    const addExtraBtn = document.getElementById('add-extra-btn');
    const calculateBtn = document.getElementById('calculate-btn');

    // --- Add Extra Payment Rules ---
    addExtraBtn.addEventListener('click', () => {
        const ruleDiv = document.createElement('div');
        ruleDiv.classList.add('extra-rule');
        ruleDiv.style.marginBottom = '15px';
        ruleDiv.style.padding = '15px';
        ruleDiv.style.border = '1px solid var(--border-color)';
        ruleDiv.style.borderRadius = '6px';
        ruleDiv.style.backgroundColor = '#f8fafc';
        
        ruleDiv.innerHTML = `
            <label>Amount ($)</label>
            <input type="number" class="ex-amount" value="100" step="10">
            <label>Frequency</label>
            <select class="ex-freq">
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
            </select>
            <label>Start Date</label>
            <input type="month" class="ex-start">
            <button class="remove-rule-btn" style="background: #e53e3e; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold;">Remove</button>
        `;
        
        ruleDiv.querySelector('.remove-rule-btn').addEventListener('click', () => ruleDiv.remove());
        extraPaymentsContainer.appendChild(ruleDiv);
    });

    // --- Calculation Engine ---
    function calculateSchedule(principal, rate, years, startDate, homeValue, appreciationRate, extraRules) {
        let monthlyRate = (rate / 100) / 12;
        let monthlyAppreciation = (appreciationRate / 100) / 12;
        let totalMonths = years * 12;
        let standardPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
        
        let balance = principal;
        let currentHomeValue = homeValue;
        
        let currentMonth = new Date(startDate);
        currentMonth = new Date(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1); 
        
        let schedule = [];
        let totalInterest = 0;

        while (balance > 0.01) {
            let interestForMonth = balance * monthlyRate;
            let principalForMonth = standardPayment - interestForMonth;
            let appliedExtra = 0;

            // Apply active extra payment rules
            extraRules.forEach(rule => {
                let ruleDate = new Date(rule.start);
                ruleDate = new Date(ruleDate.getUTCFullYear(), ruleDate.getUTCMonth(), 1);

                if (currentMonth >= ruleDate) {
                    if (rule.freq === 'monthly') {
                        appliedExtra += rule.amount;
                    } else if (rule.freq === 'annually' && currentMonth.getMonth() === ruleDate.getMonth()) {
                        appliedExtra += rule.amount;
                    }
                }
            });

            // Handle final payment to not overpay
            if (balance < (principalForMonth + appliedExtra)) {
                principalForMonth = balance;
                appliedExtra = 0;
            }

            balance -= (principalForMonth + appliedExtra);
            totalInterest += interestForMonth;
            
            // Appreciate Home Value
            currentHomeValue += (currentHomeValue * monthlyAppreciation);
            let currentEquity = currentHomeValue - (balance > 0 ? balance : 0);

            schedule.push({
                date: new Date(currentMonth),
                payment: principalForMonth + interestForMonth,
                principal: principalForMonth,
                interest: interestForMonth,
                extra: appliedExtra,
                balance: balance > 0 ? balance : 0,
                homeValue: currentHomeValue,
                equity: currentEquity
            });

            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        return { 
            schedule, 
            totalInterest, 
            payoffDate: schedule[schedule.length - 1].date,
            finalEquity: schedule[schedule.length - 1].equity
        };
    }

    // --- Execution & Rendering ---
    calculateBtn.addEventListener('click', () => {
        const principal = parseFloat(document.getElementById('principal').value);
        const rate = parseFloat(document.getElementById('rate').value);
        const years = parseFloat(document.getElementById('term').value);
        const startDateStr = document.getElementById('startDate').value;
        const homeValue = parseFloat(document.getElementById('homeValue').value);
        const appreciation = parseFloat(document.getElementById('appreciation').value);

        if (!startDateStr) {
            alert("Please select an origination date.");
            return;
        }

        const extraRules = Array.from(document.querySelectorAll('.extra-rule')).map(rule => ({
            amount: parseFloat(rule.querySelector('.ex-amount').value) || 0,
            freq: rule.querySelector('.ex-freq').value,
            start: rule.querySelector('.ex-start').value || startDateStr
        }));

        const baseline = calculateSchedule(principal, rate, years, startDateStr, homeValue, appreciation, []);
        const actual = calculateSchedule(principal, rate, years, startDateStr, homeValue, appreciation, extraRules);

        // --- Update Summary Cards ---
        const formatOptions = { year: 'numeric', month: 'short' };
        document.getElementById('summary-orig-date').innerText = baseline.payoffDate.toLocaleDateString(undefined, formatOptions);
        document.getElementById('summary-new-date').innerText = actual.payoffDate.toLocaleDateString(undefined, formatOptions);
        
        const savings = baseline.totalInterest - actual.totalInterest;
        document.getElementById('summary-savings').innerText = `$${savings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('summary-equity').innerText = `$${actual.finalEquity.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

        // --- Populate Expandable Table ---
        const tbody = document.querySelector('#amortization-table tbody');
        tbody.innerHTML = ''; 
        
        let currentYear = null;
        let yearTotals = { principal: 0, interest: 0, extra: 0, payments: 0 };
        let monthRowsHtml = '';

        const appendYearGroup = (year, totals, finalBalance, finalEquity, monthsHtml) => {
            const yearRow = document.createElement('tr');
            yearRow.classList.add('year-summary-row');
            yearRow.innerHTML = `
                <td><span class="expand-icon">▶</span> ${year}</td>
                <td>$${totals.payments.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${totals.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${totals.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="color: ${totals.extra > 0 ? 'var(--accent-color)' : 'inherit'}; font-weight: ${totals.extra > 0 ? 'bold' : 'normal'}">
                    $${totals.extra.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td>$${finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="color: var(--success-color)">$${finalEquity.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
            `;

            const monthWrapper = document.createElement('tbody');
            monthWrapper.innerHTML = monthsHtml;
            const monthElements = Array.from(monthWrapper.children);

            yearRow.addEventListener('click', () => {
                yearRow.classList.toggle('expanded');
                monthElements.forEach(row => row.classList.toggle('show-row'));
            });

            tbody.appendChild(yearRow);
            monthElements.forEach(row => tbody.appendChild(row));
        };

        actual.schedule.forEach((row, index) => {
            let rowYear = row.date.getFullYear();

            if (currentYear !== null && currentYear !== rowYear) {
                let prevRow = actual.schedule[index - 1];
                appendYearGroup(currentYear, yearTotals, prevRow.balance, prevRow.equity, monthRowsHtml);
                
                yearTotals = { principal: 0, interest: 0, extra: 0, payments: 0 };
                monthRowsHtml = '';
            }

            currentYear = rowYear;
            yearTotals.payments += row.payment;
            yearTotals.principal += row.principal;
            yearTotals.interest += row.interest;
            yearTotals.extra += row.extra;

            monthRowsHtml += `
                <tr class="month-detail-row">
                    <td>${row.date.toLocaleDateString(undefined, formatOptions)}</td>
                    <td>$${row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${row.extra.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${row.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${row.equity.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                </tr>
            `;

            if (index === actual.schedule.length - 1) {
                appendYearGroup(currentYear, yearTotals, row.balance, row.equity, monthRowsHtml);
            }
        });
    });
});