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

            if (balance < (principalForMonth + appliedExtra)) {
                principalForMonth = balance;
                appliedExtra = 0;
            }

            balance -= (principalForMonth + appliedExtra);
            totalInterest += interestForMonth;
            
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

        // Update Summary Cards
        const formatOptions = { year: 'numeric', month: 'short' };
        document.getElementById('summary-orig-date').innerText = baseline.payoffDate.toLocaleDateString(undefined, formatOptions);
        document.getElementById('summary-new-date').innerText = actual.payoffDate.toLocaleDateString(undefined, formatOptions);
        
        const savings = baseline.totalInterest - actual.totalInterest;
        document.getElementById('summary-savings').innerText = `$${savings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('summary-equity').innerText = `$${actual.finalEquity.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

        // Populate Expandable Table Using Bulletproof DOM Elements
        const tbody = document.querySelector('#amortization-table tbody');
        tbody.innerHTML = ''; 
        
        let currentYear = null;
        let yearTotals = { principal: 0, interest: 0, extra: 0, payments: 0 };
        let currentMonthData = [];

        const flushYearGroup = (year, totals, finalBalance, finalEquity, monthData) => {
            // 1. Create the summary row
            const yearRow = document.createElement('tr');
            yearRow.className = 'year-summary-row';
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
            tbody.appendChild(yearRow);

            // 2. Create the hidden month rows
            const monthElements = [];
            monthData.forEach(m => {
                const tr = document.createElement('tr');
                tr.className = 'month-detail-row';
                tr.innerHTML = `
                    <td>${m.date.toLocaleDateString(undefined, formatOptions)}</td>
                    <td>$${m.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${m.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${m.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${m.extra.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${m.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${m.equity.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                `;
                tbody.appendChild(tr);
                monthElements.push(tr);
            });

            // 3. Add the click listener
            yearRow.addEventListener('click', () => {
                yearRow.classList.toggle('expanded');
                monthElements.forEach(el => el.classList.toggle('show-row'));
            });
        };

        actual.schedule.forEach((row, index) => {
            let rowYear = row.date.getFullYear();

            // When the year changes, flush the previous year's data to the table
            if (currentYear !== null && currentYear !== rowYear) {
                let prevRow = actual.schedule[index - 1];
                flushYearGroup(currentYear, yearTotals, prevRow.balance, prevRow.equity, currentMonthData);
                
                // Reset for the new year
                yearTotals = { principal: 0, interest: 0, extra: 0, payments: 0 };
                currentMonthData = [];
            }

            currentYear = rowYear;
            yearTotals.payments += row.payment;
            yearTotals.principal += row.principal;
            yearTotals.interest += row.interest;
            yearTotals.extra += row.extra;
            currentMonthData.push(row);

            // If it's the absolute last payment, flush the final year
            if (index === actual.schedule.length - 1) {
                flushYearGroup(currentYear, yearTotals, row.balance, row.equity, currentMonthData);
            }
        });
    });
});