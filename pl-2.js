// Global variables
let allRecords = [];
let oilChart;
let machineChart;

// --- CONFIG MAP STARTS HERE ---
const CONFIG_MAP = {
  'PL-1000': {
    table: [
      { label: 'Total Consumed (Liters)', key: 'Total_Consumed_PL' },
      { label: 'Machine Run', key: 'Machine_Run_PL' },
      { label: 'Remaining Stock (Liters)', key: 'Remaining_Stock_PL' },
      { label: 'Delivery (Pail)', key: 'Delivery_PL' },
      { label: 'Refill (Pail)', key: 'Refill_PL' },
      { label: 'Total Stock Pail', key: 'Total_Stock_PL_Pail' },
      { label: 'Total Stock Liters', key: 'Total_Stock_PL_Lit' }
    ],
    chart: {
      consumptionKey: 'Total_Consumed_PL',
      runtimeKey: 'Machine_Run_PL',
      title: 'PL-1000 Oil Consumption'
    },
    deliveryKey: 'Delivery_PL',
    machineKey: 'Machine_ID'
  }
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Generate sample data for demonstration purposes
function generateSampleData(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const records = [];
  
  // Available machines for random selection
  const availableMachines = ['1', '2', '3', '4', '5'];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Generate realistic sample data
    const totalConsumed = Math.round((Math.random() * 20 + 10) * 100) / 100; // 10-30 liters
    
    // Randomly select 1-3 machines that were used this day
    const numMachinesUsed = Math.ceil(Math.random() * 3); // 1 to 3 machines
    const machinesUsed = [];
    
    for (let i = 0; i < numMachinesUsed; i++) {
      let randomMachine;
      do {
        randomMachine = availableMachines[Math.floor(Math.random() * availableMachines.length)];
      } while (machinesUsed.includes(randomMachine));
      machinesUsed.push(randomMachine);
    }
    
    // Join machine numbers with comma if multiple machines
    const machineRun = machinesUsed.join(', ');
    
    const remainingStock = Math.round((Math.random() * 100 + 200) * 100) / 100; // 200-300 liters
    
    // Occasional deliveries (about 20% chance)
    const delivery = Math.random() < 0.2 ? Math.ceil(Math.random() * 5) : 0;
    const refill = delivery > 0 ? delivery : 0;
    
    const record = {
      'Date_Today': { value: dateStr },
      'Consumption_Category': { value: 'PL-1000' },
      'Total_Consumed_PL': { value: totalConsumed.toString() },
      'Machine_Run_PL': { value: machineRun }, // This now contains actual machine numbers used
      'Remaining_Stock_PL': { value: remainingStock.toString() },
      'Delivery_PL': { value: delivery.toString() },
      'Refill_PL': { value: refill.toString() },
      'Total_Stock_PL_Pail': { value: Math.ceil(remainingStock / 20).toString() },
      'Total_Stock_PL_Lit': { value: remainingStock.toString() }
    };
    
    records.push(record);
  }
  
  return records;
}

async function fetchKintoneAllData(month, year) {
  try {
    console.log(`Fetching data for ${month}/${year}`);
    return generateSampleData(month, year);
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return generateSampleData(month, year);
  }
}

function getCurrentCategory() {
  return 'PL-1000';
}

function filterRecordsByCategory(records, category) {
  return records.filter(r => r['Consumption_Category']?.value === category);
}

// Group consumption data by machine number
function groupConsumptionByMachine(records, config) {
  const machineData = {};
  
  records.forEach(record => {
    // Get machine number from Machine Run field (this contains the actual machine numbers used)
    const machineRunValue = record[config.chart.runtimeKey]?.value;
    const consumption = parseFloat(record[config.chart.consumptionKey]?.value) || 0;
    
    // Skip if no consumption data or no machine run data
    if (consumption === 0 || !machineRunValue || machineRunValue === '') return;
    
    // Parse machine numbers - could be single number or comma-separated list
    const machineNumbers = machineRunValue.toString().split(',').map(m => m.trim()).filter(m => m !== '');
    
    machineNumbers.forEach(machineId => {
      if (!machineData[machineId]) {
        machineData[machineId] = {
          totalConsumption: 0,
          days: 0,
          avgConsumption: 0
        };
      }
      
      // If multiple machines were used on same day, split the consumption equally
      const consumptionPerMachine = machineNumbers.length > 1 ? consumption / machineNumbers.length : consumption;
      
      machineData[machineId].totalConsumption += consumptionPerMachine;
      machineData[machineId].days += 1;
    });
  });
  
  // Calculate averages
  Object.keys(machineData).forEach(machineId => {
    const machine = machineData[machineId];
    machine.avgConsumption = machine.days > 0 ? machine.totalConsumption / machine.days : 0;
  });
  
  return machineData;
}

// Render machine consumption summary table
function renderMachineConsumptionTable(records, config) {
  const machineData = groupConsumptionByMachine(records, config);
  const machines = Object.keys(machineData).sort((a, b) => {
    // Sort machines numerically if they are numbers
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const tableContainer = document.getElementById('machine-summary-table');
  if (!tableContainer) return;

  // Calculate grand total
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
          <tbody>
  `;

  machines.forEach((machine, index) => {
    const data = machineData[machine];
    const machineLabel = isNaN(machine) ? machine : `Machine ${machine}`;
    const percentage = grandTotal > 0 ? (data.totalConsumption / grandTotal * 100) : 0;
    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    
    tableHTML += `
      <tr class="${rowClass} hover:bg-blue-50">
        <td class="border border-gray-300 px-4 py-2 font-medium">${machineLabel}</td>
        <td class="border border-gray-300 px-4 py-2 text-right font-bold text-blue-600">${data.totalConsumption.toFixed(2)}</td>
        <td class="border border-gray-300 px-4 py-2 text-center">${data.days}</td>
        <td class="border border-gray-300 px-4 py-2 text-right">${data.avgConsumption.toFixed(2)}</td>
        <td class="border border-gray-300 px-4 py-2 text-right">${percentage.toFixed(1)}%</td>
      </tr>
    `;
  });

  tableHTML += `
          </tbody>
          <tfoot class="bg-gray-100 font-bold">
            <tr>
              <td class="border border-gray-300 px-4 py-2">TOTAL</td>
              <td class="border border-gray-300 px-4 py-2 text-right text-green-600">${grandTotal.toFixed(2)}</td>
              <td class="border border-gray-300 px-4 py-2 text-center">-</td>
              <td class="border border-gray-300 px-4 py-2 text-right">-</td>
              <td class="border border-gray-300 px-4 py-2 text-right">100.0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  tableContainer.innerHTML = tableHTML;
}

function renderTable(records, daysInMonth, selectedYear, selectedMonth, config) {
  const table = document.getElementById('daily-table');
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  const headerRow = table.querySelector('thead tr');

  while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);

  for (let day = 1; day <= daysInMonth; day++) {
    const th = document.createElement('th');
    th.className = 'px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-xs whitespace-nowrap';
    th.textContent = day.toString();
    headerRow.appendChild(th);
  }

  Array.from(tbody.querySelectorAll('tr')).forEach(row => {
    while (row.children.length > 1) row.removeChild(row.lastChild);
  });

  config.table.forEach((item, rowIdx) => {
    const row = tbody.children[rowIdx];
    if (!row) return;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const td = document.createElement('td');
      td.className = 'px-3 py-2 border border-gray-200 text-xs';
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = records.find(r => r['Date_Today']?.value === dateStr);
      td.textContent = rec && rec[item.key] && rec[item.key].value !== '' ? rec[item.key].value : '-';
      row.appendChild(td);
    }
  });
}

function renderStats(records, config, daysInMonth, selectedMonth, selectedYear) {
  const totalConsumed = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.consumptionKey]?.value) || 0), 0);
  const totalRuntime = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.runtimeKey]?.value) || 0), 0);
  const avgConsumption = daysInMonth ? totalConsumed / daysInMonth : 0;
  const efficiency = totalRuntime ? totalConsumed / totalRuntime : 0;

  document.getElementById('total-consumed').textContent = totalConsumed.toFixed(2);
  document.getElementById('avg-consumption').textContent = avgConsumption.toFixed(2);
  document.getElementById('efficiency').textContent = efficiency.toFixed(2);
  document.getElementById('avg-consumption-day').textContent = avgConsumption.toFixed(2);
  document.getElementById('monthly-consumption').textContent = totalConsumed.toFixed(2);

  const monthName = MONTH_NAMES[parseInt(selectedMonth, 10) - 1];
  document.getElementById('initial-data-title').textContent = `Initial Data for ${monthName} ${selectedYear}`;

  const deliveryRecords = records
    .filter(r => {
      const val = r[config.deliveryKey]?.value;
      return val && val !== '' && !isNaN(val) && Number(val) > 0;
    })
    .map(r => {
      const day = r['Date_Today']?.value ? new Date(r['Date_Today'].value).getDate() : null;
      const amount = r[config.deliveryKey]?.value;
      return { day, amount };
    })
    .filter(r => r.day !== null);

  const deliveryElem = document.getElementById('delivery-date');
  if (deliveryRecords.length) {
    deliveryElem.innerHTML = deliveryRecords
      .map(rec => `${monthName} ${rec.day} — ${rec.amount} Pail`)
      .join('<br>');
  } else {
    deliveryElem.textContent = 'No deliveries recorded';
  }
}

function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
  const labels = [];
  const consumption = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = records.find(r => r['Date_Today']?.value === dateStr);
    labels.push(day.toString());
    consumption.push(rec && rec[config.chart.consumptionKey] ? parseFloat(rec[config.chart.consumptionKey].value) || 0 : 0);
  }

  const ctx = document.getElementById('oilChart');
  if (!ctx) return;

  if (oilChart) oilChart.destroy();

  oilChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Consumption (Liters)',
        data: consumption,
        backgroundColor: 'rgba(59,130,246,0.3)',
        borderColor: 'rgba(59,130,246,1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: 'rgba(59,130,246,1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Daily Oil Consumption - ${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`,
          font: { size: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Consumption (Liters)' }
        },
        x: {
          title: { display: true, text: 'Day of Month' }
        }
      }
    }
  });
}

// Render consumption by machine chart with stacking option
function renderMachineChart(records, config, isStacked = false) {
  const machineData = groupConsumptionByMachine(records, config);
  const machines = Object.keys(machineData).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const ctx = document.getElementById('machineChart');
  if (!ctx) {
    console.error('Machine chart canvas element not found');
    return;
  }
  
  if (machineChart) {
    machineChart.destroy();
  }

  // Generate colors for each machine
  const colors = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 205, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)',
    'rgba(83, 102, 255, 0.8)',
    'rgba(255, 193, 7, 0.8)',
    'rgba(76, 175, 80, 0.8)'
  ];

  let datasets = [];
  let labels = [];
  let chartTitle = 'Oil Consumption by Machine';

  if (isStacked) {
    // Create a single bar with stacked segments for each machine
    labels = ['Total Oil Consumption'];
    
    machines.forEach((machine, index) => {
      const machineLabel = isNaN(machine) ? machine : `Machine ${machine}`;
      const totalConsumption = machineData[machine].totalConsumption;
      
      datasets.push({
        label: machineLabel,
        data: [totalConsumption],
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length].replace('0.8', '1'),
        borderWidth: 1
      });
    });

    chartTitle = 'Stacked Oil Consumption by Machine';
  } else {
    // Regular individual bars
    labels = machines.map(machine => isNaN(machine) ? machine : `Machine ${machine}`);
    const totalConsumptionData = machines.map(machine => machineData[machine].totalConsumption);
    
    datasets = [{
      label: 'Total Oil Consumption (Liters)',
      data: totalConsumptionData,
      backgroundColor: colors.slice(0, machines.length),
      borderColor: colors.slice(0, machines.length).map(color => color.replace('0.8', '1')),
      borderWidth: 2
    }];
  }

  machineChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartTitle,
          font: { size: 16 }
        },
        legend: {
          display: isStacked,
          position: 'top',
          labels: {
            boxWidth: 12,
            fontSize: 12
          }
        },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              if (!isStacked) {
                const machineIndex = context.dataIndex;
                const machine = machines[machineIndex];
                const data = machineData[machine];
                return [
                  `Days of operation: ${data.days}`,
                  `Average per day: ${data.avgConsumption.toFixed(2)} L`
                ];
              }
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: isStacked,
          title: { 
            display: true, 
            text: isStacked ? 'Total Consumption Breakdown' : 'Machines',
            font: { size: 14 }
          }
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          title: { 
            display: true, 
            text: 'Oil Consumption (Liters)',
            font: { size: 14 }
          }
        }
      }
    }
  });
}

async function loadAndRenderData() {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  
  if (!monthSelect || !yearSelect) return;

  const selectedMonth = monthSelect.value;
  const selectedYear = yearSelect.value;
  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory];

  if (!config) return;

  try {
    allRecords = await fetchKintoneAllData(selectedMonth, selectedYear);
    const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    renderTable(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
    renderStats(filteredRecords, config, daysInMonth, selectedMonth, selectedYear);
    
    // Check if machine summary is currently shown to maintain stacking state
    const summaryTable = document.getElementById('machine-summary-table');
    const isStacked = summaryTable && summaryTable.style.display !== 'none';
    
    // Render appropriate chart based on view selection
    const chartView = document.getElementById('chart-view');
    if (chartView && chartView.value === 'machine') {
      renderMachineChart(filteredRecords, config, isStacked);
    } else {
      renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
    }

    // Render machine summary table if it's currently shown
    if (isStacked) {
      renderMachineConsumptionTable(filteredRecords, config);
    }

  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function handleChartViewChange() {
  const chartView = document.getElementById('chart-view');
  const dailyChartContainer = document.getElementById('daily-chart-container');
  const machineChartContainer = document.getElementById('machine-chart-container');

  if (!chartView || !dailyChartContainer || !machineChartContainer) return;

  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory];
  
  if (chartView.value === 'machine') {
    dailyChartContainer.style.display = 'none';
    machineChartContainer.style.display = 'block';
    
    // Check if machine summary is currently shown to maintain stacking state
    const summaryTable = document.getElementById('machine-summary-table');
    const isStacked = summaryTable && summaryTable.style.display !== 'none';
    
    // Render machine chart with current data
    if (config && allRecords.length > 0) {
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderMachineChart(filteredRecords, config, isStacked);
    }
  } else {
    dailyChartContainer.style.display = 'block';
    machineChartContainer.style.display = 'none';
    
    // Render daily chart with current data
    if (config && allRecords.length > 0) {
      const monthSelect = document.getElementById('month-select');
      const yearSelect = document.getElementById('year-select');
      if (monthSelect && yearSelect) {
        const selectedMonth = monthSelect.value;
        const selectedYear = yearSelect.value;
        const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
      }
    }
  }
}

function handleChartTypeChange() {
  const chartType = document.getElementById('chart-type');
  if (!chartType) return;

  // Update chart type and re-render
  if (oilChart) {
    oilChart.config.type = chartType.value;
    oilChart.update();
  }
  
  if (machineChart) {
    machineChart.config.type = chartType.value;
    machineChart.update();
  }
}

function toggleMachineSummaryTable() {
  const summaryTable = document.getElementById('machine-summary-table');
  const toggleBtn = document.getElementById('toggle-machine-summary');
  
  if (!summaryTable || !toggleBtn) return;

  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory];
  
  if (summaryTable.style.display === 'none') {
    summaryTable.style.display = 'block';
    toggleBtn.textContent = 'Hide Machine Summary';
    toggleBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    toggleBtn.classList.add('bg-gray-500', 'hover:bg-gray-600');
    
    // Re-render machine chart with stacked bars
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    if (monthSelect && yearSelect) {
      const selectedMonth = monthSelect.value;
      const selectedYear = yearSelect.value;
      
      // Get filtered records and re-render with stacking
      fetchKintoneAllData(selectedMonth, selectedYear).then(allRecords => {
        const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
        renderMachineChart(filteredRecords, config, true); // Enable stacking
        renderMachineConsumptionTable(filteredRecords, config); // Show summary table
      });
    }
  } else {
    summaryTable.style.display = 'none';
    toggleBtn.textContent = 'Show Machine Summary';
    toggleBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
    toggleBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
    
    // Re-render machine chart without stacking
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    if (monthSelect && yearSelect) {
      const selectedMonth = monthSelect.value;
      const selectedYear = yearSelect.value;
      
      // Get filtered records and re-render without stacking
      fetchKintoneAllData(selectedMonth, selectedYear).then(allRecords => {
        const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
        renderMachineChart(filteredRecords, config, false); // Disable stacking
      });
    }
  }
}

function setupEventHandlers() {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const chartView = document.getElementById('chart-view');
  const chartType = document.getElementById('chart-type');
  const showConsumption = document.getElementById('show-consumption');
  const toggleMachineSummary = document.getElementById('toggle-machine-summary');

  if (monthSelect) monthSelect.addEventListener('change', loadAndRenderData);
  if (yearSelect) yearSelect.addEventListener('change', loadAndRenderData);
  if (chartView) chartView.addEventListener('change', handleChartViewChange);
  if (chartType) chartType.addEventListener('change', handleChartTypeChange);
  if (showConsumption) showConsumption.addEventListener('change', loadAndRenderData);
  if (toggleMachineSummary) toggleMachineSummary.addEventListener('click', toggleMachineSummaryTable);

  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOilToggle = document.getElementById('mobile-oil-toggle');
  const mobileOilSubmenu = document.getElementById('mobile-oil-submenu');
  const mobileArrow = document.getElementById('mobile-arrow');
  
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  if (mobileOilToggle && mobileOilSubmenu && mobileArrow) {
    mobileOilToggle.addEventListener('click', () => {
      mobileOilSubmenu.classList.toggle('hidden');
      mobileArrow.classList.toggle('rotate-180');
    });
  }
}

function initializePage() {
  const now = new Date();
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  
  if (monthSelect) monthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
  if (yearSelect) yearSelect.value = now.getFullYear().toString();

  setupEventHandlers();
  loadAndRenderData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}