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
    ],
    chart: {},
    deliveryKey: 'Delivery_LPG'
  },
  'Ingot Used': {
    table: [
      { label: 'Inggot Used (pcs)', key: 'Ingot_Used' },
      { label: 'Ingot Bundle', key: 'Ingot_Bundle' },
    ],
  }
};

// Global variables
let allRecords = [];
let oilChart, machineChart, furnaceChart;
let machineChartViewMode = 'detail'; // 'detail' or 'summary'
let machineChartType = 'bar'; // 'bar' or 'line'
let furnaceChartViewMode = 'detail';
let furnaceChartType = 'bar';


// --- UTILITY FUNCTIONS ---
async function fetchKintoneAllData(month, year) {
  let url = '/.netlify/functions/kintone?month=' + month + '&year=' + year;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch data');
    return [];
  }
  const data = await response.json();
  return data.records || [];
}

function getCurrentCategory() {
  const categoryHeader = document.getElementById('category-title');
  return categoryHeader ? categoryHeader.textContent.trim() : Object.keys(CONFIG_MAP)[0];
}

function filterRecordsByCategory(records, category) {
  return records.filter(r => r['Consumption_Category']?.value === category);
}

function generateHslaColors(amount) {
  const colors = [];
  for (let i = 0; i < amount; i++) {
    const hue = (i * (360 / (amount * 1.618))) % 360; // Use golden angle for distinct colors
    colors.push(`hsla(${hue}, 70%, 50%, 0.85)`);
  }
  return colors;
}


// --- TABLE RENDERING ---
function renderTable(allRecords, daysInMonth, selectedYear, selectedMonth, config) {
    const table = document.getElementById('daily-table');
    if (!table) return;
    
    table.innerHTML = ''; // Clear existing content

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
                const sourceRecords = filterRecordsByCategory(allRecords, sourceCategory);
                const rec = sourceRecords.find(r => r['Date_Today']?.value === dateStr);
                td.textContent = rec?.[item.key]?.value || '';
            }
            row.appendChild(td);
        }
    });
}

// --- STATS RENDERING ---
function renderStats(records) {
  let totalConsumedPercent = 0, daysWithRecords = 0;
  records.forEach(r => {
    const dailyTotal = (parseFloat(r['Consumed_Tank1']?.value) || 0) + (parseFloat(r['Consumed_Tank2']?.value) || 0);
    if (dailyTotal > 0) {
      totalConsumedPercent += dailyTotal;
      daysWithRecords++;
    }
  });
  const avgConsumption = daysWithRecords > 0 ? totalConsumedPercent / daysWithRecords : 0;
  
  const totalStr = totalConsumedPercent.toFixed(2) + '%';
  const avgStr = avgConsumption.toFixed(2) + '%';
  
  document.getElementById('total-consumed').textContent = totalStr;
  document.getElementById('avg-consumption').textContent = avgStr;
  document.getElementById('total-consumed-machine').textContent = totalStr;
  document.getElementById('avg-consumption-machine').textContent = avgStr;
  document.getElementById('total-consumed-furnace').textContent = totalStr;
  document.getElementById('avg-consumption-furnace').textContent = avgStr;
}

// --- CHART RENDERING 1: Daily Consumption ---
function renderChart(records, daysInMonth, selectedYear, selectedMonth) {
  const labels = [], totalConsumptionData = [], machineData = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
    const rec = records.find(r => r['Date_Today']?.value === dateStr);
    labels.push(day.toString());
    totalConsumptionData.push((parseFloat(rec?.['Consumed_Tank1']?.value) || 0) + (parseFloat(rec?.['Consumed_Tank2']?.value) || 0));
    machineData.push(rec?.['Machine_no_Operation']?.value || 'N/A');
  }
  const ctx = document.getElementById('oilChart').getContext('2d');
  if (oilChart) oilChart.destroy();
  oilChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Consumed (%)', data: totalConsumptionData, customData: machineData,
        backgroundColor: 'rgba(59, 130, 246, 0.85)', borderColor: 'rgba(59, 130, 246, 1)',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Total Daily LPG Consumption' },
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label || ''}: ${c.parsed.y.toFixed(2)}%`,
            afterLabel: c => `Machine: #${c.dataset.customData[c.dataIndex] || 'N/A'}`
          }
        }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Day of the Month' } },
        y: { title: { display: true, text: 'Total Consumed (%)' }, ticks: { callback: v => v.toFixed(2) + '%' } }
      }
    }
  });
}

// --- CHART RENDERING 2: Consumption by Machine ---
function renderMachineConsumptionChart(records) {
  const consumptionByMachine = {};
  records.forEach(rec => {
    const machineNumber = rec?.['Machine_no_Operation']?.value;
    const dailyConsumption = (parseFloat(rec['Consumed_Tank1']?.value) || 0) + (parseFloat(rec['Consumed_Tank2']?.value) || 0);
    if (machineNumber && dailyConsumption > 0) {
      consumptionByMachine[machineNumber] = (consumptionByMachine[machineNumber] || 0) + dailyConsumption;
    }
  });

  const sortedMachineNumbers = Object.keys(consumptionByMachine).sort((a, b) => a - b);
  const ctx = document.getElementById('machineConsumptionChart').getContext('2d');
  let chartConfig;

  if (machineChartViewMode === 'summary') {
    const colors = generateHslaColors(sortedMachineNumbers.length);
    chartConfig = {
      type: machineChartType,
      data: {
        labels: ['Total Monthly Consumption'],
        datasets: sortedMachineNumbers.map((key, index) => ({
          label: `Machine #${key}`, data: [consumptionByMachine[key]],
          backgroundColor: colors[index], borderColor: colors[index], fill: true,
        }))
      },
      options: {
        plugins: { title: { display: true, text: 'Summary of Consumption by Machine' } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total Consumed (%)' } } }
      }
    };
  } else { // Detail mode
    chartConfig = {
      type: machineChartType,
      data: {
        labels: sortedMachineNumbers.map(key => `Machine #${key}`),
        datasets: [{
          label: 'Total Monthly Consumption (%)', data: sortedMachineNumbers.map(key => consumptionByMachine[key]),
          backgroundColor: 'rgba(239, 68, 68, 0.85)', borderColor: 'rgba(239, 68, 68, 1)',
        }]
      },
      options: {
        plugins: { title: { display: true, text: 'Total Consumption by Machine' }, legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Machine Number' } },
          y: { beginAtZero: true, title: { display: true, text: 'Total Consumed (%)' } }
        }
      }
    };
  }
  
  chartConfig.options.responsive = true;
  chartConfig.options.maintainAspectRatio = false;
  chartConfig.options.plugins.tooltip = { callbacks: { label: c => `${c.dataset.label || 'Consumption'}: ${c.parsed.y.toFixed(2)}%` } };
  
  if (machineChart) machineChart.destroy();
  machineChart = new Chart(ctx, chartConfig);
}

// --- CHART RENDERING 3: Consumption by Furnace ---
function renderFurnaceConsumptionChart(records) {
    const consumptionByFurnace = {};
    records.forEach(rec => {
        const furnaceId = rec?.['Furnace_On']?.value;
        const dailyConsumption = (parseFloat(rec['Consumed_Tank1']?.value) || 0) + (parseFloat(rec['Consumed_Tank2']?.value) || 0);
        if (furnaceId && dailyConsumption > 0) {
            consumptionByFurnace[furnaceId] = (consumptionByFurnace[furnaceId] || 0) + dailyConsumption;
        }
    });

    const sortedFurnaceIds = Object.keys(consumptionByFurnace).sort();
    const ctx = document.getElementById('furnaceConsumptionChart').getContext('2d');
    let chartConfig;

    if (furnaceChartViewMode === 'summary') {
        const colors = generateHslaColors(sortedFurnaceIds.length);
        chartConfig = {
            type: furnaceChartType,
            data: {
                labels: ['Total Monthly Consumption'],
                datasets: sortedFurnaceIds.map((key, index) => ({
                    label: `Furnace ${key}`, data: [consumptionByFurnace[key]],
                    backgroundColor: colors[index], borderColor: colors[index], fill: true,
                }))
            },
            options: {
                plugins: { title: { display: true, text: 'Summary of Consumption by Furnace' } },
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total Consumed (%)' } } }
            }
        };
    } else { // Detail mode
        chartConfig = {
            type: furnaceChartType,
            data: {
                labels: sortedFurnaceIds.map(key => `Furnace ${key}`),
                datasets: [{
                    label: 'Total Monthly Consumption (%)', data: sortedFurnaceIds.map(key => consumptionByFurnace[key]),
                    backgroundColor: 'rgba(16, 185, 129, 0.85)', borderColor: 'rgba(16, 185, 129, 1)',
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Total Consumption by Furnace' }, legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Furnace' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Total Consumed (%)' } }
                }
            }
        };
    }

    chartConfig.options.responsive = true;
    chartConfig.options.maintainAspectRatio = false;
    chartConfig.options.plugins.tooltip = { callbacks: { label: c => `${c.dataset.label || 'Consumption'}: ${c.parsed.y.toFixed(2)}%` } };

    if (furnaceChart) furnaceChart.destroy();
    furnaceChart = new Chart(ctx, chartConfig);
}


// --- UI CONTROLS SETUP ---
function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const showTotalConsumption = document.getElementById('show-total-consumption');
  if (!chartTypeSelect || !showTotalConsumption) return;
  
  chartTypeSelect.addEventListener('change', () => {
    if (oilChart) {
      oilChart.config.type = chartTypeSelect.value;
      oilChart.update();
    }
  });
  showTotalConsumption.addEventListener('change', () => {
    if (oilChart) {
      oilChart.data.datasets[0].hidden = !showTotalConsumption.checked;
      oilChart.update();
    }
  });
}

function setupChartViewControls() {
  const chartSelect = document.getElementById('chart-view-select');
  const dailyChartSection = document.getElementById('daily-chart-section');
  const machineChartSection = document.getElementById('machine-chart-section');
  const furnaceChartSection = document.getElementById('furnace-chart-section');
  const dailyControls = document.getElementById('daily-chart-controls');
  
  // Machine chart controls
  const machineSummaryBtn = document.getElementById('show-machine-summary-btn');
  const machineChartTypeSelect = document.getElementById('machine-chart-type');
  
  // Furnace chart controls
  const furnaceSummaryBtn = document.getElementById('show-furnace-summary-btn');
  const furnaceChartTypeSelect = document.getElementById('furnace-chart-type');
  
  if (!chartSelect || !dailyChartSection || !machineChartSection || !furnaceChartSection || !dailyControls || !machineSummaryBtn || !machineChartTypeSelect || !furnaceSummaryBtn || !furnaceChartTypeSelect) return;

  const updateChartView = (view) => {
    dailyChartSection.classList.add('hidden');
    machineChartSection.classList.add('hidden');
    furnaceChartSection.classList.add('hidden');
    dailyControls.style.display = 'none';

    const filteredRecords = filterRecordsByCategory(allRecords, getCurrentCategory());

    if (view === 'daily') {
      dailyChartSection.classList.remove('hidden');
      dailyControls.style.display = 'flex';
    } else if (view === 'machine') {
      machineChartSection.classList.remove('hidden');
      machineChartViewMode = 'detail';
      machineChartType = 'bar';
      machineSummaryBtn.textContent = 'Show Summary';
      machineChartTypeSelect.value = 'bar';
      renderMachineConsumptionChart(filteredRecords);
    } else if (view === 'furnace') {
      furnaceChartSection.classList.remove('hidden');
      furnaceChartViewMode = 'detail';
      furnaceChartType = 'bar';
      furnaceSummaryBtn.textContent = 'Show Summary';
      furnaceChartTypeSelect.value = 'bar';
      renderFurnaceConsumptionChart(filteredRecords);
    }
    chartSelect.value = view;
  };

  chartSelect.addEventListener('change', (e) => updateChartView(e.target.value));

  // Machine chart listeners
  machineSummaryBtn.addEventListener('click', () => {
    machineChartViewMode = (machineChartViewMode === 'detail') ? 'summary' : 'detail';
    machineSummaryBtn.textContent = (machineChartViewMode === 'detail') ? 'Show Summary' : 'Show Detail View';
    renderMachineConsumptionChart(filterRecordsByCategory(allRecords, getCurrentCategory()));
  });
  machineChartTypeSelect.addEventListener('change', (e) => {
    machineChartType = e.target.value;
    renderMachineConsumptionChart(filterRecordsByCategory(allRecords, getCurrentCategory()));
  });

  // Furnace chart listeners
  furnaceSummaryBtn.addEventListener('click', () => {
    furnaceChartViewMode = (furnaceChartViewMode === 'detail') ? 'summary' : 'detail';
    furnaceSummaryBtn.textContent = (furnaceChartViewMode === 'detail') ? 'Show Summary' : 'Show Detail View';
    renderFurnaceConsumptionChart(filterRecordsByCategory(allRecords, getCurrentCategory()));
  });
  furnaceChartTypeSelect.addEventListener('change', (e) => {
    furnaceChartType = e.target.value;
    renderFurnaceConsumptionChart(filterRecordsByCategory(allRecords, getCurrentCategory()));
  });

  updateChartView('daily');
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear().toString();

  if (yearSelect) {
    yearSelect.innerHTML = '';
    for (let y = currentDate.getFullYear() + 1; y >= 2022; y--) {
      const option = document.createElement('option');
      option.value = y.toString(); option.textContent = y.toString();
      yearSelect.appendChild(option);
    }
    yearSelect.value = currentYear;
  }
  if (monthSelect) monthSelect.value = currentMonth;

  const fetchDataAndRender = async () => {
    const m = monthSelect.value, y = yearSelect.value;
    const d = new Date(y, m, 0).getDate();
    const category = getCurrentCategory();
    const config = CONFIG_MAP[category] || {};
    
    allRecords = await fetchKintoneAllData(m, y);
    const filteredRecords = filterRecordsByCategory(allRecords, category);
    
    renderTable(allRecords, d, y, m, config);
    renderStats(filteredRecords);
    renderChart(filteredRecords, d, y, m);
    renderMachineConsumptionChart(filteredRecords);
    renderFurnaceConsumptionChart(filteredRecords);
  };

  monthSelect.addEventListener('change', fetchDataAndRender);
  yearSelect.addEventListener('change', fetchDataAndRender);

  setupChartControls();
  setupChartViewControls();

  await fetchDataAndRender(); // Initial load

  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
  const oilToggle = document.getElementById('mobile-oil-toggle');
  const oilSubmenu = document.getElementById('mobile-oil-submenu');
  oilToggle.addEventListener('click', () => oilSubmenu.classList.toggle('hidden'));
});