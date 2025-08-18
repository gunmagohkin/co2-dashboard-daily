// Global variables
let allRecords = [];
let oilChart;

// --- CONFIG MAP STARTS HERE ---
const CONFIG_MAP = {
  'KEROSENE': {
    table: [
      { label: 'STOCK', key: 'Total_Remaining_Stock_Kerosene' },
      { label: 'SHIFT/USE', key: 'Shift' },
      { label: 'PRESS M#', key: 'Press_Machine_No' },
      { label: 'REMARKS', key: 'Remarks_Kerosene' }
    ],
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
  // console.log("[DEBUG] Fetching from:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[ERROR] Failed to fetch data. Status:', response.status);
      return [];
    }
    const data = await response.json();
    // console.log("[DEBUG] Raw Kintone data:", data);
    return data.records || [];
  } catch (err) {
    console.error("[ERROR] Fetch failed:", err);
    return [];
  }
}

function getCurrentCategory() {
  const categoryHeader = document.getElementById('category-title');
  return categoryHeader ? categoryHeader.textContent.trim() : 'KEROSENE';
}

function filterRecordsByCategory(records, category) {
  const filtered = records.filter(r => r['Consumption_Category']?.value === category);
  if (filtered.length === 0 && records.length > 0) {
    console.warn("[DEBUG] Possible mismatch — check 'Consumption_Category' field values:", records.map(r => r['Consumption_Category']?.value));
  }
  return filtered;
}

// --- DATE NORMALIZER ---
function normalizeKintoneDate(dateValue) {
  if (!dateValue) return null;
  // If it's a full ISO date-time (e.g., "2025-08-11T00:00:00Z")
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  console.warn("[DEBUG] Unknown date format from Kintone:", dateValue);
  return null;
}

// --- TABLE RENDERING ---
function renderTable(records, selectedYear, selectedMonth, config) {
  const tableBody = document.querySelector('tbody');
  if (!tableBody) return;

  // Clear existing rows
  tableBody.innerHTML = '';

  // Calculate days in month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const targetDateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
    const record = records.find(r => normalizeKintoneDate(r['Date_Today']?.value) === targetDateStr);

    const row = document.createElement('tr');
    row.className = 'row-hover';

    // DATE cell
    const dateCell = document.createElement('td');
    dateCell.className = 'border border-gray-300 p-3 text-center text-sm font-medium bg-gray-50';
    dateCell.textContent = day;
    row.appendChild(dateCell);

    // STOCK cell
    const stockCell = document.createElement('td');
    stockCell.className = 'border border-gray-300 p-3 text-center text-sm';
    stockCell.textContent = record?.Total_Remaining_Stock_Kerosene?.value || '';
    row.appendChild(stockCell);

    // SHIFT/USE cell
    const shiftCell = document.createElement('td');
    shiftCell.className = 'border border-gray-300 p-3 text-center text-sm';
    shiftCell.textContent = record?.Shift?.value || '';
    row.appendChild(shiftCell);

    // PRESS M# cell
    const pressCell = document.createElement('td');
    pressCell.className = 'border border-gray-300 p-3 text-center text-sm';
    pressCell.textContent = record?.Press_Machine_No?.value || '';
    row.appendChild(pressCell);

    // REMARKS cell
    const remarksCell = document.createElement('td');
    remarksCell.className = 'border border-gray-300 p-3 text-center text-sm';
    remarksCell.textContent = record?.Remarks_Kerosene?.value || '';
    row.appendChild(remarksCell);

    // Highlight filled rows
    if (record && (record.Total_Remaining_Stock_Kerosene?.value ||
                   record.Shift?.value ||
                   record.Press_Machine_No?.value ||
                   record.Remarks_Kerosene?.value)) {
      row.classList.add('filled-row');
      if (stockCell.textContent) stockCell.className += ' font-medium';
    } else {
      row.classList.remove('filled-row');
    }

    tableBody.appendChild(row);
  }
}

// --- STATS RENDERING ---
function renderStats(records, config, daysInMonth, selectedMonth, selectedYear) {
  const totalUsage = records.reduce((sum, r) => {
    const shiftValue = parseFloat(r.Shift?.value) || 0;
    return sum + shiftValue;
  }, 0);
  
  const daysWithData = records.filter(r => r.Shift?.value && r.Shift.value !== '').length;
  const avgUsage = daysWithData > 0 ? totalUsage / daysWithData : 0;
  
  let currentStock = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].Total_Remaining_Stock_Kerosene?.value) {
      currentStock = parseFloat(records[i].Total_Remaining_Stock_Kerosene.value) || 0;
      break;
    }
  }

  document.getElementById('avg-consumption-day').textContent = avgUsage.toFixed(2);
  document.getElementById('monthly-consumption').textContent = totalUsage.toFixed(2);
  document.getElementById('total-consumed').textContent = totalUsage.toFixed(2);
  document.getElementById('avg-consumption').textContent = avgUsage.toFixed(2);

  const deliveryElem = document.getElementById('delivery-date');
  if (deliveryElem) {
    const stockIncreases = records.filter((r, index) => {
      if (index === 0) return false;
      const currentStock = parseFloat(r.Total_Remaining_Stock_Kerosene?.value) || 0;
      const prevStock = parseFloat(records[index - 1].Total_Remaining_Stock_Kerosene?.value) || 0;
      return currentStock > prevStock;
    });

    if (stockIncreases.length > 0) {
      const monthName = MONTH_NAMES[parseInt(selectedMonth, 10) - 1];
      deliveryElem.innerHTML = stockIncreases
        .map(r => {
          const normDate = normalizeKintoneDate(r['Date_Today']?.value);
          const day = normDate ? parseInt(normDate.split('-')[2], 10) : null;
          const amount = parseFloat(r.Total_Remaining_Stock_Kerosene?.value) || 0;
          return day ? `${monthName} ${day} – Stock: ${amount}L` : null;
        })
        .filter(item => item !== null)
        .join('<br>');
    } else {
      deliveryElem.textContent = 'No deliveries recorded';
    }
  }
}

// --- CHART RENDERING ---
function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
  const chartCanvas = document.getElementById('oilChart');
  if (!chartCanvas) return;

  const labels = [];
  const usage = [];
  const stock = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const targetDateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
    const rec = records.find(r => normalizeKintoneDate(r['Date_Today']?.value) === targetDateStr);
    
    labels.push(day.toString());
    usage.push(rec?.Shift?.value ? parseFloat(rec.Shift.value) || 0 : 0);
    stock.push(rec?.Total_Remaining_Stock_Kerosene?.value ? parseFloat(rec.Total_Remaining_Stock_Kerosene.value) || 0 : 0);
  }

  const ctx = chartCanvas.getContext('2d');
  
  if (oilChart) {
    oilChart.data.labels = labels;
    oilChart.data.datasets[0].data = usage;
    oilChart.data.datasets[1].data = stock;
    oilChart.update();
  } else {
    oilChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Usage',
            data: usage,
            backgroundColor: 'rgba(59,130,246,0.85)',
            borderColor: 'rgba(59,130,246,1)',
            yAxisID: 'y',
          },
          {
            label: 'Stock Level',
            data: stock,
            backgroundColor: 'rgba(34,197,94,0.85)',
            borderColor: 'rgba(34,197,94,1)',
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Kerosene Usage and Stock Levels' } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Usage (L)' } },
          y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Stock (L)' } }
        }
      }
    });
  }
}

function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const showConsumptionCheckbox = document.getElementById('show-consumption');
  const showRuntimeCheckbox = document.getElementById('show-runtime');

  if (!chartTypeSelect || !showConsumptionCheckbox || !showRuntimeCheckbox) return;

  chartTypeSelect.addEventListener('change', () => {
    if (oilChart) {
      oilChart.config.type = chartTypeSelect.value;
      oilChart.update();
    }
  });

  showConsumptionCheckbox.addEventListener('change', () => {
    if (oilChart) {
      oilChart.data.datasets[0].hidden = !showConsumptionCheckbox.checked;
      oilChart.update();
    }
  });

  showRuntimeCheckbox.addEventListener('change', () => {
    if (oilChart) {
      oilChart.data.datasets[1].hidden = !showRuntimeCheckbox.checked;
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
  
  if (monthSelect) monthSelect.value = currentMonth;
  if (yearSelect) yearSelect.value = currentYear;
  
  const selectedMonth = monthSelect ? monthSelect.value : currentMonth;
  const selectedYear = yearSelect ? yearSelect.value : currentYear;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const currentCategory = getCurrentCategory();
  const config = CONFIG_MAP[currentCategory] || CONFIG_MAP['KEROSENE'];

  allRecords = await fetchKintoneAllData(selectedMonth, selectedYear);
  const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);

  renderTable(filteredRecords, selectedYear, selectedMonth, config);
  renderStats(filteredRecords, config, daysInMonth, selectedMonth, selectedYear);
  renderChart(filteredRecords, daysInMonth, selectedYear, selectedMonth, config);
  setupChartControls();

  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const d = new Date(y, m, 0).getDate();
      allRecords = await fetchKintoneAllData(m, y);
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderTable(filteredRecords, y, m, config);
      renderStats(filteredRecords, config, d, m, y);
      renderChart(filteredRecords, d, y, m, config);
    });

    yearSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const d = new Date(y, m, 0).getDate();
      allRecords = await fetchKintoneAllData(m, y);
      const filteredRecords = filterRecordsByCategory(allRecords, currentCategory);
      renderTable(filteredRecords, y, m, config);
      renderStats(filteredRecords, config, d, m, y);
      renderChart(filteredRecords, d, y, m, config);
    });
  }
});
