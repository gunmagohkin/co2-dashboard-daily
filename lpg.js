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
    chart: {
      consumptionKey: 'Consumed_Tank1',// change here
      runtimeKey: 'Consumed_Tank2',   // change this with data from Production Activity Records
      title: 'Estimate Total vs Runtime'
    },
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
let oilChart;

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
function renderTable(allRecords, daysInMonth, selectedYear, selectedMonth, config) {
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

      if (item.key) {
        const dateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;

        // Pick source category — default is current one
        const sourceCategory = item.category || getCurrentCategory();
        const sourceRecords = filterRecordsByCategory(allRecords, sourceCategory);

        const rec = sourceRecords.find(r => r['Date_Today']?.value === dateStr);
        td.textContent = rec?.[item.key]?.value || '';
      } else {
        td.textContent = ''; // space row
      }
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

  const avgDayElem = document.getElementById('avg-consumption-day');
  if (avgDayElem) avgDayElem.textContent = avgConsumption.toFixed(2);

  const avgDayLabel = document.getElementById('avg-consumption-day-label');
  if (avgDayLabel) avgDayLabel.textContent = "Average consumption / day:";

  const monthlyElem = document.getElementById('monthly-consumption');
  if (monthlyElem) monthlyElem.textContent = totalConsumed.toFixed(2);

  const monthlyLabel = document.getElementById('monthly-consumption-label');
  if (monthlyLabel) monthlyLabel.textContent = "Monthly consumption:";

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
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Consumed Tank 1',
            data: consumption,
            backgroundColor: 'rgba(59,130,246,0.85)',
            borderColor: 'rgba(59,130,246,1)',
            yAxisID: 'y',
          },
          {
            label: 'Consumed Tank 2',
            data: runtime,
            backgroundColor: 'rgba(239,68,68,0.85)',
            borderColor: 'rgba(239,68,68,1)',
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            title: { display: true, text: 'Estimate Total' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Runtime' }
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

  allRecords = await fetchKintoneAllData(selectedMonth, selectedYear);

  renderTable(allRecords, daysInMonth, selectedYear, selectedMonth, config);
  const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
  renderStats(filteredRecords, config, daysInMonth, selectedMonth, selectedYear);
  renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  setupChartControls();

  if (monthSelect && yearSelect) {
    const reload = async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const d = new Date(y, m, 0).getDate();
      allRecords = await fetchKintoneAllData(m, y);
      renderTable(allRecords, d, y, m, config);
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderStats(filteredRecords, config, d, m, y);
      renderChart(filteredRecords, d, y, m, config);
    };
    monthSelect.addEventListener('change', reload);
    yearSelect.addEventListener('change', reload);
  }

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
});