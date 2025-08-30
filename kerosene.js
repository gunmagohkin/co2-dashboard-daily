document.addEventListener('DOMContentLoaded', async () => {
    // Fetches Kintone data for an entire year.
    const fetchKintoneDataForYear = async (year) => {
        try {
            // This URL requests data for the 'Kerosene' category.
            const url = `/.netlify/functions/kintone?year=${year}&category=Kerosene`;
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data from Kintone API for year:', year);
                return [];
            }
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('Error fetching from Netlify function:', error);
            return [];
        }
    };
    
    // --- CONFIG & GLOBAL VARS ---
    const CONFIG_MAP = {
      'Kerosene': [
          { label: 'Stock (L)', key: 'Total_Remaining_Stock_Kerosene' },
          { label: 'Shift/Use (L)', key: 'Shift' },
          { label: 'Press M#', key: 'Press_Machine_No' },
          { label: 'Remarks', key: 'Remarks_Kerosene' }
      ],
    };
    let yearlyRecords = []; 
    let oilChart;

    // --- UTILITY FUNCTIONS ---
    function getCurrentCategory() { return document.getElementById('category-title')?.textContent.trim() || 'Kerosene'; }
    function getCurrentPlant() { return document.getElementById('plant-select')?.value || 'GGPC - Gunma Gohkin'; }
    function filterRecordsByPlant(records, plant) {
        return records.filter(r => r['Plant_Location']?.value === plant);
    }
    // CORRECTED: This function now reliably gets the date from either 'Date_To' or 'Date_Today'.
    const getRecordDate = (record) => record?.Date_To?.value || record?.Date_Today?.value;

    function normalizeKintoneDate(dateValue) {
        return dateValue ? new Date(dateValue).toISOString().split('T')[0] : null;
    }

    // --- TRANSPOSED TABLE RENDERER ---
    function renderTable(records, selectedYear, selectedMonth) {
      const table = document.getElementById('kerosene-table');
      const tableHead = table.querySelector('thead');
      const tableBody = table.querySelector('tbody');
      if (!tableHead || !tableBody) return;

      tableHead.innerHTML = '';
      tableBody.innerHTML = '';
      
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const today = new Date();
      const isCurrentMonth = today.getFullYear() == selectedYear && (today.getMonth() + 1) == selectedMonth;
      const currentDay = today.getDate();

      const headerRow = tableHead.insertRow();
      const thMetric = document.createElement('th');
      thMetric.className = "p-3 text-left bg-gray-100 border-b border-r";
      thMetric.textContent = 'Metric';
      headerRow.appendChild(thMetric);
      
      for (let day = 1; day <= daysInMonth; day++) {
        const thDay = document.createElement('th');
        thDay.className = "p-3 text-center border-b border-r";
        thDay.textContent = day;
        if (isCurrentMonth && day === currentDay) {
          thDay.classList.add('today-col');
        }
        headerRow.appendChild(thDay);
      }

      const category = getCurrentCategory();
      const config = CONFIG_MAP[category] || [];

      config.forEach(metric => {
        const row = tableBody.insertRow();
        const thLabel = document.createElement('th');
        thLabel.className = 'p-3 text-left font-medium text-gray-700 bg-gray-50 border-b border-r';
        thLabel.textContent = metric.label;
        row.appendChild(thLabel);

        for (let day = 1; day <= daysInMonth; day++) {
            const targetDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = records.find(r => normalizeKintoneDate(getRecordDate(r)) === targetDateStr);
            const cell = row.insertCell();
            cell.className = 'p-3 text-center border-b border-r';
            cell.textContent = record?.[metric.key]?.value || '-';
            if (isCurrentMonth && day === currentDay) {
              cell.classList.add('today-col');
            }
        }
      });
    }

    // --- STATS RENDERER (FIXED) ---
    function renderStats(records) {
      const totalUsage = records.reduce((sum, r) => sum + (parseFloat(r.Shift?.value) || 0), 0);
      const daysWithUsage = records.filter(r => r.Shift?.value && parseFloat(r.Shift.value) > 0);
      const avgUsage = daysWithUsage.length > 0 ? totalUsage / daysWithUsage.length : 0;
      
      let latestStock = 0;
      if (records.length > 0) {
          const sortedRecordsWithStock = [...records]
              .filter(r => r.Total_Remaining_Stock_Kerosene?.value)
              .sort((a,b) => new Date(getRecordDate(b)) - new Date(getRecordDate(a))); 
          
          if (sortedRecordsWithStock.length > 0) {
              latestStock = parseFloat(sortedRecordsWithStock[0].Total_Remaining_Stock_Kerosene.value) || 0;
          }
      }

      document.getElementById('total-consumed').textContent = totalUsage.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
      document.getElementById('avg-consumption').textContent = avgUsage.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
      document.getElementById('current-stock-chart').textContent = latestStock.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
      document.getElementById('days-with-data').textContent = daysWithUsage.length;
    }

    // --- CHART RENDERER ---
    function renderChart(records, daysInMonth, selectedYear, selectedMonth) {
      const chartCanvas = document.getElementById('oilChart');
      if (!chartCanvas) return;
      const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
      const usageData = [];
      const stockData = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const targetDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const rec = records.find(r => normalizeKintoneDate(getRecordDate(r)) === targetDateStr);
        usageData.push(rec?.Shift?.value ? parseFloat(rec.Shift.value) : null);
        stockData.push(rec?.Total_Remaining_Stock_Kerosene?.value ? parseFloat(rec.Total_Remaining_Stock_Kerosene.value) : null);
      }
      
      const ctx = chartCanvas.getContext('2d');
      if (oilChart) oilChart.destroy();
      
      oilChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Daily Usage (L)', data: usageData, backgroundColor: '#3B82F6', yAxisID: 'y', order: 2 },
            { label: 'Stock Level (L)', data: stockData, borderColor: '#10B981', backgroundColor: '#10B981', type: 'line', yAxisID: 'y1', tension: 0.3, fill: false, spanGaps: true, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { title: { display: true, text: 'Day of the Month' }, grid: { display: false } },
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Usage (L)' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Stock (L)' } }
          }
        }
      });
    }

    // --- CONTROLS & MAIN LOGIC ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const plantSelect = document.getElementById('plant-select');

    function setupControls() {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear + 1; y >= 2022; y--) { yearSelect.add(new Option(y, y)); }
        yearSelect.value = currentYear.toString();
        monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');
    }

    async function fetchAndRenderData() {
        const year = yearSelect.value;
        yearlyRecords = await fetchKintoneDataForYear(year);
        updateDisplay();
    }

    function updateDisplay() {
        const m = monthSelect.value, y = yearSelect.value, p = plantSelect.value;
        const d = new Date(y, m, 0).getDate();

        const recordsForMonth = yearlyRecords.filter(r => {
            const recordDate = new Date(getRecordDate(r));
            return recordDate.getMonth() + 1 == m;
        });
        
        const filteredRecords = filterRecordsByPlant(recordsForMonth, p);

        renderTable(filteredRecords, y, m);
        renderStats(filteredRecords);
        renderChart(filteredRecords, d, y, m);
    }
    
    yearSelect.addEventListener('change', fetchAndRenderData);
    [monthSelect, plantSelect].forEach(el => el?.addEventListener('change', updateDisplay));

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
        setTimeout(() => {
            const isParentClosed = mobileMenu.style.maxHeight === '' || mobileMenu.style.maxHeight === '0px';
            if (!isParentClosed) { mobileMenu.style.maxHeight = mobileMenu.scrollHeight + "px"; }
        }, 300);
    });
    
    document.querySelectorAll("select").forEach(select => {
        const iconWrapper = select.nextElementSibling;
        if (iconWrapper) {
            select.addEventListener("focus", () => iconWrapper.classList.add("rotate-180"));
            select.addEventListener("blur", () => iconWrapper.classList.remove("rotate-180"));
        }
    });

    lucide.createIcons();
    setupControls();
    await fetchAndRenderData();
});

