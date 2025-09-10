document.addEventListener('DOMContentLoaded', async () => {
    // --- KINTONE FETCH & MOCK DATA ---
    const fetchMockData = (month, year, category) => {
        const records = [];
        const daysInMonth = new Date(year, month, 0).getDate();
        const machineCount = Math.floor(Math.random() * 4) + 2; // 2 to 5 machines
        const machines = Array.from({ length: machineCount }, (_, i) => (i + 1).toString());

        for (let day = 1; day <= daysInMonth; day++) {
            if (Math.random() > 0.3) { // 70% chance of operating day
                records.push({
                    "Date_Today": { "value": `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` },
                    "Consumption_Category": { "value": category },
                    "Plant_Location": { "value": "GGPC - Gunma Gohkin" },
                    "Total_Consumed": { "value": (Math.random() * 20).toFixed(2) },
                    "Machine_Run": { "value": machines[Math.floor(Math.random() * machines.length)] },
                    "Remaining_Stock": { "value": (100 - day * 2.5).toFixed(2) },
                    "Delivery": { "value": (day % 10 === 0) ? (Math.floor(Math.random() * 2) + 1).toString() : '0' },
                    "Refill": { "value": (day % 5 === 0) ? '1' : '0' },
                });
            }
        }
        return { records };
    };
    
    const fetchKintoneAllData = async (month, year) => {
        try {
            const category = getCurrentCategory();
            const url = `/.netlify/functions/kintone?month=${month}&year=${year}&category=${category}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data from Kintone API, using mock data.');
                return fetchMockData(month, year, category).records;
            }
            const data = await response.json();
            return data.records && data.records.length > 0 ? data.records : fetchMockData(month, year, category).records;
        } catch (error) {
            console.error('Error fetching from Netlify function, using mock data:', error);
            const category = getCurrentCategory();
            return fetchMockData(month, year, category).records;
        }
    };
  
    // --- GLOBAL STATE & CONFIG ---
    let allRecords = [];
    let mainChart, machineChart;
    let currentTimeframe = 'daily';

    const CONFIG_MAP = {
        'SW220': {
            description: "Hydraulic Oil",
            unit: "Liters",
            deliveryUnit: "Drum",
            tableKeys: { consumed: 'Total_Consumed', machine: 'Machine_Run', remaining: 'Remaining_Stock', delivery: 'Delivery', estimate: 'Estimate' },
            tableMetrics: [
                { label: 'Consumed Liters', key: 'consumed' },
                { label: 'Stock Liters', key: 'remaining' },
                { label: 'Estimate in Liters', key: 'estimate' },
                { label: 'Machine Run', key: 'machine' },
                { label: 'Delivery Liters/Drum', key: 'delivery' }
            ]
        },
        'GL63P': {
            description: "Grease",
            unit: "Liters",
            deliveryUnit: "Drum",
            tableKeys: { consumed: 'Total_Consumed', machine: 'Machine_Run', remaining: 'Remaining_Stock', delivery: 'Delivery', estimate: 'Estimate' },
            tableMetrics: [
                { label: 'Consumed Liters', key: 'consumed' },
                { label: 'Stock Liters', key: 'remaining' },
                { label: 'Estimate in Liters', key: 'estimate' },
                { label: 'Machine Run', key: 'machine' },
                { label: 'Delivery Liters/Drum', key: 'delivery' }
            ]
        },
        'Die slick 240VX': {
            description: "Die Lubricant",
            unit: "Liters",
            deliveryUnit: "Pail",
            tableKeys: { consumed: 'Total_Consumed', machine: 'Machine_Run', remaining: 'Remaining_Stock', delivery: 'Delivery', refill: 'Refill' },
            tableMetrics: [ // Unchanged item, converted to new format for consistency
                { label: 'Consumed Liters', key: 'consumed' },
                { label: 'Stock Liters', key: 'remaining' },
                { label: 'Estimate in Liters', key: 'estimate' },
                { label: 'Machine Run', key: 'machine' },
                { label: 'Delivery Liters/Drum', key: 'delivery' }
            ]
        },
        'Die-lube Antilot': {
            description: "Mould Wax",
            unit: "Can",
            deliveryUnit: "Can",
            tableKeys: { consumed: 'Total_Consumed', machine: 'Machine_Run', remaining: 'Remaining_Stock', delivery: 'Delivery', estimate: 'Estimate' },
            tableMetrics: [
                { label: 'Consumed Can', key: 'consumed' },
                { label: 'Stock Can', key: 'remaining' },
                { label: 'Estimate in Can', key: 'estimate' },
                { label: 'Machine Run', key: 'machine' },
                { label: 'Delivery Can', key: 'delivery' }
            ]
        },
        'Flux powder': {
            description: "Purifying Agent",
            unit: "kg",
            deliveryUnit: "kg",
            tableKeys: { consumed: 'Total_Consumed', machine: 'Machine_Run', remaining: 'Remaining_Stock', delivery: 'Delivery', estimate: 'Estimate' },
            tableMetrics: [
                { label: 'Consumed kg', key: 'consumed' },
                { label: 'Stock kg', key: 'remaining' },
                { label: 'Estimate kg', key: 'estimate' },
                { label: 'Machine Run', key: 'machine' },
                { label: 'Delivery kg', key: 'delivery' }
            ]
        }
    };

    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // --- UTILITY FUNCTIONS ---
    const getCurrentCategory = () => document.getElementById('item-select')?.value || 'SW220';
    const getCurrentPlant = () => document.getElementById('plant-select')?.value || 'GGPC - Gunma Gohkin';
    const filterRecords = (records, category, plant) => records.filter(r => r['Consumption_Category']?.value === category && r['Plant_Location']?.value === plant);

    // --- RENDERING FUNCTIONS ---
    function renderTable(records, days, year, month, config) {
        const table = document.getElementById('daily-table');
        if (!table) return;

        let headerHTML = `<tr><th class="sticky left-0 bg-slate-100 px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-left border-b border-slate-200">Items</th>`;
        for (let day = 1; day <= days; day++) {
            headerHTML += `<th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">${day}</th>`;
        }
        headerHTML += '</tr>';
        table.querySelector('thead').innerHTML = headerHTML;

        const tableMetrics = config.tableMetrics || [];
        
        let bodyHTML = '';
        tableMetrics.forEach((item, index) => {
            const dataKey = config.tableKeys[item.key];
            const isLastRow = index === tableMetrics.length - 1;
            const borderClass = isLastRow ? 'border-b-0' : 'border-b';
            
            bodyHTML += `<tr class="odd:bg-white even:bg-slate-50 hover:bg-sky-100 transition-colors duration-200">
                            <td class="sticky left-0 odd:bg-white even:bg-slate-50 hover:bg-sky-100 transition-colors duration-200 px-4 py-2 ${borderClass} border-slate-200 border-r font-medium text-slate-900 text-left">${item.label}</td>`;
            for (let day = 1; day <= days; day++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const rec = records.find(r => r['Date_Today']?.value === dateStr);
                bodyHTML += `<td class="px-4 py-2 ${borderClass} border-slate-200 text-slate-700 text-center">${rec?.[dataKey]?.value || '-'}</td>`;
            }
            bodyHTML += '</tr>';
        });
        table.querySelector('tbody').innerHTML = bodyHTML;
    }

    function renderStats(records, config, selectedMonth) {
        const totalConsumed = records.reduce((sum, r) => sum + (parseFloat(r[config.tableKeys.consumed]?.value) || 0), 0);
        const operatingDays = new Set(records.map(r => r.Date_Today.value)).size;
        const avgConsumption = operatingDays > 0 ? totalConsumed / operatingDays : 0;
        const totalDeliveries = records.reduce((sum, r) => sum + (parseFloat(r[config.tableKeys.delivery]?.value) || 0), 0);
        const currentMonthName = MONTH_NAMES[parseInt(selectedMonth, 10) - 1];

        document.getElementById('total-consumed').textContent = totalConsumed.toFixed(2);
        document.getElementById('efficiency').textContent = avgConsumption.toFixed(2);
        document.getElementById('total-deliveries').textContent = totalDeliveries;
        
        document.getElementById('avg-consumption-day').textContent = `${avgConsumption.toFixed(2)} ${config.unit}`;
        document.getElementById('monthly-consumption').textContent = `${totalConsumed.toFixed(2)} ${config.unit}`;
        
        document.getElementById('unit-of-measure').textContent = config.unit;
        document.getElementById('delivery-unit').textContent = config.deliveryUnit;

        document.getElementById('item-title').textContent = getCurrentCategory();
        document.getElementById('item-description').textContent = config.description;

        document.getElementById('total-consumed-label').textContent = `Total Consumed (${config.unit})`;
        document.getElementById('efficiency-label').textContent = `Avg ${config.unit} per Day`;
        document.getElementById('total-deliveries-label').textContent = `Total Deliveries (${config.deliveryUnit})`;
        
        const deliveryElem = document.getElementById('delivery-date');
        const deliveryRecords = records
            .filter(r => Number(r[config.tableKeys.delivery]?.value) > 0)
            .map(r => ({ day: new Date(r['Date_Today'].value).getDate(), amount: r[config.tableKeys.delivery]?.value }));
        deliveryElem.innerHTML = deliveryRecords.length 
            ? deliveryRecords.map(rec => `${currentMonthName} ${rec.day} – <strong>${rec.amount} ${config.deliveryUnit}(s)</strong>`).join('<br>') 
            : 'No deliveries this month.';
    }

    function renderMainChart(records, days, year, month, config) {
        let labels = [], data = [];
        if (currentTimeframe === 'weekly') {
            const weeklyData = aggregateDataByWeek(records, config);
            labels = weeklyData.map(w => `Week ${w.week}`);
            data = weeklyData.map(w => w.totalConsumption);
        } else {
            labels = Array.from({ length: days }, (_, i) => i + 1);
            data = labels.map(day => {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                return records.filter(r => r.Date_Today.value === dateStr)
                              .reduce((sum, r) => sum + (parseFloat(r[config.tableKeys.consumed]?.value) || 0), 0);
            });
        }
        
        if (mainChart) mainChart.destroy();
        mainChart = new Chart(document.getElementById('mainChart').getContext('2d'), {
            type: document.getElementById('chart-type').value,
            data: {
                labels,
                datasets: [{
                    label: `Total Consumption (${config.unit})`, data,
                    backgroundColor: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,1)',
                    borderWidth: 2, tension: 0.3, fill: true,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: true, text: `${currentTimeframe.charAt(0).toUpperCase() + currentTimeframe.slice(1)} Total Consumption` } },
                scales: {
                    x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week of the Month' : 'Day of the Month' } },
                    y: { beginAtZero: true, title: { display: true, text: config.unit } }
                }
            }
        });
    }
    
    function aggregateDataByWeek(records, config) {
        const weeklyData = {};
        records.forEach(rec => {
            const day = new Date(rec.Date_Today.value).getDate();
            const week = Math.ceil(day / 7);
            if (!weeklyData[week]) {
                weeklyData[week] = { totalConsumption: 0, totalDelivery: 0, totalRefills: 0, days: new Set() };
            }
            const dailyConsumption = parseFloat(rec[config.tableKeys.consumed]?.value) || 0;
            if ((rec[config.tableKeys.machine]?.value || '').trim() !== '' && dailyConsumption > 0) {
                weeklyData[week].days.add(rec.Date_Today.value);
            }
            weeklyData[week].totalConsumption += dailyConsumption;
            weeklyData[week].totalDelivery += parseFloat(rec[config.tableKeys.delivery]?.value) || 0;
            weeklyData[week].totalRefills += parseFloat(rec[config.tableKeys.refill]?.value) || 0;
        });
        return Object.entries(weeklyData).map(([week, data]) => ({
            week, ...data, machineOperatingDays: data.days.size
        }));
    }

    function renderWeeklySummaryTable(records, config) {
        const container = document.getElementById('weekly-summary-container');
        if (!container) return;
        const weeklyAggregates = aggregateDataByWeek(records, config);
        let tableHTML = `
          <h3 class="text-lg font-semibold text-slate-800 mb-4">Weekly Summary</h3>
          <div class="rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto custom-scroll">
              <table class="min-w-full text-sm text-left border-collapse">
                <thead class="bg-slate-100">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-left border-b border-slate-200">Week</th>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-left border-b border-slate-200">Total Consumed (${config.unit})</th>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-center border-b border-slate-200">Operating Days</th>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-left border-b border-slate-200">Avg. ${config.unit}/Day</th>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-center border-b border-slate-200">Deliveries (${config.deliveryUnit})</th>
                    <th class="px-4 py-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider text-center border-b border-slate-200">Refills (${config.deliveryUnit})</th>
                  </tr>
                </thead>
                <tbody>`;
        weeklyAggregates.forEach(w => {
          const efficiency = w.machineOperatingDays > 0 ? w.totalConsumption / w.machineOperatingDays : 0;
          tableHTML += `
            <tr class="odd:bg-white even:bg-slate-50 hover:bg-sky-100 transition-colors duration-200">
              <td class="px-4 py-2 border-b border-slate-200 font-medium text-slate-900">Week ${w.week}</td>
              <td class="px-4 py-2 border-b border-slate-200 text-slate-700">${w.totalConsumption.toFixed(2)}</td>
              <td class="px-4 py-2 border-b border-slate-200 text-slate-700 text-center">${w.machineOperatingDays}</td>
              <td class="px-4 py-2 border-b border-slate-200 text-slate-700">${efficiency.toFixed(2)}</td>
              <td class="px-4 py-2 border-b border-slate-200 text-slate-700 text-center">${w.totalDelivery}</td>
              <td class="px-4 py-2 border-b border-slate-200 text-slate-700 text-center">${w.totalRefills}</td>
            </tr>`;
        });
        container.innerHTML = tableHTML + '</tbody></table></div></div>';
      }
    
    function renderMachineChartsAndTable(records, config) {
        const machineData = records.reduce((acc, rec) => {
            const machineId = rec[config.tableKeys.machine]?.value || 'Unknown';
            const consumption = parseFloat(rec[config.tableKeys.consumed]?.value) || 0;
            if (consumption > 0) {
                if (!acc[machineId]) acc[machineId] = { totalConsumption: 0, days: new Set() };
                acc[machineId].totalConsumption += consumption;
                acc[machineId].days.add(rec.Date_Today.value);
            }
            return acc;
        }, {});

        const machines = Object.keys(machineData).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
        const grandTotal = machines.reduce((sum, m) => sum + machineData[m].totalConsumption, 0);

        if (machineChart) machineChart.destroy();
        machineChart = new Chart(document.getElementById('machineChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: machines.map(m => isNaN(m) ? m : `Machine ${m}`),
                datasets: [{
                    label: `Total Consumption (${config.unit})`,
                    data: machines.map(m => machineData[m].totalConsumption),
                    backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1']
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: true, text: `Consumption by Machine`, font: { size: 16 } } },
                scales: { y: { beginAtZero: true, title: { display: true, text: `Total Consumption (${config.unit})` } } }
            }
        });
        
        let tableHTML = `<div class="bg-white p-6 rounded-lg shadow-md border"><h3 class="text-lg font-bold mb-4">Machine Consumption Summary</h3><div class="overflow-x-auto custom-scroll"><table class="min-w-full text-sm">
            <thead class="bg-gray-50"><tr><th class="px-4 py-2 font-semibold text-left">Machine</th><th class="px-4 py-2 font-semibold text-right">Total (${config.unit})</th><th class="px-4 py-2 font-semibold text-center">Days</th><th class="px-4 py-2 font-semibold text-right">Avg/Day (${config.unit})</th><th class="px-4 py-2 font-semibold text-right">% of Total</th></tr></thead><tbody>`;
        machines.forEach(machine => {
            const data = machineData[machine];
            const operatingDays = data.days.size;
            const percentage = grandTotal > 0 ? (data.totalConsumption / grandTotal * 100) : 0;
            tableHTML += `<tr class="border-t hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">${isNaN(machine) ? machine : `Machine ${machine}`}</td>
                <td class="px-4 py-2 text-right font-bold text-blue-600">${data.totalConsumption.toFixed(2)}</td>
                <td class="px-4 py-2 text-center">${operatingDays}</td>
                <td class="px-4 py-2 text-right">${(data.totalConsumption/operatingDays).toFixed(2)}</td>
                <td class="px-4 py-2 text-right">${percentage.toFixed(1)}%</td>
            </tr>`;
        });
        tableHTML += `</tbody><tfoot class="bg-gray-100 font-bold border-t-2"><tr>
            <td class="px-4 py-2">TOTAL</td><td class="px-4 py-2 text-right text-green-600">${grandTotal.toFixed(2)}</td><td colspan="3"></td>
        </tr></tfoot></table></div></div>`;
        document.getElementById('machine-summary-table').innerHTML = tableHTML;
    }

    // --- INITIALIZATION & EVENT LISTENERS ---
    function setupControls() {
        const currentDate = new Date();
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        for (let y = currentDate.getFullYear() + 1; y >= 2022; y--) {
            yearSelect.add(new Option(y, y));
        }
        MONTH_NAMES.forEach((name, i) => {
            monthSelect.add(new Option(name, String(i + 1).padStart(2, '0')));
        });
        yearSelect.value = currentDate.getFullYear().toString();
        monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');
    }

    async function updateDashboard() {
        const m = document.getElementById('month-select').value;
        const y = document.getElementById('year-select').value;
        const d = new Date(y, m, 0).getDate();
        const category = getCurrentCategory();
        const plant = getCurrentPlant();
        const config = CONFIG_MAP[category] || {};
        
        allRecords = await fetchKintoneAllData(m, y);
        const filteredRecords = filterRecords(allRecords, category, plant);

        const dailyTable = document.getElementById('daily-table-container');
        const weeklyTable = document.getElementById('weekly-summary-container');
        const toggleBtnText = document.querySelector('#timeframe-toggle-btn span');

        if (currentTimeframe === 'weekly') {
            dailyTable.style.display = 'none';
            weeklyTable.style.display = 'block';
            if(toggleBtnText) toggleBtnText.textContent = 'Daily View';
        } else {
            dailyTable.style.display = 'block';
            weeklyTable.style.display = 'none'; 
            if(toggleBtnText) toggleBtnText.textContent = 'Weekly View';
        }
        
        renderTable(filteredRecords, d, y, m, config);
        renderWeeklySummaryTable(filteredRecords, config);
        renderStats(filteredRecords, config, m);
        renderMainChart(filteredRecords, d, y, m, config);
        renderMachineChartsAndTable(filteredRecords, config);
    }

    document.querySelectorAll('#item-select, #plant-select, #month-select, #year-select, #chart-type, #chart-view').forEach(el => el.addEventListener('change', () => {
        const dailyChart = document.getElementById('daily-chart-container');
        const machineChart = document.getElementById('machine-chart-container');
        if (document.getElementById('chart-view').value === 'daily') {
            dailyChart.style.display = 'block'; machineChart.style.display = 'none';
        } else {
            dailyChart.style.display = 'none'; machineChart.style.display = 'block';
        }
        updateDashboard();
    }));
  
    document.getElementById('timeframe-toggle-btn').addEventListener('click', () => {
        currentTimeframe = (currentTimeframe === 'daily') ? 'weekly' : 'daily';
        updateDashboard();
    });

    document.getElementById('toggle-machine-summary').addEventListener('click', (e) => {
        const summaryTable = document.getElementById('machine-summary-table');
        const btn = e.currentTarget;
        const btnSpan = btn.querySelector('span');
        const isHidden = summaryTable.style.display === 'none';
        summaryTable.style.display = isHidden ? 'block' : 'none';
        if (btnSpan) {
            btnSpan.textContent = isHidden ? 'Hide Machine Summary' : 'Show Machine Summary';
        }
    });

    const menuBtn = document.getElementById('menu-btn'), mobileMenu = document.getElementById('mobile-menu');
    menuBtn.addEventListener('click', () => {
        mobileMenu.style.maxHeight = (mobileMenu.style.maxHeight === '0px' || !mobileMenu.style.maxHeight) ? `${mobileMenu.scrollHeight}px` : '0px';
    });
    const mobileOilToggle = document.getElementById('mobile-oil-toggle'), mobileOilSubmenu = document.getElementById('mobile-oil-submenu'), mobileArrow = document.getElementById('mobile-arrow');
    mobileOilToggle.addEventListener('click', (e) => {
        e.preventDefault();
        mobileArrow.classList.toggle('rotate-180');
        mobileOilSubmenu.style.maxHeight = (mobileOilSubmenu.style.maxHeight === '0px' || !mobileOilSubmenu.style.maxHeight) ? `${mobileOilSubmenu.scrollHeight}px` : '0px';
        setTimeout(() => { if (mobileMenu.style.maxHeight !== '0px') mobileMenu.style.maxHeight = `${mobileMenu.scrollHeight}px`; }, 300);
    });
    
    document.querySelectorAll("select").forEach(select => {
        const iconWrapper = select.nextElementSibling;
        if(iconWrapper) {
            select.addEventListener("focus", () => iconWrapper.classList.add("rotate-180"));
            select.addEventListener("blur", () => iconWrapper.classList.remove("rotate-180"));
        }
    });

    lucide.createIcons();
    setupControls();
    await updateDashboard();
});