
document.addEventListener('DOMContentLoaded', async () => {
    // --- MOCK DATA FUNCTION (FOR DEMO) ---
    const fetchMockData = (month, year) => {
        const records = [];
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const isOperatingDay = Math.random() > 0.3; // 70% chance of operating
            if (isOperatingDay) {
                records.push({
                    "Date_Today": { "value": `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` },
                    "Consumption_Category": { "value": "PL-1000" },
                    "Plant_Location": { "value": "GGPC - Gunma Gohkin" },
                    "Total_Consumed_PL": { "value": (Math.random() * 15).toFixed(2) },
                    "Machine_Run_PL": { "value": (Math.floor(Math.random() * 3) + 1).toString() },
                    "Remaining_Stock_PL": { "value": (80 - day * 1.5).toFixed(2) },
                    "Delivery_PL": { "value": (day % 12 === 0) ? '1' : '0' },
                    "Refill_PL": { "value": (day % 6 === 0) ? '1' : '0' },
                    "Total_Stock_PL_Pail": { "value": '4' },
                    "Total_Stock_PL_Lit": { "value": '80' }
                });
            }
        }
        return { records };
    };
    
    // --- KINTONE FETCH FUNCTION ---
    const fetchKintoneAllData = async (month, year) => {
        try {
            const url = `/.netlify/functions/kintone?month=${month}&year=${year}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data from Kintone API');
                return fetchMockData(month, year).records;
            }
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('Error fetching from Netlify function:', error);
            return fetchMockData(month, year).records;
        }
    };
  
  // Global variables
  let allRecords = [];
  let oilChart;
  let machineChart;
  let currentTimeframe = 'daily';

  // CONFIG MAP
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

  // UTILITY FUNCTIONS
  function getCurrentCategory() {
    return document.getElementById('category-title')?.textContent.trim() || Object.keys(CONFIG_MAP)[0];
  }

  function getCurrentPlant() {
    return document.getElementById('plant-select')?.value || 'GGPC - Gunma Gohkin';
  }

  function filterRecords(records, category, plant) {
    return records.filter(r => 
      r['Consumption_Category']?.value === category && 
      r['Plant_Location']?.value === plant
    );
  }

  // TABLE RENDERING
  function renderTable(records, daysInMonth, selectedYear, selectedMonth, config) {
    const table = document.getElementById('daily-table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    const headerRow = table.querySelector('thead tr');

    while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
    for (let day = 1; day <= daysInMonth; day++) {
      const th = document.createElement('th');
      th.className = 'border-b border-gray-200 px-2 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap';
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
        td.className = row.children[0].className.replace('font-semibold text-gray-800 text-left', 'text-center');
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const rec = records.find(r => r['Date_Today']?.value === dateStr);
        td.textContent = rec?.[item.key]?.value || '-';
        row.appendChild(td);
      }
    });
  }

  // STATS RENDERING
  function renderStats(records, config, daysInMonth, selectedMonth, selectedYear) {
    const totalConsumed = records.reduce((sum, r) => sum + (parseFloat(r[config.chart.consumptionKey]?.value) || 0), 0);
    const operatingDays = records.filter(r => (r[config.chart.runtimeKey]?.value || '').trim() !== '' && parseFloat(r[config.chart.consumptionKey]?.value) > 0).length;
    const avgConsumption = operatingDays > 0 ? totalConsumed / operatingDays : 0;
    const totalDeliveries = records.reduce((sum, r) => sum + (parseFloat(r[config.deliveryKey]?.value) || 0), 0);

    document.getElementById('total-consumed').textContent = totalConsumed.toFixed(2);
    document.getElementById('efficiency').textContent = avgConsumption.toFixed(2);
    document.getElementById('total-deliveries').textContent = totalDeliveries;
    
    document.getElementById('avg-consumption-day').textContent = avgConsumption.toFixed(2);
    document.getElementById('monthly-consumption').textContent = totalConsumed.toFixed(2);

    const deliveryElem = document.getElementById('delivery-date');
    if (deliveryElem) {
      const deliveryRecords = records.filter(r => Number(r[config.deliveryKey]?.value) > 0).map(r => ({ day: new Date(r['Date_Today'].value).getDate(), amount: r[config.deliveryKey]?.value }));
      if (deliveryRecords.length) {
        const monthName = MONTH_NAMES[parseInt(selectedMonth, 10) - 1];
        deliveryElem.innerHTML = deliveryRecords.map(rec => `${monthName} ${rec.day} – <strong>${rec.amount} Pail(s)</strong>`).join('<br>');
      } else {
        deliveryElem.textContent = 'No deliveries this month.';
      }
    }
  }

  // CHART RENDERING
  function renderChart(records, daysInMonth, selectedYear, selectedMonth, config) {
    let labels = [], consumptionData = [];
    const chartTitle = document.getElementById('chart-main-title');

    if (currentTimeframe === 'weekly') {
      const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config);
      labels = weeklyAggregates.map(w => `Week ${w.week}`);
      consumptionData = weeklyAggregates.map(w => w.totalConsumption);
      chartTitle.textContent = 'Weekly Oil Consumption Analysis';
    } else {
      labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      consumptionData = labels.map(day => {
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rec = records.find(r => r['Date_Today']?.value === dateStr);
          return parseFloat(rec?.[config.chart.consumptionKey]?.value) || 0;
      });
      chartTitle.textContent = 'Daily Oil Consumption Analysis';
    }
      
    const ctx = document.getElementById('oilChart').getContext('2d');
    const chartType = document.getElementById('chart-type')?.value || 'line';

    if (oilChart) oilChart.destroy();
    
    oilChart = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Consumption (Liters)',
          data: consumptionData,
          backgroundColor: 'rgba(59,130,246,0.2)',
          borderColor: 'rgba(59,130,246,1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: 'rgba(59,130,246,1)',
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: currentTimeframe === 'weekly' ? 'Total Weekly Consumption' : 'Daily Total Consumption' } },
        scales: {
          x: { title: { display: true, text: currentTimeframe === 'weekly' ? 'Week of the Month' : 'Day of the Month' } },
          y: { beginAtZero: true, title: { display: true, text: 'Liters' } }
        }
      }
    });
  }

  // DATA AGGREGATION
  function aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config) {
    const weeklyData = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const week = Math.ceil(day / 7);
      if (!weeklyData[week]) weeklyData[week] = { totalConsumption: 0, machineOperatingDays: 0, totalDelivery: 0, totalRefills: 0 };
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = records.find(r => r['Date_Today']?.value === dateStr);
      if(rec){
        const dailyConsumption = parseFloat(rec[config.chart.consumptionKey]?.value) || 0;
        if ((rec[config.chart.runtimeKey]?.value || '').trim() !== '' && dailyConsumption > 0) weeklyData[week].machineOperatingDays++;
        weeklyData[week].totalConsumption += dailyConsumption;
        weeklyData[week].totalDelivery += parseFloat(rec[config.deliveryKey]?.value) || 0;
        weeklyData[week].totalRefills += parseFloat(rec['Refill_PL']?.value) || 0;
      }
    }
    return Object.entries(weeklyData).map(([week, data]) => ({ week, ...data }));
  }

  function renderWeeklySummaryTable(records, daysInMonth, selectedYear, selectedMonth, config) {
    const container = document.getElementById('weekly-summary-container');
    if (!container) return;
    const weeklyAggregates = aggregateDataByWeek(records, daysInMonth, selectedYear, selectedMonth, config);
    let tableHTML = `<h2 class="text-lg font-bold mb-4">Weekly Summary</h2><div class="overflow-x-auto border border-gray-200 rounded-lg shadow-sm custom-scroll"><table class="min-w-full text-sm text-left">
      <thead class="bg-gray-50"><tr>
        <th class="px-4 py-2 font-semibold">Week</th><th class="px-4 py-2 font-semibold">Total Consumed (L)</th><th class="px-4 py-2 font-semibold">Operating Days</th><th class="px-4 py-2 font-semibold">Avg. L/Day</th><th class="px-4 py-2 font-semibold">Deliveries</th><th class="px-4 py-2 font-semibold">Refills</th>
      </tr></thead><tbody>`;
    weeklyAggregates.forEach(w => {
      const efficiency = w.machineOperatingDays > 0 ? w.totalConsumption / w.machineOperatingDays : 0;
      tableHTML += `<tr class="border-t hover:bg-gray-50">
        <td class="px-4 py-2 font-bold">Week ${w.week}</td><td class="px-4 py-2">${w.totalConsumption.toFixed(2)}</td><td class="px-4 py-2">${w.machineOperatingDays}</td><td class="px-4 py-2">${efficiency.toFixed(2)}</td><td class="px-4 py-2">${w.totalDelivery}</td><td class="px-4 py-2">${w.totalRefills}</td>
      </tr>`;
    });
    container.innerHTML = tableHTML + `</tbody></table></div>`;
  }

  // MACHINE CONSUMPTION
  function groupConsumptionByMachine(records, config) {
      const machineData = {};
      records.forEach(record => {
          const machineId = record[config.chart.runtimeKey]?.value || 'Unknown';
          const consumption = parseFloat(record[config.chart.consumptionKey]?.value) || 0;
          if (consumption === 0) return;
          if (!machineData[machineId]) machineData[machineId] = { totalConsumption: 0, days: 0 };
          machineData[machineId].totalConsumption += consumption;
          machineData[machineId].days++;
      });
      return machineData;
  }
  
  function renderMachineChart(records, config) {
      const machineData = groupConsumptionByMachine(records, config);
      const machines = Object.keys(machineData).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const ctx = document.getElementById('machineChart').getContext('2d');
      if (machineChart) machineChart.destroy();
      machineChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: machines.map(m => isNaN(m) ? m : `Machine ${m}`),
              datasets: [{
                  label: 'Total Oil Consumption (Liters)',
                  data: machines.map(m => machineData[m].totalConsumption),
                  backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1']
              }]
          },
          options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: {display: false}, title: { display: true, text: 'Oil Consumption by Machine', font: { size: 16 } } },
              scales: { y: { beginAtZero: true, title: { display: true, text: 'Oil Consumption (Liters)' } } }
          }
      });
  }

  function renderMachineConsumptionTable(records, config) {
      const tableContainer = document.getElementById('machine-summary-table');
      if (!tableContainer) return;
      const machineData = groupConsumptionByMachine(records, config);
      const machines = Object.keys(machineData).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const grandTotal = machines.reduce((sum, machine) => sum + machineData[machine].totalConsumption, 0);
      let tableHTML = `<div class="bg-white p-6 rounded-lg shadow-md border"><h3 class="text-lg font-bold mb-4">Machine Consumption Summary</h3><div class="overflow-x-auto custom-scroll"><table class="min-w-full text-sm">
          <thead class="bg-gray-50"><tr>
              <th class="px-4 py-2 font-semibold text-left">Machine</th><th class="px-4 py-2 font-semibold text-right">Total (L)</th><th class="px-4 py-2 font-semibold text-center">Days</th><th class="px-4 py-2 font-semibold text-right">Avg/Day (L)</th><th class="px-4 py-2 font-semibold text-right">% of Total</th>
          </tr></thead><tbody>`;
      machines.forEach(machine => {
          const data = machineData[machine];
          const percentage = grandTotal > 0 ? (data.totalConsumption / grandTotal * 100) : 0;
          tableHTML += `<tr class="border-t hover:bg-gray-50">
              <td class="px-4 py-2 font-medium">${isNaN(machine) ? machine : `Machine ${machine}`}</td>
              <td class="px-4 py-2 text-right font-bold text-blue-600">${data.totalConsumption.toFixed(2)}</td>
              <td class="px-4 py-2 text-center">${data.days}</td>
              <td class="px-4 py-2 text-right">${(data.totalConsumption/data.days).toFixed(2)}</td>
              <td class="px-4 py-2 text-right">${percentage.toFixed(1)}%</td>
          </tr>`;
      });
      tableHTML += `</tbody><tfoot class="bg-gray-100 font-bold border-t-2"><tr >
          <td class="px-4 py-2">TOTAL</td><td class="px-4 py-2 text-right text-green-600">${grandTotal.toFixed(2)}</td><td colspan="3"></td>
      </tr></tfoot></table></div></div>`;
      tableContainer.innerHTML = tableHTML;
  }

  // CONTROLS
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const plantSelect = document.getElementById('plant-select');
  const chartTypeSelect = document.getElementById('chart-type');
  const chartViewSelect = document.getElementById('chart-view');
  const timeframeBtn = document.getElementById('timeframe-toggle-btn');

  function setupControls() {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      for (let y = currentYear + 1; y >= 2022; y--) {
        yearSelect.add(new Option(y, y));
      }
      yearSelect.value = currentYear.toString();
      monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');
  }

  async function updateData() {
    const m = monthSelect.value, y = yearSelect.value;
    const d = new Date(y, m, 0).getDate();
    const category = getCurrentCategory(), plant = getCurrentPlant();
    const config = CONFIG_MAP[category] || {};
    
    allRecords = await fetchKintoneAllData(m, y);
    const filteredRecords = filterRecords(allRecords, category, plant);

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
    
    renderTable(filteredRecords, d, y, m, config);
    renderWeeklySummaryTable(filteredRecords, d, y, m, config);
    renderStats(filteredRecords, config, d, m, y);
    renderChart(filteredRecords, d, y, m, config);
    renderMachineChart(filteredRecords, config);
    renderMachineConsumptionTable(filteredRecords, config);
  }

  [monthSelect, yearSelect, plantSelect, chartTypeSelect, chartViewSelect].forEach(el => el?.addEventListener('change', () => {
      const dailyChart = document.getElementById('daily-chart-container');
      const machineChartContainer = document.getElementById('machine-chart-container');
      if (chartViewSelect.value === 'daily') {
          dailyChart.style.display = 'block';
          machineChartContainer.style.display = 'none';
      } else {
          dailyChart.style.display = 'none';
          machineChartContainer.style.display = 'block';
      }
      updateData();
  }));
  
  timeframeBtn.addEventListener('click', () => {
    currentTimeframe = (currentTimeframe === 'daily') ? 'weekly' : 'daily';
    updateData();
  });

  const summaryToggleBtn = document.getElementById('toggle-machine-summary');
  summaryToggleBtn.addEventListener('click', () => {
    const summaryTable = document.getElementById('machine-summary-table');
    const isHidden = summaryTable.style.display === 'none';
    summaryTable.style.display = isHidden ? 'block' : 'none';
    summaryToggleBtn.textContent = isHidden ? 'Hide Machine Summary' : 'Show Machine Summary';
    
    // Correctly toggle between blue (active) and gray (inactive) states
    summaryToggleBtn.classList.toggle('bg-gray-500', isHidden);
    summaryToggleBtn.classList.toggle('hover:bg-gray-600', isHidden);
    summaryToggleBtn.classList.toggle('bg-blue-500', !isHidden);
    summaryToggleBtn.classList.toggle('hover:bg-blue-600', !isHidden);
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
    // Adjust parent menu height
    setTimeout(() => {
        const isParentClosed = mobileMenu.style.maxHeight === '' || mobileMenu.style.maxHeight === '0px';
        if (!isParentClosed) {
            mobileMenu.style.maxHeight = mobileMenu.scrollHeight + "px";
        }
    }, 300);
  });
  
  // Dropdown icon animations
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