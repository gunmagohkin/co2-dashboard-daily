//main.js
// Global variables
let allRecords = [];
let oilChart;
let machineChart;

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
    machineKey: 'Machine_ID' // Add this field to identify machines
  }
};
// --- CONFIG MAP ENDS HERE ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
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

function filterRecordsByCategory(records, category) {
  return records.filter(r => r['Consumption_Category']?.value === category);
}

function filterRecordsByPlant(records, plant) {
  return records.filter(r => r['Plant_Location']?.value === plant);
}

// Combined filter function for category and plant
function filterRecords(records, category, plant) {
  return records.filter(r => 
    r['Consumption_Category']?.value === category && 
    r['Plant_Location']?.value === plant
  );
}

// --- MACHINE CONSUMPTION FUNCTIONS ---
// Group consumption data by machine number
function groupConsumptionByMachine(records, config) {
  const machineData = {};
  
  records.forEach(record => {
    // Get machine number/identifier from Machine_Run field
    const machineId = record[config.chart.runtimeKey]?.value || 'Unknown';
    const consumption = parseFloat(record[config.chart.consumptionKey]?.value) || 0;
    
    // Skip if no consumption data
    if (consumption === 0) return;
    
    if (!machineData[machineId]) {
      machineData[machineId] = {
        totalConsumption: 0,
        days: 0,
        avgConsumption: 0
      };
    }
    
    machineData[machineId].totalConsumption += consumption;
    machineData[machineId].days += 1;
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

// --- TABLE RENDERING ---
function renderTable(records, daysInMonth, selectedYear, selectedMonth, config) {
  const table = document.getElementById('daily-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const headerRow = table.querySelector('thead tr');

  // Clear headers except first
  while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);

  // Add day headers
  for (let day = 1; day <= daysInMonth; day++) {
    const th = document.createElement('th');
    th.className = 'border border-gray-300 px-2 py-1 font-semibold text-gray-700 text-xs whitespace-nowrap';
    th.textContent = day.toString();
    headerRow.appendChild(th);
  }

  // Clear data cells except first column
  Array.from(tbody.querySelectorAll('tr')).forEach(row => {
    while (row.children.length > 1) row.removeChild(row.lastChild);
  });

  // Fill rows
  config.table.forEach((item, rowIdx) => {
    const row = tbody.children[rowIdx];
    for (let day = 1; day <= daysInMonth; day++) {
      const td = document.createElement('td');
      td.className = 'border border-gray-300 px-2 py-1 text-xs';
      const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
      const rec = records.find(r => r['Date_Today']?.value === dateStr);
      td.textContent = rec && rec[item.key] && rec[item.key].value !== '' ? rec[item.key].value : '-';
      row.appendChild(td);
    }
  });
}

// --- STATS RENDERING ---
function renderStats(records, config, daysInMonth, selectedMonth, selectedYear) {
  const totalConsumed = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.consumptionKey]?.value) || 0), 0);
  const totalRuntime = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.runtimeKey]?.value) || 0), 0);
  const avgConsumption = daysInMonth ? totalConsumed / daysInMonth : 0;
  const efficiency = totalRuntime ? totalConsumed / totalRuntime : 0;

  const totalElem = document.getElementById('total-consumed');
  if (totalElem) totalElem.textContent = totalConsumed.toFixed(2);

  const runtimeElem = document.getElementById('total-runtime');
  if (runtimeElem) runtimeElem.textContent = totalRuntime.toFixed(2);

  const avgElem = document.getElementById('avg-consumption');
  if (avgElem) avgElem.textContent = avgConsumption.toFixed(2);

  const effElem = document.getElementById('efficiency');
  if (effElem) effElem.textContent = efficiency.toFixed(2);

  // Fill in average consumption/day and monthly consumption with labels
  const avgDayElem = document.getElementById('avg-consumption-day');
  if (avgDayElem) avgDayElem.textContent = avgConsumption.toFixed(2);

  const avgDayLabel = document.getElementById('avg-consumption-day-label');
  if (avgDayLabel) avgDayLabel.textContent = "Average consumption / day:";

  const monthlyElem = document.getElementById('monthly-consumption');
  if (monthlyElem) monthlyElem.textContent = totalConsumed.toFixed(2);

  const monthlyLabel = document.getElementById('monthly-consumption-label');
  if (monthlyLabel) monthlyLabel.textContent = "Monthly consumption:";

  // Delivery date and amount
  const deliveryElem = document.getElementById('delivery-date');
  if (deliveryElem) {
    const deliveryRecords = records
      .filter(r => {
        const val = r[config.deliveryKey]?.value;
        return val && val !== '' && !isNaN(val) && Number(val) > 0;
      })
      .map(r => {
        const day = r['Date_Today']?.value
          ? new Date(r['Date_Today'].value).getDate()
          : null;
        const amount = r[config.deliveryKey]?.value;
        return { day, amount };
      })
      .filter(r => r.day !== null);

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

// --- DAILY CONSUMPTION CHART RENDERING ---
function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
  const labels = [];
  const consumption = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
    const rec = records.find(r => r['Date_Today']?.value === dateStr);
    labels.push(day.toString());
    consumption.push(
      rec && rec[config.chart.consumptionKey]
        ? parseFloat(rec[config.chart.consumptionKey].value) || 0
        : 0
    );
  }

  const ctx = document.getElementById('oilChart').getContext('2d');
  if (oilChart) {
    oilChart.data.labels = labels;
    oilChart.data.datasets = [{
      label: 'Total Consumption (Liters)',
      data: consumption,
      backgroundColor: 'rgba(59,130,246,0.3)',
      borderColor: 'rgba(59,130,246,1)',
      borderWidth: 2,
      tension: 0.3,
      fill: true
    }];
    oilChart.options.plugins.title.text = 'Daily Total Consumption';
    oilChart.options.scales = {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Liters' }
      }
    };
    oilChart.update();
  } else {
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
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Daily Total Consumption'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Liters' }
          }
        }
      }
    });
  }
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

  const ctx = document.getElementById('machineChart').getContext('2d');
  
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
    const avgConsumptionData = machines.map(machine => machineData[machine].avgConsumption);
    const daysData = machines.map(machine => machineData[machine].days);
    
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

// --- CHART CONTROLS ---
function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const showConsumption = document.getElementById('show-consumption');
  const chartViewSelect = document.getElementById('chart-view');

  if (!chartTypeSelect || !showConsumption) return;

  // Remove previous event listeners by cloning nodes
  const chartTypeClone = chartTypeSelect.cloneNode(true);
  chartTypeSelect.parentNode.replaceChild(chartTypeClone, chartTypeSelect);

  const showConsumptionClone = showConsumption.cloneNode(true);
  showConsumption.parentNode.replaceChild(showConsumptionClone, showConsumption);

  // Chart type change
  chartTypeClone.addEventListener('change', () => {
    if (oilChart) {
      oilChart.config.type = chartTypeClone.value;
      oilChart.update();
    }
  });

  // Toggle Total Consumption visibility
  showConsumptionClone.addEventListener('change', () => {
    if (oilChart && oilChart.data.datasets[0]) {
      oilChart.data.datasets[0].hidden = !showConsumptionClone.checked;
      oilChart.update();
    }
  });

  // Chart view toggle (daily vs machine)
  if (chartViewSelect) {
    const chartViewClone = chartViewSelect.cloneNode(true);
    chartViewSelect.parentNode.replaceChild(chartViewClone, chartViewSelect);
    
    chartViewClone.addEventListener('change', () => {
      const dailyChart = document.getElementById('daily-chart-container');
      const machineChartContainer = document.getElementById('machine-chart-container');
      
      if (chartViewClone.value === 'daily') {
        dailyChart.style.display = 'block';
        machineChartContainer.style.display = 'none';
      } else {
        dailyChart.style.display = 'none';
        machineChartContainer.style.display = 'block';
      }
    });
  }

  // Machine summary table toggle button with stacked chart toggle
  const summaryToggleBtn = document.getElementById('toggle-machine-summary');
  if (summaryToggleBtn) {
    const summaryToggleClone = summaryToggleBtn.cloneNode(true);
    summaryToggleBtn.parentNode.replaceChild(summaryToggleClone, summaryToggleBtn);
    
    summaryToggleClone.addEventListener('click', () => {
      const summaryTable = document.getElementById('machine-summary-table');
      const currentCategory = getCurrentCategory();
      const currentPlant = getCurrentPlant();
      const config = CONFIG_MAP[currentCategory] || CONFIG_MAP[Object.keys(CONFIG_MAP)[0]];
      
      if (summaryTable.style.display === 'none') {
        summaryTable.style.display = 'block';
        summaryToggleClone.textContent = 'Hide Machine Summary';
        summaryToggleClone.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        summaryToggleClone.classList.add('bg-gray-500', 'hover:bg-gray-600');
        
        // Re-render machine chart with stacked bars
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        if (monthSelect && yearSelect) {
          const selectedMonth = monthSelect.value;
          const selectedYear = yearSelect.value;
          
          // Get filtered records and re-render with stacking
          fetchKintoneAllData(selectedMonth, selectedYear).then(allRecords => {
            const filteredRecords = filterRecords(allRecords, currentCategory, currentPlant);
            renderMachineChart(filteredRecords, config, true); // Enable stacking
          });
        }
      } else {
        summaryTable.style.display = 'none';
        summaryToggleClone.textContent = 'Show Machine Summary';
        summaryToggleClone.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        summaryToggleClone.classList.add('bg-blue-500', 'hover:bg-blue-600');
        
        // Re-render machine chart without stacking
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        if (monthSelect && yearSelect) {
          const selectedMonth = monthSelect.value;
          const selectedYear = yearSelect.value;
          
          // Get filtered records and re-render without stacking
          fetchKintoneAllData(selectedMonth, selectedYear).then(allRecords => {
            const filteredRecords = filterRecords(allRecords, currentCategory, currentPlant);
            renderMachineChart(filteredRecords, config, false); // Disable stacking
          });
        }
      }
    });
  }
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const plantSelect = document.getElementById('plant-select');
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear().toString();

  // Auto-populate year-select
  if (yearSelect) {
    yearSelect.innerHTML = '';
    const startYear = 2022;
    const endYear = currentDate.getFullYear() + 1;
    for (let y = endYear; y >= startYear; y--) {
      const option = document.createElement('option');
      option.value = y.toString();
      option.textContent = y.toString();
      yearSelect.appendChild(option);
    }
    yearSelect.value = currentYear;
  }

  // Set month-select to current month
  if (monthSelect) {
    monthSelect.value = currentMonth;
  }

  // Set default plant selection
  if (plantSelect) {
    plantSelect.value = 'GGPC - Gunma Gohkin'; // Default to GGPCss
  }

  const selectedMonth = monthSelect ? monthSelect.value : currentMonth;
  const selectedYear = yearSelect ? yearSelect.value : currentYear;
  const selectedPlant = plantSelect ? plantSelect.value : 'GGPC - Gunma Gohkin';
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory] || CONFIG_MAP[Object.keys(CONFIG_MAP)[0]];

  // Initial data load
  const allRecords = await fetchKintoneAllData(selectedMonth, selectedYear);
  const filteredRecords = filterRecords(allRecords, currentCategory, selectedPlant);

  renderTable(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  renderStats(filteredRecords, config, daysInMonth, selectedMonth, selectedYear);
  renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  renderMachineChart(filteredRecords, config, false); // Start with normal chart (not stacked)
  renderMachineConsumptionTable(filteredRecords, config);
  setupChartControls();

  // Event listeners for month/year/plant changes
  const updateData = async () => {
    const m = monthSelect.value;
    const y = yearSelect.value;
    const p = plantSelect.value;
    const d = new Date(y, m, 0).getDate();
    const allRecords = await fetchKintoneAllData(m, y);
    const filteredRecords = filterRecords(allRecords, currentCategory, p);
    
    // Check if machine summary is currently shown to maintain stacking state
    const summaryTable = document.getElementById('machine-summary-table');
    const isStacked = summaryTable && summaryTable.style.display !== 'none';
    
    renderTable(filteredRecords, d, y, m, config);
    renderStats(filteredRecords, config, d, m, y);
    renderChart(filteredRecords, d, y, m, config);
    renderMachineChart(filteredRecords, config, isStacked); // Maintain current stacking state
    renderMachineConsumptionTable(filteredRecords, config);
  };

  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', updateData);
    yearSelect.addEventListener('change', updateData);
  }

  // Add event listener for plant selection change
  if (plantSelect) {
    plantSelect.addEventListener('change', updateData);
  }
});

// Mobile menu functionality
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  const oilToggle = document.getElementById('mobile-oil-toggle');
  const oilSubmenu = document.getElementById('mobile-oil-submenu');
  const oilArrow = document.getElementById('mobile-arrow');

  if (oilToggle && oilSubmenu && oilArrow) {
    oilToggle.addEventListener('click', () => {
      oilSubmenu.classList.toggle('hidden');
    });
  }
});