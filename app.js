document.addEventListener('DOMContentLoaded', () => {
    const extraPaymentsContainer = document.getElementById('extra-payments-container');
    const addExtraBtn = document.getElementById('add-extra-btn');
    const calculateBtn = document.getElementById('calculate-btn');

    let ruleCount = 0;

    // --- DOM Manipulation: Add Extra Payment Rules ---
    addExtraBtn.addEventListener('click', () => {
        ruleCount++;
        const ruleDiv = document.createElement('div');
        ruleDiv.classList.add('extra-rule');
        ruleDiv.style.marginBottom = '10px';
        ruleDiv.style.padding = '10px';
        ruleDiv.style.border = '1px solid var(--border-color)';
        ruleDiv.style.borderRadius = '6px';
        
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
            <button class="remove-rule-btn" style="background: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Remove</button>
        `;
        
        ruleDiv.querySelector('.remove-rule-btn').addEventListener('click', () => ruleDiv.remove());
        extraPaymentsContainer.appendChild(ruleDiv);
    });

    // --- The Calculation Engine ---
    function calculateSchedule(principal, rate, years, startDate, extraRules) {
        let monthlyRate = (rate / 100) / 12;
        let totalMonths = years * 12;
        let standardPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
        
        let balance = principal;
        let currentMonth = new Date(startDate);
        // Fix timezone offset issues with month input
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

            schedule.push({
                date: new Date(currentMonth),
                payment: standardPayment,
                principal: principalForMonth,
                interest: interestForMonth,
                extra: appliedExtra,
                balance: balance > 0 ? balance : 0
            });

            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        return { schedule, totalInterest, payoffDate: schedule[schedule.length - 1].date };
    }

    // --- Execution & Rendering ---
    calculateBtn.addEventListener('click', () => {
        const principal = parseFloat(document.getElementById('principal').value);
        const rate = parseFloat(document.getElementById('rate').value);
        const years = parseFloat(document.getElementById('term').value);
        const startDateStr = document.getElementById('startDate').value;

        if (!startDateStr) {
            alert("Please select an origination date.");
            return;
        }

        // Gather extra rules from the UI
        const extraRules = Array.from(document.querySelectorAll('.extra-rule')).map(rule => ({
            amount: parseFloat(rule.querySelector('.ex-amount').value) || 0,
            freq: rule.querySelector('.ex-freq').value,
            start: rule.querySelector('.ex-start').value || startDateStr
        }));

        // Run baseline (no extra payments) vs actual (with extra payments)
        const baseline = calculateSchedule(principal, rate, years, startDateStr, []);
        const actual = calculateSchedule(principal, rate, years, startDateStr, extraRules);

        // Update Summary Cards
        const formatOptions = { year: 'numeric', month: 'short' };
        document.getElementById('summary-orig-date').innerText = baseline.payoffDate.toLocaleDateString(undefined, formatOptions);
        document.getElementById('summary-new-date').innerText = actual.payoffDate.toLocaleDateString(undefined, formatOptions);
        
        const savings = baseline.totalInterest - actual.totalInterest;
        document.getElementById('summary-savings').innerText = `$${savings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        // Populate Table
        const tbody = document.querySelector('#amortization-table tbody');
        tbody.innerHTML = ''; // clear existing
        
        actual.schedule.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.date.toLocaleDateString(undefined, formatOptions)}</td>
                <td>$${row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="color: ${row.extra > 0 ? 'var(--accent-color)' : 'inherit'}; font-weight: ${row.extra > 0 ? 'bold' : 'normal'}">
                    $${row.extra.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td>$${row.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
            tbody.appendChild(tr);
        });
    });
});