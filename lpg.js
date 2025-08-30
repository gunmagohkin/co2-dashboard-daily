document.addEventListener('DOMContentLoaded', async () => {

    const fetchKintoneAllData = async (month, year) => {
        try {
            const url = `/.netlify/functions/kintone?month=${month}&year=${year}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data from Kintone API');
                return []; 
            }
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('Error fetching from Netlify function:', error);
            return [];
        }
    };
    
    // --- CONFIG & GLOBAL VARS ---
    const CONFIG_MAP = {
      'LPG Monitoring': {
        table: [
          { label: 'Before Delivery: Tank 1', key: 'BD_Tank1' , category: 'LPG Monitoring'},
          { label: 'Before Delivery: Tank 2', key: 'BD_Tank2', category: 'LPG Monitoring' },
          { label: '', key: '' },
          { label: 'Consumed %: Tank 1', key: 'Consumed_Tank1', category: 'LPG Monitoring' },
          { label: 'Consumed %: Tank 2', key: 'Consumed_Tank2' , category: 'LPG Monitoring'},
          { label: '', key: '' },
          { label: 'Estimated in (Kg): Tank 1', key: 'Estimated_Tank1', category: 'LPG Monitoring' },
          { label: 'Estimated in (Kg): Tank 2', key: 'Estimated_Tank2' , category: 'LPG Monitoring'},
          { label: 'Estimate Total', key: 'Estimate_Total', category: 'LPG Monitoring' },
          { label: '', key: '' },
          { label: 'Ingot Used (pcs)', key: 'Ingot_Used', category: 'Ingot Used' },
          { label: 'Ingot Bundle', key: 'Ingot_Bundle', category: 'Ingot Used' },
          { label: '', key: '' },
          { label: 'Machine on Operation', key: 'Machine_no_Operation', category: 'LPG Monitoring'},
          { label: 'Furnace On', key: 'Furnace_On', category: 'LPG Monitoring' },
          { label: '', key: '' },
          { label: 'QTY Delivered (Kg): Tank 1', key: 'ND_Tank1', category: 'LPG Monitoring' },
          { label: 'QTY Delivered (Kg): Tank 2', key: 'ND_Tank2', category: 'LPG Monitoring' },
          { label: 'Total(kg) Metering', key: 'ND_Total', category: 'LPG Monitoring' },
          { label: 'Total(kg) Truck Scale', key: '' },
          { label: '', key: '' },
          { label: 'Total(%): TANK 1 DELIVERY', key: 'TDT_Tank1', category: 'LPG Monitoring' },
          { label: 'Total(%): TANK 2 DELIVERY', key: 'TDT_Tank2', category: 'LPG Monitoring' }
        ]
      }
    };
    
    let allRecords = [];
    let activityChart, utilizationChart;
    let currentTimeframe = 'daily';

    // --- UTILITY FUNCTIONS ---
    function getCurrentCategory() { return document.getElementById('category-title')?.textContent.trim() || 'LPG Monitoring'; }
    function getCurrentPlant() { return document.getElementById('plant-select')?.value || 'GGPC - Gunma Gohkin'; }
    function filterRecords(records, category, plant) {
        return records.filter(r => r['Consumption_Category']?.value === category && r['Plant_Location']?.value === plant);
    }

    // --- DATA AGGREGATION ---
    function aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth) {
        const weeklyData = {};
        const lpgRecords = filterRecords(records, 'LPG Monitoring', getCurrentPlant());

        for (let day = 1; day <= daysInMonth; day++) {
            const week = Math.ceil(day / 7);
            if (!weeklyData[week]) {
                weeklyData[week] = { totalConsumption: 0, totalActiveMachines: 0, totalIdleMachines: 0, daysInWeek: 0 };
            }
            weeklyData[week].daysInWeek++;

            const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
            const rec = lpgRecords.find(r => r['Date_Today']?.value === dateStr);
            if(rec){
                const consumption = (parseFloat(rec['Consumed_Tank1']?.value) || 0) + (parseFloat(rec['Consumed_Tank2']?.value) || 0);
                weeklyData[week].totalConsumption += consumption;
                weeklyData[week].totalActiveMachines += parseFloat(rec['Machine_no_Operation']?.value) || 0;
                weeklyData[week].totalIdleMachines += parseFloat(rec['Furnace_On']?.value) || 0;
            }
        }
        return Object.entries(weeklyData).map(([week, data]) => ({ week, ...data }));
    }

    // --- TABLE RENDERERS ---
    function renderTable(allRecords, daysInMonth, selectedYear, selectedMonth, config) {
        const table = document.getElementById('daily-table');
        if (!table) return;
        table.innerHTML = ''; 

        const thead = table.createTHead();
        thead.className = 'sticky top-0 bg-blue-50 z-10';
        const headerRow = thead.insertRow();
        const itemsTh = document.createElement('th');
        itemsTh.className = 'px-3 py-3 border-b border-gray-200 font-semibold text-black text-xs tracking-wide min-w-[150px] text-left';
        itemsTh.textContent = 'Items';
        headerRow.appendChild(itemsTh);

        for (let day = 1; day <= daysInMonth; day++) {
            const th = document.createElement('th');
            th.className = 'border-b border-gray-200 px-2 py-2 font-semibold text-black text-xs whitespace-nowrap';
            th.textContent = day.toString();
            headerRow.appendChild(th);
        }

        const tbody = table.createTBody();
        tbody.className = 'bg-white';

        config.table.forEach(item => {
            const row = tbody.insertRow();
            if(!item.label) {
                row.className = 'bg-blue-50'; // Spacer row
                const cell = row.insertCell();
                cell.colSpan = daysInMonth + 1;
                cell.innerHTML = '&nbsp;';
                return;
            }
            row.className = 'hover:bg-gray-50';
            const labelCell = row.insertCell();
            labelCell.className = 'px-3 py-2 border-b border-blue-200 font-semibold text-black text-left text-xs';
            labelCell.textContent = item.label;

            for (let day = 1; day <= daysInMonth; day++) {
                const cell = row.insertCell();
                cell.className = 'px-3 py-2 border-b border-gray-200 text-center text-xs';
                if (item.key) {
                    const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
                    const sourceCategory = item.category || getCurrentCategory();
                    const relevantRecords = filterRecords(allRecords, sourceCategory, getCurrentPlant());
                    const rec = relevantRecords.find(r => r['Date_Today']?.value === dateStr);
                    cell.textContent = rec?.[item.key]?.value || '-';
                }
            }
        });
    }

    function renderWeeklySummaryTable(allRecords, daysInMonth, selectedYear, selectedMonth) {
        const container = document.getElementById('weekly-summary-container');
        if (!container) return;
        const weeklyData = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const week = Math.ceil(day / 7);
            if (!weeklyData[week]) weeklyData[week] = { totalConsumption: 0, totalIngots: 0, activeDays: 0 };
            const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
            const lpgRec = filterRecords(allRecords, 'LPG Monitoring', getCurrentPlant()).find(r => r['Date_Today']?.value === dateStr);
            const ingotRec = filterRecords(allRecords, 'Ingot Used', getCurrentPlant()).find(r => r['Date_Today']?.value === dateStr);
            if (lpgRec || ingotRec) {
                const dailyConsumption = (parseFloat(lpgRec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(lpgRec?.['Consumed_Tank2']?.value) || 0);
                const dailyIngots = parseInt(ingotRec?.['Ingot_Used']?.value) || 0;
                if (dailyConsumption > 0 || dailyIngots > 0) {
                    weeklyData[week].activeDays++;
                    weeklyData[week].totalConsumption += dailyConsumption;
                    weeklyData[week].totalIngots += dailyIngots;
                }
            }
        }
        let tableHTML = `<h2 class="text-lg font-bold mb-4">Weekly Summary</h2><div class="overflow-x-auto border border-gray-200 rounded-lg shadow-sm custom-scroll"><table class="min-w-full text-sm text-left">
          <thead class="bg-gray-50"><tr><th class="px-4 py-2 font-semibold">Week</th><th class="px-4 py-2 font-semibold">Total LPG Consumed (%)</th><th class="px-4 py-2 font-semibold">Avg Daily Consumption (%)</th><th class="px-4 py-2 font-semibold">Total Ingots Used (pcs)</th><th class="px-4 py-2 font-semibold">Efficiency (LPG % per Ingot)</th></tr></thead><tbody>`;
        Object.keys(weeklyData).forEach(week => {
            const data = weeklyData[week];
            const avgConsumption = data.activeDays > 0 ? data.totalConsumption / data.activeDays : 0;
            const efficiency = data.totalIngots > 0 ? data.totalConsumption / data.totalIngots : 0;
            tableHTML += `<tr class="border-t hover:bg-gray-50"><td class="px-4 py-2 font-bold">Week ${week}</td><td class="px-4 py-2">${data.totalConsumption.toFixed(2)}</td><td class="px-4 py-2">${avgConsumption.toFixed(2)}</td><td class="px-4 py-2">${data.totalIngots}</td><td class="px-4 py-2">${efficiency.toFixed(4)}</td></tr>`;
        });
        container.innerHTML = tableHTML + `</tbody></table></div>`;
    }

    // --- STATS RENDERER ---
    function renderStats(records) {
      let totalConsumedPercent = 0, daysWithRecords = 0;
      records.forEach(r => {
        const dailyTotal = (parseFloat(r['Consumed_Tank1']?.value) || 0) + (parseFloat(r['Consumed_Tank2']?.value) || 0);
        if (dailyTotal > 0) { totalConsumedPercent += dailyTotal; daysWithRecords++; }
      });
      const avgConsumption = daysWithRecords > 0 ? totalConsumedPercent / daysWithRecords : 0;
      document.getElementById('total-consumed').textContent = totalConsumedPercent.toFixed(2) + '%';
      document.getElementById('avg-consumption').textContent = avgConsumption.toFixed(2) + '%';
    }

    // --- CHART RENDERERS ---
    function renderActivityChart(records, daysInMonth, selectedYear, selectedMonth) {
        let labels = [], consumptionData = [], machineCountData = [];
        const chartTitle = document.querySelector('#activityChart').closest('.bg-white').querySelector('h2');

        if (currentTimeframe === 'weekly') {
            const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth);
            labels = weeklyAggregates.map(w => `Week ${w.week}`);
            consumptionData = weeklyAggregates.map(w => w.totalConsumption);
            machineCountData = weeklyAggregates.map(w => w.daysInWeek > 0 ? w.totalActiveMachines / w.daysInWeek : 0);
            chartTitle.textContent = 'Weekly Consumption vs. Avg. Active Machines';
        } else {
            labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const dailyData = labels.map(day => {
                const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
                const rec = records.find(r => r['Date_Today']?.value === dateStr);
                return {
                    consumption: (parseFloat(rec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(rec?.['Consumed_Tank2']?.value) || 0),
                    machineCount: parseFloat(rec?.['Machine_no_Operation']?.value) || 0
                };
            });
            consumptionData = dailyData.map(d => d.consumption);
            machineCountData = dailyData.map(d => d.machineCount);
            chartTitle.textContent = 'Daily Consumption vs. Active Machines';
        }

        const ctx = document.getElementById('activityChart').getContext('2d');
        if (activityChart) activityChart.destroy();
        
        activityChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [ { label: 'LPG Consumed (%)', data: consumptionData, borderColor: '#3B82F6', backgroundColor: '#3B82F6', type: 'line', yAxisID: 'y', tension: 0.3 }, { label: 'Active Machines', data: machineCountData, backgroundColor: '#D1D5DB', yAxisID: 'y1' } ] },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week' : 'Day' } }, y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'LPG Consumed (%)' }, grid: { drawOnChartArea: false } }, y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Active Machines' } } } }
        });
    }

    function renderUtilizationChart(records, daysInMonth, selectedYear, selectedMonth) {
        let labels = [], activePercentData = [], idlePercentData = [];
        const chartTitle = document.querySelector('#utilizationChart').closest('.bg-white').querySelector('h2');

        if (currentTimeframe === 'weekly') {
            const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth);
            labels = weeklyAggregates.map(w => `Week ${w.week}`);
            weeklyAggregates.forEach(w => {
                const totalMachines = w.totalActiveMachines + w.totalIdleMachines;
                activePercentData.push(totalMachines > 0 ? (w.totalActiveMachines / totalMachines) * 100 : 0);
                idlePercentData.push(totalMachines > 0 ? (w.totalIdleMachines / totalMachines) * 100 : 0);
            });
            chartTitle.textContent = 'Weekly Machine Utilization';
        } else {
            labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const dailyData = labels.map(day => {
                 const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
                 const rec = records.find(r => r['Date_Today']?.value === dateStr);
                 const activeCount = parseFloat(rec?.['Machine_no_Operation']?.value) || 0;
                 const idleCount = parseFloat(rec?.['Furnace_On']?.value) || 0;
                 const total = activeCount + idleCount;
                 return {
                    active: total > 0 ? (activeCount / total) * 100 : 0,
                    idle: total > 0 ? (idleCount / total) * 100 : 0
                 };
            });
            activePercentData = dailyData.map(d => d.active);
            idlePercentData = dailyData.map(d => d.idle);
            chartTitle.textContent = 'Daily Machine Utilization';
        }

        const ctx = document.getElementById('utilizationChart').getContext('2d');
        if (utilizationChart) utilizationChart.destroy();

        utilizationChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [ { label: 'Active Machines (%)', data: activePercentData, backgroundColor: 'rgba(16, 185, 129, 0.5)', borderColor: '#10B981', fill: true }, { label: 'Idle Machines (%)', data: idlePercentData, backgroundColor: 'rgba(209, 213, 219, 0.5)', borderColor: '#9CA3AF', fill: true } ] },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week' : 'Day' } }, y: { stacked: true, max: 100, title: { display: true, text: 'Utilization (%)' } } } }
        });
    }

    // --- CONTROLS & MAIN LOGIC ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const plantSelect = document.getElementById('plant-select');
    const timeframeBtn = document.getElementById('timeframe-toggle-btn');
    
    function setupControls() {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear + 1; y >= 2022; y--) { yearSelect.add(new Option(y, y)); }
        yearSelect.value = currentYear.toString();
        monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');
    }

    async function updateData() {
        const m = monthSelect.value, y = yearSelect.value, p = plantSelect.value;
        const d = new Date(y, m, 0).getDate();
        const category = getCurrentCategory();
        const config = CONFIG_MAP[category] || {};
        
        allRecords = await fetchKintoneAllData(m, y);
        const filteredLpgRecords = filterRecords(allRecords, category, p);

        const dailyTable = document.getElementById('daily-table-container');
        const weeklyTable = document.getElementById('weekly-summary-container');
        const toggleBtnText = timeframeBtn.querySelector('span');

        if (currentTimeframe === 'weekly') {
            dailyTable.style.display = 'none';
            weeklyTable.style.display = 'block';
            if(toggleBtnText) toggleBtnText.textContent = 'Daily View';
        } else {
            dailyTable.style.display = 'block';
            weeklyTable.style.display = 'none';
            if(toggleBtnText) toggleBtnText.textContent = 'Weekly View';
        }
        
        renderTable(allRecords, d, y, m, config);
        renderWeeklySummaryTable(allRecords, d, y, m);
        renderStats(filteredLpgRecords);
        renderActivityChart(filteredLpgRecords, d, y, m);
        renderUtilizationChart(filteredLpgRecords, d, y, m);
    }
    
    [monthSelect, yearSelect, plantSelect].forEach(el => el?.addEventListener('change', updateData));
    
    timeframeBtn.addEventListener('click', () => {
        currentTimeframe = (currentTimeframe === 'daily') ? 'weekly' : 'daily';
        updateData();
    });

    // Mobile Menu
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileOilToggle = document.getElementById('mobile-oil-toggle');
    const mobileOilSubmenu = document.getElementById('mobile-oil-submenu');
    const mobileArrow = document.getElementById('mobile-arrow');

    menuBtn.addEventListener('click', () => {
        const isClosed = mobileMenu.style.maxHeight === '' || mobileMenu.style.maxHeight === '0px';
        mobileMenu.style.maxHeight = isClosed ? mobileMenu.scrollHeight + "px" : '0px';
    });

    mobileOilToggle.addEventListener('click', () => {
        mobileArrow.classList.toggle('rotate-180');
        const isSubmenuClosed = mobileOilSubmenu.style.maxHeight === '' || mobileOilSubmenu.style.maxHeight === '0px';
        mobileOilSubmenu.style.maxHeight = isSubmenuClosed ? mobileOilSubmenu.scrollHeight + "px" : '0px';
        setTimeout(() => {
            const isParentClosed = mobileMenu.style.maxHeight === '' || mobileMenu.style.maxHeight === '0px';
            if (!isParentClosed) { mobileMenu.style.maxHeight = mobileMenu.scrollHeight + "px"; }
        }, 300);
    });
    
    document.querySelectorAll("select").forEach(select => {
        const iconWrapper = select.nextElementSibling;
        if (iconWrapper) {
            select.addEventListener("focus", () => iconWrapper.classList.add("rotate-180"));
            select.addEventListener("blur", () => iconWrapper.classList.remove("rotate-180"));
        }
    });

    lucide.createIcons();
    setupControls();
    await updateData();
});