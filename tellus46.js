// Tellus-46 Hydraulic Oil Refill Dashboard with Chart Functionality

let currentChart = null;
let currentRefillData = [];

// Fetch Tellus 46 refill data (all Hydraulic Oil, all months/years)
async function fetchTellus46Data(month, year) {
  const url = '/.netlify/functions/kintone-tellus46';
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch data');
    return [];
  }
  const data = await response.json();
  // console.log('Total rows fetched from backend:', (data.rows || []).length);

  // Filter by selected month and year in frontend
  const selectedMonthStr = String(month).padStart(2, '0');
  return (data.rows || []).filter(row => {
    const date = row.Date?.value;
    return date && date.startsWith(`${year}-${selectedMonthStr}`);
  });
}

// Render refill table
function renderRefillTable(refillRows) {
  const tbody = document.querySelector('#refill-table tbody');
  tbody.innerHTML = '';
  if (!refillRows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-gray-500">No refill data found.</td></tr>`;
    return;
  }
  refillRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-3 py-2">${row.Date?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Time_Refill?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Refill_Qty?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Remaining_Qty?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Refill_by?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Machine_Refilled?.value || '-'}</td>
      <td class="border px-3 py-2">${row.Remarks?.value || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Process data for chart
function processDataForChart(refillRows) {
  const processedData = refillRows.map(row => {
    const date = row.Date?.value || '';
    const refillQty = parseFloat(row.Refill_Qty?.value) || 0;
    // Generate mock runtime data based on refill quantity (for demo purposes)
    // In real implementation, this should come from actual runtime data
    const mockRuntime = refillQty > 0 ? (refillQty * 2.5 + Math.random() * 5) : 0;
    
    return {
      date: date,
      refillQty: refillQty,
      runtime: parseFloat(mockRuntime.toFixed(1)),
      machine: row.Machine_Refilled?.value || 'Unknown'
    };
  }).filter(item => item.date).sort((a, b) => new Date(a.date) - new Date(b.date));

  return processedData;
}

// Create or update chart
function createChart(data) {
  const ctx = document.getElementById('oilChart').getContext('2d');
  
  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
  }

  const chartType = document.getElementById('chart-type').value;
  const showConsumption = document.getElementById('show-consumption').checked;
  const showRuntime = document.getElementById('show-runtime').checked;

  const labels = data.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const datasets = [];

  if (showConsumption) {
    datasets.push({
      label: 'Oil Refilled (L)',
      data: data.map(item => item.refillQty),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      fill: chartType === 'line',
      tension: 0.4,
      yAxisID: 'y'
    });
  }

  if (showRuntime) {
    datasets.push({
      label: 'Machine Runtime (hrs)',
      data: data.map(item => item.runtime),
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: chartType === 'bar' ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      fill: chartType === 'line',
      tension: 0.4,
      yAxisID: 'y1'
    });
  }

  const config = {
    type: chartType,
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: 'Tellus-46 Oil Consumption & Machine Runtime Analysis',
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const dataIndex = context.dataIndex;
              const machine = data[dataIndex]?.machine;
              return machine ? `Machine: ${machine}` : '';
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date'
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        y: {
          type: 'linear',
          display: showConsumption,
          position: 'left',
          title: {
            display: true,
            text: 'Oil Refilled (Liters)',
            color: 'rgb(59, 130, 246)'
          },
          grid: {
            display: true,
            color: 'rgba(59, 130, 246, 0.1)'
          },
          ticks: {
            color: 'rgb(59, 130, 246)'
          }
        },
        y1: {
          type: 'linear',
          display: showRuntime,
          position: 'right',
          title: {
            display: true,
            text: 'Runtime (Hours)',
            color: 'rgb(239, 68, 68)'
          },
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: 'rgb(239, 68, 68)'
          }
        }
      }
    }
  };

  currentChart = new Chart(ctx, config);
}

// Update chart summary statistics
function updateChartSummary(data) {
  const totalConsumed = data.reduce((sum, item) => sum + item.refillQty, 0);
  const totalRuntime = data.reduce((sum, item) => sum + item.runtime, 0);
  const avgConsumption = data.length > 0 ? totalConsumed / data.length : 0;
  const efficiency = totalRuntime > 0 ? totalConsumed / totalRuntime : 0;

  document.getElementById('total-consumed').textContent = totalConsumed.toFixed(2);
  document.getElementById('total-runtime').textContent = totalRuntime.toFixed(2);
  document.getElementById('avg-consumption').textContent = avgConsumption.toFixed(2);
  document.getElementById('efficiency').textContent = efficiency.toFixed(2);
}



// Setup chart controls
function setupChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const showConsumptionCheckbox = document.getElementById('show-consumption');
  const showRuntimeCheckbox = document.getElementById('show-runtime');

  [chartTypeSelect, showConsumptionCheckbox, showRuntimeCheckbox].forEach(control => {
    control.addEventListener('change', () => {
      if (currentRefillData.length > 0) {
        const processedData = processDataForChart(currentRefillData);
        createChart(processedData);
        updateChartSummary(processedData);
      }
    });
  });
}

// Mobile menu functionality
function setupMobileMenu() {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const oilToggle = document.getElementById('mobile-oil-toggle');
  const oilSubmenu = document.getElementById('mobile-oil-submenu');
  const mobileArrow = document.getElementById('mobile-arrow');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  if (oilToggle && oilSubmenu && mobileArrow) {
    oilToggle.addEventListener('click', () => {
      oilSubmenu.classList.toggle('hidden');
      mobileArrow.classList.toggle('rotate-180');
    });
  }
}

// Main data loading and rendering function
async function loadAndRenderData(month, year) {
  const loadingIndicator = document.getElementById('loading-indicator');
  
  try {
    if (loadingIndicator) {
      loadingIndicator.classList.remove('hidden');
    }

    const refillRows = await fetchTellus46Data(month, year);
    currentRefillData = refillRows;

    // Render table
    renderRefillTable(refillRows);

    // Process data for chart and render
    const processedData = processDataForChart(refillRows);
    createChart(processedData);
    updateChartSummary(processedData);

  } catch (error) {
    console.error('Error loading data:', error);
    // Show error message in table
    const tbody = document.querySelector('#refill-table tbody');
    tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-red-500">Error loading data. Please try again.</td></tr>`;
  } finally {
    if (loadingIndicator) {
      loadingIndicator.classList.add('hidden');
    }
  }
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear().toString();

  // Auto-populate year-select with years from 2022 to current year + 1
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

  const selectedMonth = monthSelect ? monthSelect.value : currentMonth;
  const selectedYear = yearSelect ? yearSelect.value : currentYear;

  // Setup controls
  setupChartControls();
  setupMobileMenu();

  // Initial load
  await loadAndRenderData(selectedMonth, selectedYear);

  // Filter on change
  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', async () => {
      await loadAndRenderData(monthSelect.value, yearSelect.value);
    });
    yearSelect.addEventListener('change', async () => {
      await loadAndRenderData(monthSelect.value, yearSelect.value);
    });
  }
});

//