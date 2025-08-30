
document.addEventListener('DOMContentLoaded', async () => {

    const fetchKintoneAllData = async (month, year) => {
        try {
            const url = `/.netlify/functions/kintone?month=${month}&year=${year}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data from Kintone API');
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
      'KEROSENE': {
        table: [
          { label: 'STOCK', key: 'Total_Remaining_Stock_Kerosene' },
          { label: 'SHIFT/USE', key: 'Shift' },
          { label: 'PRESS M#', key: 'Press_Machine_No' },
          { label: 'REMARKS', key: 'Remarks_Kerosene' }
        ],
      }
    };
    let allRecords = [];
    let oilChart;

    // --- UTILITY FUNCTIONS ---
    function getCurrentCategory() { return document.getElementById('category-title')?.textContent.trim() || 'KEROSENE'; }
    function getCurrentPlant() { return document.getElementById('plant-select')?.value || 'GGPC - Gunma Gohkin'; }
    function filterRecordsByCategory(records, category, plant) {
        return records.filter(r => r['Consumption_Category']?.value === category && r['Plant_Location']?.value === plant);
    }
    function normalizeKintoneDate(dateValue) {
        if (!dateValue) return null;
        const d = new Date(dateValue);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }
        return null;
    }

    // --- TABLE RENDERER ---
    function renderTable(records, selectedYear, selectedMonth) {
      const tableBody = document.querySelector('#kerosene-table tbody');
      if (!tableBody) return;
      tableBody.innerHTML = '';
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const targetDateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const record = records.find(r => normalizeKintoneDate(r['Date_Today']?.value) === targetDateStr);
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-50';

        const dateCell = row.insertCell();
        dateCell.className = 'border-b border-gray-200 p-3 text-center text-sm font-medium';
        dateCell.textContent = day;

        const stockCell = row.insertCell();
        stockCell.className = 'border-b border-gray-200 p-3 text-center text-sm';
        stockCell.textContent = record?.Total_Remaining_Stock_Kerosene?.value || '-';
        row.appendChild(stockCell);

        const shiftCell = row.insertCell();
        shiftCell.className = 'border-b border-gray-200 p-3 text-center text-sm';
        shiftCell.textContent = record?.Shift?.value || '-';
        row.appendChild(shiftCell);

        const pressCell = row.insertCell();
        pressCell.className = 'border-b border-gray-200 p-3 text-center text-sm';
        pressCell.textContent = record?.Press_Machine_No?.value || '-';
        row.appendChild(pressCell);

        const remarksCell = row.insertCell();
        remarksCell.className = 'border-b border-gray-200 p-3 text-center text-sm';
        remarksCell.textContent = record?.Remarks_Kerosene?.value || '-';
        row.appendChild(remarksCell);

        if (record && (record.Total_Remaining_Stock_Kerosene?.value || record.Shift?.value)) {
          row.classList.add('filled-row');
        }
      }
    }

    // --- STATS RENDERER ---
    function renderStats(records) {
      const totalUsage = records.reduce((sum, r) => sum + (parseFloat(r.Shift?.value) || 0), 0);
      const daysWithData = records.filter(r => r.Shift?.value && parseFloat(r.Shift.value) > 0).length;
      const avgUsage = daysWithData > 0 ? totalUsage / daysWithData : 0;
      let currentStock = 0;
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].Total_Remaining_Stock_Kerosene?.value) {
          currentStock = parseFloat(records[i].Total_Remaining_Stock_Kerosene.value) || 0;
          break;
        }
      }
      document.getElementById('total-consumed').textContent = totalUsage.toFixed(2);
      document.getElementById('avg-consumption').textContent = avgUsage.toFixed(2);
      document.getElementById('current-stock-chart').textContent = currentStock.toFixed(2);
      document.getElementById('days-with-data').textContent = daysWithData;
    }

    // --- CHART RENDERER ---
    function renderChart(records, daysInMonth, selectedYear, selectedMonth) {
      const chartCanvas = document.getElementById('oilChart');
      if (!chartCanvas) return;
      const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
      const usage = [];
      const stock = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const targetDateStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const rec = records.find(r => normalizeKintoneDate(r['Date_Today']?.value) === targetDateStr);
        usage.push(rec?.Shift?.value ? parseFloat(rec.Shift.value) || 0 : null);
        stock.push(rec?.Total_Remaining_Stock_Kerosene?.value ? parseFloat(rec.Total_Remaining_Stock_Kerosene.value) || 0 : null);
      }
      
      const ctx = chartCanvas.getContext('2d');
      if (oilChart) oilChart.destroy();
      
      oilChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Daily Usage (L)', data: usage, backgroundColor: '#3B82F6', yAxisID: 'y', order: 2 },
            { label: 'Stock Level (L)', data: stock, borderColor: '#10B981', backgroundColor: '#10B981', type: 'line', yAxisID: 'y1', tension: 0.3, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { title: { display: false } },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { title: { display: true, text: 'Day of the Month' } },
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

    async function updateData() {
        const m = monthSelect.value, y = yearSelect.value, p = plantSelect.value;
        const d = new Date(y, m, 0).getDate();
        const category = getCurrentCategory();
        
        allRecords = await fetchKintoneAllData(m, y);
        const filteredRecords = filterRecordsByCategory(allRecords, category, p);

        renderTable(filteredRecords, y, m);
        renderStats(filteredRecords);
        renderChart(filteredRecords, d, y, m);
    }
    
    [monthSelect, yearSelect, plantSelect].forEach(el => el?.addEventListener('change', updateData));

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
    await updateData();
});