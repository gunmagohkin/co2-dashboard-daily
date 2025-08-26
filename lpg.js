// --- CONFIG MAP STARTS HERE ---
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
      { label: 'Inggot Used (pcs)', key: 'Ingot_Used', category: 'Ingot Used' },
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
  },
  'Ingot Used': {
    table: [
      { label: 'Inggot Used (pcs)', key: 'Ingot_Used' },
      { label: 'Ingot Bundle', key: 'Ingot_Bundle' },
    ]
  }
};

// Global variables
let allRecords = [];
let activityChart, utilizationChart;
let currentTimeframe = 'daily'; // 'daily' or 'weekly'

// --- UTILITY FUNCTIONS ---
async function fetchKintoneAllData(month, year) {
  let url = '/.netlify/functions/kintone?month=' + month + '&year=' + year;
  const response = await fetch(url);
  if (!response.ok) { console.error('Failed to fetch data'); return []; }
  const data = await response.json();
  return data.records || [];
}

function getCurrentCategory() {
  const categoryHeader = document.getElementById('category-title');
  return categoryHeader ? categoryHeader.textContent.trim() : 'LPG Monitoring';
}

function getCurrentPlant() {
    const plantSelect = document.getElementById('plant-select');
    return plantSelect ? plantSelect.value : 'GGPC - Gunma Gohkin';
}

function filterRecords(records, category, plant) {
  return records.filter(r => 
    r['Consumption_Category']?.value === category && 
    r['Plant_Location']?.value === plant
  );
}

// --- DATA AGGREGATION ---
function aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth) {
    const weeklyData = {};
    const lpgRecords = filterRecords(records, 'LPG Monitoring', getCurrentPlant());

    for (let day = 1; day <= daysInMonth; day++) {
        const week = Math.floor((day - 1) / 7) + 1;
        if (!weeklyData[week]) {
            weeklyData[week] = {
                totalConsumption: 0,
                totalActiveMachines: 0,
                totalIdleMachines: 0,
                daysInWeek: 0
            };
        }
        weeklyData[week].daysInWeek++;

        const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const rec = lpgRecords.find(r => r['Date_Today']?.value === dateStr);
        
        const consumption = (parseFloat(rec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(rec?.['Consumed_Tank2']?.value) || 0);
        weeklyData[week].totalConsumption += consumption;

        weeklyData[week].totalActiveMachines += parseFloat(rec?.['Machine_no_Operation']?.value) || 0;
        weeklyData[week].totalIdleMachines += parseFloat(rec?.['Furnace_On']?.value) || 0;
    }
    return Object.entries(weeklyData).map(([week, data]) => ({ week, ...data }));
}


// --- TABLE RENDERERS ---
function renderTable(allRecords, daysInMonth, selectedYear, selectedMonth, config) {
    const table = document.getElementById('daily-table');
    if (!table) return;
    table.innerHTML = '';

    const thead = document.createElement('thead');
    thead.className = 'sticky top-0 bg-gray-100 z-10';
    const headerRow = document.createElement('tr');
    headerRow.className = 'bg-blue-50';
    const itemsTh = document.createElement('th');
    itemsTh.className = 'border border-gray-300 px-2 py-1 font-semibold text-gray-700 text-xs whitespace-nowrap';
    itemsTh.textContent = 'Items';
    headerRow.appendChild(itemsTh);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    
    config.table.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'even:bg-gray-50 odd:bg-white hover:bg-blue-50 transition';
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-2 py-1 font-bold text-gray-700 text-xs whitespace-nowrap';
        td.innerHTML = item.label || '&nbsp;';
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const th = document.createElement('th');
        th.className = 'border border-gray-300 px-2 py-1 font-semibold text-gray-700 text-xs whitespace-nowrap';
        th.textContent = day.toString();
        headerRow.appendChild(th);
    }
    
    config.table.forEach((item, rowIdx) => {
        const row = tbody.children[rowIdx];
        for (let day = 1; day <= daysInMonth; day++) {
            const td = document.createElement('td');
            td.className = 'border border-gray-300 px-2 py-1 text-xs';
            if (item.key) {
                const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
                const sourceCategory = item.category || getCurrentCategory();
                const relevantRecords = filterRecords(allRecords, sourceCategory, getCurrentPlant());
                const rec = relevantRecords.find(r => r['Date_Today']?.value === dateStr);
                td.textContent = rec?.[item.key]?.value || '';
            }
            row.appendChild(td);
        }
    });
}

function renderWeeklySummaryTable(allRecords, daysInMonth, selectedYear, selectedMonth) {
    const container = document.getElementById('weekly-summary-container');
    if (!container) return;

    const weeklyData = {};
    for (let day = 1; day <= daysInMonth; day++) {
        const week = Math.floor((day - 1) / 7) + 1;
        if (!weeklyData[week]) {
            weeklyData[week] = { totalConsumption: 0, totalIngots: 0, activeDays: 0 };
        }

        const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const currentPlant = getCurrentPlant();
        
        const lpgRec = filterRecords(allRecords, 'LPG Monitoring', currentPlant).find(r => r['Date_Today']?.value === dateStr);
        const dailyConsumption = (parseFloat(lpgRec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(lpgRec?.['Consumed_Tank2']?.value) || 0);

        const ingotRec = filterRecords(allRecords, 'Ingot Used', currentPlant).find(r => r['Date_Today']?.value === dateStr);
        const dailyIngots = parseInt(ingotRec?.['Ingot_Used']?.value) || 0;

        if (dailyConsumption > 0 || dailyIngots > 0) {
            weeklyData[week].activeDays++;
            weeklyData[week].totalConsumption += dailyConsumption;
            weeklyData[week].totalIngots += dailyIngots;
        }
    }

    let tableHTML = `
        <h2 class="text-lg font-bold mb-4">Weekly Performance Summary</h2>
        <div class="overflow-x-auto border border-gray-300 rounded">
          <table class="min-w-full text-sm text-left">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-4 py-2 font-semibold">Week</th>
                <th class="px-4 py-2 font-semibold">Total LPG Consumed (%)</th>
                <th class="px-4 py-2 font-semibold">Avg Daily Consumption (%)</th>
                <th class="px-4 py-2 font-semibold">Total Ingots Used (pcs)</th>
                <th class="px-4 py-2 font-semibold">Efficiency (LPG % per Ingot)</th>
              </tr>
            </thead>
            <tbody>
    `;

    Object.keys(weeklyData).forEach(week => {
        const data = weeklyData[week];
        const avgConsumption = data.activeDays > 0 ? data.totalConsumption / data.activeDays : 0;
        const efficiency = data.totalIngots > 0 ? data.totalConsumption / data.totalIngots : 0;
        
        tableHTML += `
          <tr class="border-t even:bg-white odd:bg-gray-50">
            <td class="px-4 py-2 font-bold">Week ${week}</td>
            <td class="px-4 py-2">${data.totalConsumption.toFixed(2)}</td>
            <td class="px-4 py-2">${avgConsumption.toFixed(2)}</td>
            <td class="px-4 py-2">${data.totalIngots}</td>
            <td class="px-4 py-2">${efficiency.toFixed(4)}</td>
          </tr>
        `;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

// --- STATS RENDERING ---
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
    const chartTitle = document.querySelector('#activityChart').closest('div.bg-white').querySelector('h2');

    if (currentTimeframe === 'weekly') {
        const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth);
        labels = weeklyAggregates.map(w => `Week ${w.week}`);
        consumptionData = weeklyAggregates.map(w => w.totalConsumption);
        machineCountData = weeklyAggregates.map(w => w.daysInWeek > 0 ? w.totalActiveMachines / w.daysInWeek : 0);
        chartTitle.textContent = 'Weekly Consumption vs. Avg. Active Machines';
    } else { // Daily
        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(day.toString());
            const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
            const rec = records.find(r => r['Date_Today']?.value === dateStr);
            const consumption = (parseFloat(rec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(rec?.['Consumed_Tank2']?.value) || 0);
            consumptionData.push(consumption);
            const machineCount = parseFloat(rec?.['Machine_no_Operation']?.value) || 0;
            machineCountData.push(machineCount);
        }
        chartTitle.textContent = 'Daily Consumption vs. Active Machines';
    }

    const ctx = document.getElementById('activityChart').getContext('2d');
    if (activityChart) activityChart.destroy();
    
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                 {
                    label: 'LPG Consumed (%)', data: consumptionData,
                    borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 1)',
                    type: 'line', yAxisID: 'y', tension: 0.3
                },
                {
                    label: 'Active Machines', data: machineCountData,
                    backgroundColor: 'rgba(209, 213, 219, 0.8)', yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week of the Month' : 'Day of the Month' } },
                y: {
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: 'LPG Consumed (%)' },
                    grid: { drawOnChartArea: false } 
                },
                y1: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Active Machines (Count)' }
                }
            }
        }
    });
}

function renderUtilizationChart(records, daysInMonth, selectedYear, selectedMonth) {
    let labels = [], activePercentData = [], idlePercentData = [];
    const chartTitle = document.querySelector('#utilizationChart').closest('div.bg-white').querySelector('h2');

    if (currentTimeframe === 'weekly') {
        const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth);
        labels = weeklyAggregates.map(w => `Week ${w.week}`);
        weeklyAggregates.forEach(w => {
            const totalMachines = w.totalActiveMachines + w.totalIdleMachines;
            activePercentData.push(totalMachines > 0 ? (w.totalActiveMachines / totalMachines) * 100 : 0);
            idlePercentData.push(totalMachines > 0 ? (w.totalIdleMachines / totalMachines) * 100 : 0);
        });
        chartTitle.textContent = 'Weekly Machine Utilization';
    } else { // Daily
        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(day.toString());
            const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
            const rec = records.find(r => r['Date_Today']?.value === dateStr);
            const activeCount = parseFloat(rec?.['Machine_no_Operation']?.value) || 0;
            const idleCount = parseFloat(rec?.['Furnace_On']?.value) || 0;
            const total = activeCount + idleCount;
            activePercentData.push(total > 0 ? (activeCount / total) * 100 : 0);
            idlePercentData.push(total > 0 ? (idleCount / total) * 100 : 0);
        }
        chartTitle.textContent = 'Daily Machine Utilization';
    }

    const ctx = document.getElementById('utilizationChart').getContext('2d');
    if (utilizationChart) utilizationChart.destroy();

    utilizationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Active Machines (%)', data: activePercentData,
                    backgroundColor: 'rgba(16, 185, 129, 0.5)', borderColor: 'rgba(16, 185, 129, 1)',
                    fill: true
                },
                {
                    label: 'Idle Machines (%)', data: idlePercentData,
                    backgroundColor: 'rgba(209, 213, 219, 0.5)', borderColor: 'rgba(156, 163, 175, 1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index' } },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week of the Month' : 'Day of the Month' } },
                y: {
                    stacked: true, max: 100,
                    title: { display: true, text: 'Machine Utilization (%)' }
                }
            }
        }
    });
}


// --- UI CONTROLS & MAIN INITIALIZATION ---
function setupTimeframeControls(callback) {
    const timeframeBtn = document.getElementById('timeframe-toggle-btn');
    if (timeframeBtn) {
        timeframeBtn.addEventListener('click', () => {
            currentTimeframe = (currentTimeframe === 'daily') ? 'weekly' : 'daily';
            timeframeBtn.textContent = (currentTimeframe === 'daily') ? 'Switch to Weekly View' : 'Switch to Daily View';
            callback();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const plantSelect = document.getElementById('plant-select');
  const currentDate = new Date();
  
  if (yearSelect) {
    const currentYear = currentDate.getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear + 1; y >= 2022; y--) {
      const option = document.createElement('option');
      option.value = y.toString(); option.textContent = y.toString();
      yearSelect.appendChild(option);
    }
    yearSelect.value = currentYear.toString();
  }
  if (monthSelect) monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');

  const fetchDataAndRender = async () => {
    const m = monthSelect.value, y = yearSelect.value, p = plantSelect.value;
    const d = new Date(y, m, 0).getDate();
    const category = getCurrentCategory();
    const config = CONFIG_MAP[category] || {};
    
    allRecords = await fetchKintoneAllData(m, y);
    const filteredLpgRecords = filterRecords(allRecords, category, p);

    const dailyTable = document.getElementById('daily-table-container');
    const weeklyTable = document.getElementById('weekly-summary-container');
    if (currentTimeframe === 'weekly') {
        dailyTable.style.display = 'none';
        weeklyTable.style.display = 'block';
    } else {
        dailyTable.style.display = 'block';
        weeklyTable.style.display = 'none';
    }
    
    renderTable(allRecords, d, y, m, config);
    renderWeeklySummaryTable(allRecords, d, y, m);
    renderStats(filteredLpgRecords);
    renderActivityChart(filteredLpgRecords, d, y, m);
    renderUtilizationChart(filteredLpgRecords, d, y, m);
  };

  monthSelect.addEventListener('change', fetchDataAndRender);
  yearSelect.addEventListener('change', fetchDataAndRender);
  plantSelect.addEventListener('change', fetchDataAndRender);

  setupTimeframeControls(fetchDataAndRender);

  await fetchDataAndRender(); // Initial load

  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
});