// Global variables
let allRecords = [];
let oilChart;

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
      title: 'PL-1000 Oil Consumption vs Machine Runtime'
    },
    deliveryKey: 'Delivery_PL'
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

function filterRecordsByCategory(records, category) {
  return records.filter(r => r['Consumption_Category']?.value === category);
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

  // Delivery date and amount (e.g., July 1 - 15 Pail)
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

  // records: your array of data
  // config.deliveryKey: the key for the delivery field (e.g., 'Delivery_EP')

  const deliveryRecords = records.filter(r => {
    const val = r[config.deliveryKey]?.value;
    return val && val !== '' && !isNaN(val);
  });

  // deliveryRecords now contains all records with a delivery
  console.log(deliveryRecords);
}

// --- CHART RENDERING ---
function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
  const labels = [];
  const consumption = [];
  const runtime = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
    const rec = records.find(r => r['Date_Today']?.value === dateStr);
    labels.push(day.toString());
    consumption.push(rec && rec[config.chart.consumptionKey] ? parseFloat(rec[config.chart.consumptionKey].value) || 0 : 0);
    runtime.push(rec && rec[config.chart.runtimeKey] ? parseFloat(rec[config.chart.runtimeKey].value) || 0 : 0);
  }

  const ctx = document.getElementById('oilChart').getContext('2d');
  if (oilChart) {
    oilChart.data.labels = labels;
    oilChart.data.datasets[0].data = consumption;
    oilChart.data.datasets[1].data = runtime;
    oilChart.options.plugins.title.text = config.chart.title;
    oilChart.update();
  } else {
    oilChart = new Chart(ctx, {
      type: 'line', // Default to line chart
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Consumption',
            data: consumption,
            backgroundColor: 'rgba(59,130,246,0.85)', // bright blue
            borderColor: 'rgba(59,130,246,1)', // bright blue
            yAxisID: 'y',
          },
          {
            label: 'Machine Runtime',
            data: runtime,
            backgroundColor: 'rgba(239,68,68,0.85)', // bright red
            borderColor: 'rgba(239,68,68,1)', // bright red
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Important for layout!
        plugins: {
          title: {
            display: true,
            text: config.chart.title
          }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Consumption (L)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Runtime (hrs)' }
          }
        }
      }
    });
  }
}

// --- CHART CONTROLS ---
function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const showConsumption = document.getElementById('show-consumption');
  const showRuntime = document.getElementById('show-runtime');

  if (!chartTypeSelect || !showConsumption || !showRuntime) return;

  // Remove previous event listeners by cloning and replacing nodes
  const chartTypeClone = chartTypeSelect.cloneNode(true);
  chartTypeSelect.parentNode.replaceChild(chartTypeClone, chartTypeSelect);

  const showConsumptionClone = showConsumption.cloneNode(true);
  showConsumption.parentNode.replaceChild(showConsumptionClone, showConsumption);

  const showRuntimeClone = showRuntime.cloneNode(true);
  showRuntime.parentNode.replaceChild(showRuntimeClone, showRuntime);

  chartTypeClone.addEventListener('change', () => {
    if (oilChart) {
      oilChart.config.type = chartTypeClone.value;
      oilChart.update();
    }
  });

  showConsumptionClone.addEventListener('change', () => {
    if (oilChart && oilChart.data.datasets[0]) {
      oilChart.data.datasets[0].hidden = !showConsumptionClone.checked;
      oilChart.update();
    }
  });

  showRuntimeClone.addEventListener('change', () => {
    if (oilChart && oilChart.data.datasets[1]) {
      oilChart.data.datasets[1].hidden = !showRuntimeClone.checked;
      oilChart.update();
    }
  });
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear().toString();

  // --- Auto-populate year-select with years from 2022 to current year + 1 ---
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

  // --- Set month-select to current month ---
  if (monthSelect) {
    monthSelect.value = currentMonth;
  }

  const selectedMonth = monthSelect ? monthSelect.value : currentMonth;
  const selectedYear = yearSelect ? yearSelect.value : currentYear;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory] || CONFIG_MAP[Object.keys(CONFIG_MAP)[0]];

  const allRecords = await fetchKintoneAllData(selectedMonth, selectedYear);
  const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);

  renderTable(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  renderStats(filteredRecords, config, daysInMonth, selectedMonth, selectedYear);
  renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  setupChartControls();

  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const d = new Date(y, m, 0).getDate();
      const allRecords = await fetchKintoneAllData(m, y);
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderTable(filteredRecords, d, y, m, config);
      renderStats(filteredRecords, config, d, m, y);
      renderChart(filteredRecords, d, y, m, config);
    });

    yearSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const d = new Date(y, m, 0).getDate();
      const allRecords = await fetchKintoneAllData(m, y);
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderTable(filteredRecords, d, y, m, config);
      renderStats(filteredRecords, config, d, m, y);
      renderChart(filteredRecords, d, y, m, config);
    });
  }
});


  // Toggle mobile menu visibility
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });

  // Mobile Oil submenu toggle
  const oilToggle = document.getElementById('mobile-oil-toggle');
  const oilSubmenu = document.getElementById('mobile-oil-submenu');
  const oilArrow = document.getElementById('mobile-arrow');

  oilToggle.addEventListener('click', () => {
    oilSubmenu.classList.toggle('hidden');
    oilArrow.classList.toggle('rotate-180');
  });