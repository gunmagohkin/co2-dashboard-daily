//main.js
// Global variables
let allRecords = [];
let oilChart;
let machineChart;
let currentTimeframe = 'daily'; // 'daily' or 'weekly'

// --- CONFIG MAP STARTS HERE ---
const CONFIG_MAP = {
  'EP-220': {
    table: [
      { label: 'Total Consumed (Liters)', key: 'Total_Consumed_EP' },
      { label: 'Machine Run', key: 'Machine_Run' },
      { label: 'Remaining Stock (Liters)', key: 'Remaining_Stock_EP' },
      { label: 'Delivery (Pail)', key: 'Delivery_EP' },
      { label: 'Refill (Pail)', key: 'Refill_EP' },
      { label: 'Total Stock Pail', key: 'Total_Stock_EP_Pail' },
      { label: 'Total Stock Liters', key: 'Total_Stock_EP_Lit' }
    ],
    chart: {
      consumptionKey: 'Total_Consumed_EP',
      runtimeKey: 'Machine_Run',
      title: 'EP-220 Oil Consumption vs Machine Runtime'
    },
    deliveryKey: 'Delivery_EP',
    machineKey: 'Machine_ID'
  }
};
// --- CONFIG MAP ENDS HERE ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

function getCurrentPlant() {
  const plantSelect = document.getElementById('plant-select');
  return plantSelect ? plantSelect.value : 'GGPC';
}

function filterRecords(records, category, plant) {
  return records.filter(r => 
    r['Consumption_Category']?.value === category && 
    r['Plant_Location']?.value === plant
  );
}

// --- DATA AGGREGATION FOR WEEKLY VIEW (UPDATED) ---
function aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config) {
    const weeklyData = {};
    for (let day = 1; day <= daysInMonth; day++) {
        const week = Math.floor((day - 1) / 7) + 1;
        if (!weeklyData[week]) {
            weeklyData[week] = {
                totalConsumption: 0,
                machineOperatingDays: 0,
                totalDelivery: 0,
                totalRefills: 0 // Added for refills
            };
        }

        const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const rec = records.find(r => r['Date_Today']?.value === dateStr);
        
        const dailyConsumption = parseFloat(rec?.[config.chart.consumptionKey]?.value) || 0;
        const machineId = rec?.[config.chart.runtimeKey]?.value;
        const dailyDelivery = parseFloat(rec?.[config.deliveryKey]?.value) || 0;
        const dailyRefill = parseFloat(rec?.['Refill_EP']?.value) || 0; // Get daily refill data

        if (machineId && machineId.trim() !== '' && dailyConsumption > 0) {
            weeklyData[week].machineOperatingDays++;
        }
        
        weeklyData[week].totalConsumption += dailyConsumption;
        weeklyData[week].totalDelivery += dailyDelivery;
        weeklyData[week].totalRefills += dailyRefill; // Sum up daily refills
    }
    return Object.entries(weeklyData).map(([week, data]) => ({ week, ...data }));
}


// --- MACHINE CONSUMPTION FUNCTIONS ---
function groupConsumptionByMachine(records, config) {
  const machineData = {};
  
  records.forEach(record => {
    const machineId = record[config.chart.runtimeKey]?.value || 'Unknown';
    const consumption = parseFloat(record[config.chart.consumptionKey]?.value) || 0;
    if (consumption === 0) return;
    
    if (!machineData[machineId]) {
      machineData[machineId] = { totalConsumption: 0, days: 0, avgConsumption: 0 };
    }
    machineData[machineId].totalConsumption += consumption;
    machineData[machineId].days += 1;
  });
  
  Object.keys(machineData).forEach(machineId => {
    const machine = machineData[machineId];
    machine.avgConsumption = machine.days > 0 ? machine.totalConsumption / machine.days : 0;
  });
  return machineData;
}

function renderMachineConsumptionTable(records, config) {
  const machineData = groupConsumptionByMachine(records, config);
  const machines = Object.keys(machineData).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const tableContainer = document.getElementById('machine-summary-table');
  if (!tableContainer) return;

  const grandTotal = machines.reduce((sum, machine) => sum + machineData[machine].totalConsumption, 0);
  
  let tableHTML = `
    <div class="bg-white p-6 rounded shadow-md">
      <h3 class="text-lg font-bold mb-4">Machine Consumption Summary</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse border border-gray-300">
          <thead class="bg-blue-50">
            <tr>
              <th class="border border-gray-300 px-4 py-2 font-semibold text-gray-700">Machine</th>
              <th class="border border-gray-300 px-4 py-2 font-semibold text-gray-700">Total Consumption (L)</th>
              <th class="border border-gray-300 px-4 py-2 font-semibold text-gray-700">Days Operated</th>
              <th class="border border-gray-300 px-4 py-2 font-semibold text-gray-700">Average per Day (L)</th>
              <th class="border border-gray-300 px-4 py-2 font-semibold text-gray-700">Percentage of Total</th>
            </tr>
          </thead>
          <tbody>`;

  machines.forEach((machine, index) => {
    const data = machineData[machine];
    const machineLabel = isNaN(machine) ? machine : `Machine ${machine}`;
    const percentage = grandTotal > 0 ? (data.totalConsumption / grandTotal * 100) : 0;
    tableHTML += `
      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50">
        <td class="border border-gray-300 px-4 py-2 font-medium">${machineLabel}</td>
        <td class="border border-gray-300 px-4 py-2 text-right font-bold text-blue-600">${data.totalConsumption.toFixed(2)}</td>
        <td class="border border-gray-300 px-4 py-2 text-center">${data.days}</td>
        <td class="border border-gray-300 px-4 py-2 text-right">${data.avgConsumption.toFixed(2)}</td>
        <td class="border border-gray-300 px-4 py-2 text-right">${percentage.toFixed(1)}%</td>
      </tr>`;
  });

  tableHTML += `
          </tbody>
          <tfoot class="bg-gray-100 font-bold">
            <tr>
              <td class="border border-gray-300 px-4 py-2">TOTAL</td>
              <td class="border border-gray-300 px-4 py-2 text-right text-green-600">${grandTotal.toFixed(2)}</td>
              <td colspan="3" class="border border-gray-300 px-4 py-2 text-center">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  tableContainer.innerHTML = tableHTML;
}

// --- TABLE RENDERING ---
function renderTable(records, daysInMonth, selectedYear, selectedMonth, config) {
  const table = document.getElementById('daily-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const headerRow = table.querySelector('thead tr');

  while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
  for (let day = 1; day <= daysInMonth; day++) {
    const th = document.createElement('th');
    th.className = 'border border-gray-300 px-2 py-1 font-semibold text-gray-700 text-xs whitespace-nowrap';
    th.textContent = day.toString();
    headerRow.appendChild(th);
  }

  Array.from(tbody.querySelectorAll('tr')).forEach(row => {
    while (row.children.length > 1) row.removeChild(row.lastChild);
  });

  config.table.forEach((item, rowIdx) => {
    const row = tbody.children[rowIdx];
    for (let day = 1; day <= daysInMonth; day++) {
      const td = document.createElement('td');
      td.className = 'border border-gray-300 px-2 py-1 text-xs';
      const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
      const rec = records.find(r => r['Date_Today']?.value === dateStr);
      td.textContent = rec?.[item.key]?.value || '-';
      row.appendChild(td);
    }
  });
}

// --- WEEKLY SUMMARY TABLE RENDERER (UPDATED) ---
function renderWeeklySummaryTable(records, daysInMonth, selectedYear, selectedMonth, config) {
    const container = document.getElementById('weekly-summary-container');
    if (!container) return;

    const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config);
    
    let tableHTML = `
        <h2 class="text-lg font-bold mb-4">Weekly Performance Summary</h2>
        <div class="overflow-x-auto border border-gray-300 rounded">
          <table class="min-w-full text-sm text-left">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-4 py-2 font-semibold">Week</th>
                <th class="px-4 py-2 font-semibold">Total Consumed (L)</th>
                <th class="px-4 py-2 font-semibold">Machine Operating Days</th>
                <th class="px-4 py-2 font-semibold">Avg. Liters per Day</th>
                <th class="px-4 py-2 font-semibold">Deliveries (Pails)</th>
                <th class="px-4 py-2 font-semibold">Total Refills (Pails)</th>
              </tr>
            </thead>
            <tbody>`;

    weeklyAggregates.forEach(w => {
        const data = w;
        const efficiency = data.machineOperatingDays > 0 ? data.totalConsumption / data.machineOperatingDays : 0;
        
        tableHTML += `
          <tr class="border-t even:bg-white odd:bg-gray-50">
            <td class="px-4 py-2 font-bold">Week ${data.week}</td>
            <td class="px-4 py-2">${data.totalConsumption.toFixed(2)}</td>
            <td class="px-4 py-2">${data.machineOperatingDays}</td>
            <td class="px-4 py-2">${efficiency.toFixed(2)}</td>
            <td class="px-4 py-2">${data.totalDelivery}</td>
            <td class="px-4 py-2">${data.totalRefills}</td>
          </tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

// --- STATS RENDERING ---
function renderStats(records, config, daysInMonth, selectedMonth, selectedYear) {
  const totalConsumed = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.consumptionKey]?.value) || 0), 0);
  const operatingDays = records.filter(r => (r[config.chart.runtimeKey]?.value || '').trim() !== '' && parseFloat(r[config.chart.consumptionKey]?.value) > 0).length;
  const avgConsumption = operatingDays > 0 ? totalConsumed / operatingDays : 0;
  
  const totalDeliveries = records.reduce((sum, r) => sum + (parseFloat(r[config.deliveryKey]?.value) || 0), 0);

  const efficiencyLabel = document.querySelector('#efficiency + .text-sm');
  if (efficiencyLabel) efficiencyLabel.textContent = 'Avg L per Day';
  
  document.getElementById('total-consumed').textContent = totalConsumed.toFixed(2);
  document.getElementById('efficiency').textContent = avgConsumption.toFixed(2);
  document.getElementById('total-deliveries').textContent = totalDeliveries;
  
  document.getElementById('avg-consumption-day').textContent = avgConsumption.toFixed(2);
  document.getElementById('avg-consumption-day-label').textContent = "Average consumption / day:";
  document.getElementById('monthly-consumption').textContent = totalConsumed.toFixed(2);
  document.getElementById('monthly-consumption-label').textContent = "Monthly consumption:";

  const deliveryElem = document.getElementById('delivery-date');
  if (deliveryElem) {
    const deliveryRecords = records
      .filter(r => Number(r[config.deliveryKey]?.value) > 0)
      .map(r => ({
        day: new Date(r['Date_Today'].value).getDate(),
        amount: r[config.deliveryKey]?.value
      }));

    if (deliveryRecords.length) {
      const monthName = MONTH_NAMES[parseInt(selectedMonth, 10) - 1];
      deliveryElem.innerHTML = deliveryRecords
        .map(rec => `${monthName} ${rec.day} – ${rec.amount} Pail`)
        .join('<br>');
    } else {
      deliveryElem.textContent = '-';
    }
  }
}

// --- CHART RENDERING ---
function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
  let labels = [], consumptionData = [];
  const chartTitle = document.getElementById('chart-main-title');

  if (currentTimeframe === 'weekly') {
      const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config);
      labels = weeklyAggregates.map(w => `Week ${w.week}`);
      consumptionData = weeklyAggregates.map(w => w.totalConsumption);
      chartTitle.textContent = 'Weekly Oil Consumption Analysis';
  } else { // Daily
      for (let day = 1; day <= daysInMonth; day++) {
          labels.push(day.toString());
          const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
          const rec = records.find(r => r['Date_Today']?.value === dateStr);
          consumptionData.push(parseFloat(rec?.[config.chart.consumptionKey]?.value) || 0);
      }
      chartTitle.textContent = 'EP-220 Oil Consumption Analysis';
  }
    
  const ctx = document.getElementById('oilChart').getContext('2d');
  const chartTypeSelect = document.getElementById('chart-type');
  const chartType = chartTypeSelect ? chartTypeSelect.value : 'line';

  if (oilChart) oilChart.destroy();
  
  oilChart = new Chart(ctx, {
      type: chartType,
      data: {
          labels: labels,
          datasets: [{
              label: 'Total Consumption (Liters)',
              data: consumptionData,
              backgroundColor: 'rgba(59,130,246,0.3)',
              borderColor: 'rgba(59,130,246,1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              title: { display: true, text: currentTimeframe === 'weekly' ? 'Total Weekly Consumption' : 'Daily Total Consumption' }
          },
          scales: {
              x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week of the Month' : 'Day of the Month' } },
              y: { beginAtZero: true, title: { display: true, text: 'Liters' } }
          }
      }
  });
}

function renderMachineChart(records, config, isStacked = false) {
  const machineData = groupConsumptionByMachine(records, config);
  const machines = Object.keys(machineData).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
  });

  const ctx = document.getElementById('machineChart').getContext('2d');
  if (machineChart) machineChart.destroy();

  const colors = ['rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 205, 86, 0.8)', 'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)'];
  let datasets = [];
  let labels = [];
  let chartTitle = 'Oil Consumption by Machine';

  if (isStacked) {
      labels = ['Total Oil Consumption'];
      machines.forEach((machine, index) => {
          datasets.push({
              label: isNaN(machine) ? machine : `Machine ${machine}`,
              data: [machineData[machine].totalConsumption],
              backgroundColor: colors[index % colors.length]
          });
      });
      chartTitle = 'Stacked Oil Consumption by Machine';
  } else {
      labels = machines.map(m => isNaN(m) ? m : `Machine ${m}`);
      datasets = [{
          label: 'Total Oil Consumption (Liters)',
          data: machines.map(m => machineData[m].totalConsumption),
          backgroundColor: colors
      }];
  }

  machineChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: chartTitle, font: { size: 16 } } },
          scales: {
              x: { stacked: isStacked, title: { display: true, text: 'Machines' } },
              y: { stacked: isStacked, beginAtZero: true, title: { display: true, text: 'Oil Consumption (Liters)' } }
          }
      }
  });
}

// --- CHART CONTROLS ---
function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const chartViewSelect = document.getElementById('chart-view');
  
  if (chartTypeSelect) {
      chartTypeSelect.addEventListener('change', () => {
          if (oilChart) {
              const currentCategory = getCurrentCategory();
              const config = CONFIG_MAP[currentCategory];
              const records = filterRecords(allRecords, currentCategory, getCurrentPlant());
              const daysInMonth = new Date(document.getElementById('year-select').value, document.getElementById('month-select').value, 0).getDate();
              renderChart(records, daysInMonth, document.getElementById('year-select').value, document.getElementById('month-select').value, config);
          }
      });
  }
  
  if (chartViewSelect) {
    chartViewSelect.addEventListener('change', () => {
      const dailyChart = document.getElementById('daily-chart-container');
      const machineChartContainer = document.getElementById('machine-chart-container');
      if (chartViewSelect.value === 'daily') {
        dailyChart.style.display = 'block';
        machineChartContainer.style.display = 'none';
      } else {
        dailyChart.style.display = 'none';
        machineChartContainer.style.display = 'block';
      }
    });
  }

  const summaryToggleBtn = document.getElementById('toggle-machine-summary');
  if (summaryToggleBtn) {
    summaryToggleBtn.addEventListener('click', () => {
      const summaryTable = document.getElementById('machine-summary-table');
      const isHidden = summaryTable.style.display === 'none';
      summaryTable.style.display = isHidden ? 'block' : 'none';
      summaryToggleBtn.textContent = isHidden ? 'Hide Machine Summary' : 'Show Machine Summary';
      summaryToggleBtn.classList.toggle('bg-blue-500');
      summaryToggleBtn.classList.toggle('hover:bg-blue-600');
      summaryToggleBtn.classList.toggle('bg-gray-500');
      summaryToggleBtn.classList.toggle('hover:bg-gray-600');
      
      const config = CONFIG_MAP[getCurrentCategory()];
      const records = filterRecords(allRecords, getCurrentCategory(), getCurrentPlant());
      renderMachineChart(records, config, isHidden);
    });
  }
}

// --- TIMEFRAME CONTROLS SETUP ---
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

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const plantSelect = document.getElementById('plant-select');
  const currentDate = new Date();
  
  if (yearSelect) {
    const currentYear = currentDate.getFullYear();
    for (let y = currentYear + 1; y >= 2022; y--) {
      yearSelect.add(new Option(y, y));
    }
    yearSelect.value = currentYear.toString();
  }
  if (monthSelect) monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');

  const updateData = async () => {
    const m = monthSelect.value, y = yearSelect.value, p = plantSelect.value;
    const d = new Date(y, m, 0).getDate();
    const category = getCurrentCategory();
    const config = CONFIG_MAP[category] || {};
    
    allRecords = await fetchKintoneAllData(m, y);
    const filteredRecords = filterRecords(allRecords, category, p);

    const dailyTable = document.getElementById('daily-table-container');
    const weeklyTable = document.getElementById('weekly-summary-container');
    const chartViewControl = document.getElementById('chart-view-control');

    if (currentTimeframe === 'weekly') {
        dailyTable.style.display = 'none';
        weeklyTable.style.display = 'block';
        if (chartViewControl) chartViewControl.style.display = 'none'; 
        
        document.getElementById('daily-chart-container').style.display = 'block';
        document.getElementById('machine-chart-container').style.display = 'none';
        const chartViewSelect = document.getElementById('chart-view');
        if (chartViewSelect) chartViewSelect.value = 'daily';

    } else {
        dailyTable.style.display = 'block';
        weeklyTable.style.display = 'none';
        if (chartViewControl) chartViewControl.style.display = 'flex';
    }
    
    renderTable(filteredRecords, d, y, m, config);
    renderWeeklySummaryTable(filteredRecords, d, y, m, config);
    renderStats(filteredRecords, config, d, m, y);
    renderChart(filteredRecords, d, y, m, config);
    renderMachineChart(filteredRecords, config, false);
    renderMachineConsumptionTable(filteredRecords, config);
  };

  monthSelect.addEventListener('change', updateData);
  yearSelect.addEventListener('change', updateData);
  plantSelect.addEventListener('change', updateData);

  setupChartControls();
  setupTimeframeControls(updateData);

  await updateData();

  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if(menuBtn) menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
});