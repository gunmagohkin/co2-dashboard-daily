document.addEventListener('DOMContentLoaded', async () => {

    let currentChart = null;
    let currentRefillData = [];

    // --- KINTONE FETCH FUNCTION ---
    async function fetchTellus32Data(month, year) {
        const url = '/.netlify/functions/kintone-tellus32';
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch data');
                return [];
            }
            const data = await response.json();
            const selectedMonthStr = String(month).padStart(2, '0');
            return (data.rows || []).filter(row => {
                const date = row.Date?.value;
                return (
                  date &&
                  row.Tellus?.value === "Tellus 32" &&
                  date.startsWith(`${year}-${selectedMonthStr}`)
                );
            });
        } catch (error) {
            console.error("Error fetching Tellus 32 data:", error);
            return [];
        }
    }
    
    // --- TABLE RENDERER ---
    function renderRefillTable(refillRows) {
      const tbody = document.querySelector('#refill-table tbody');
      tbody.innerHTML = '';
      if (!refillRows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500">No refill data for this period.</td></tr>`;
        return;
      }
      refillRows.forEach(row => {
        const tr = tbody.insertRow();
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
          <td class="border-b border-gray-200 p-3">${row.Date?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3">${row.Time_Refill?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3 font-semibold text-blue-600">${row.Refill_Qty?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3">${row.Remaining_Qty?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3">${row.Refill_by?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3">${row.Machine_Refilled?.value || '-'}</td>
          <td class="border-b border-gray-200 p-3">${row.Remarks?.value || '-'}</td>
        `;
      });
    }

    // --- CHART DATA PROCESSING ---
    function processDataForChart(refillRows) {
        return refillRows.map(row => {
            const refillQty = parseFloat(row.Refill_Qty?.value) || 0;
            return {
                date: row.Date?.value || '',
                refillQty: refillQty,
                runtime: refillQty > 0 ? (refillQty * 2.5 + Math.random() * 5) : 0, // Mock runtime
                machine: row.Machine_Refilled?.value || 'Unknown'
            };
        }).filter(item => item.date).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // --- CHART RENDERER ---
    function createChart(data) {
        const ctx = document.getElementById('oilChart').getContext('2d');
        if (currentChart) currentChart.destroy();
        
        const labels = data.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const chartType = document.getElementById('chart-type').value || 'bar';

        const oilRefilledDataset = {
            label: 'Oil Refilled (L)',
            data: data.map(item => item.refillQty),
            yAxisID: 'y',
            order: 2,
        };

        const machineRuntimeDataset = {
            label: 'Machine Runtime (hrs)',
            data: data.map(item => item.runtime),
            yAxisID: 'y1',
            order: 1,
        };

        let baseType = 'bar';
        if (chartType === 'line') {
            baseType = 'line';
            // Both are lines
            oilRefilledDataset.type = 'line';
            oilRefilledDataset.borderColor = 'rgba(59, 130, 246, 1)'; // Blue
            oilRefilledDataset.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            oilRefilledDataset.tension = 0.3;

            machineRuntimeDataset.type = 'line';
            machineRuntimeDataset.borderColor = 'rgba(239, 68, 68, 1)'; // Red
            machineRuntimeDataset.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            machineRuntimeDataset.tension = 0.3;
        } else { // 'bar' chart view
            // Oil is bar, runtime is line
            oilRefilledDataset.type = 'bar';
            oilRefilledDataset.backgroundColor = 'rgba(59, 130, 246, 0.7)'; // Blue bar

            machineRuntimeDataset.type = 'line';
            machineRuntimeDataset.borderColor = 'rgba(239, 68, 68, 1)'; // Red line
            machineRuntimeDataset.backgroundColor = 'rgba(239, 68, 68, 1)'; 
            machineRuntimeDataset.tension = 0.3;
        }

        currentChart = new Chart(ctx, {
            type: baseType,
            data: {
            labels: labels,
            datasets: [oilRefilledDataset, machineRuntimeDataset]
            },
            options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: { display: false },
                legend: { position: 'top' },
                tooltip: {
                callbacks: {
                    afterLabel: context => `Machine: ${data[context.dataIndex]?.machine || 'N/A'}`
                }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Date' } },
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Oil Refilled (Liters)' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Runtime (Hours)' } }
            }
            }
        });
    }


    // --- STATS RENDERER ---
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

    // --- MAIN LOGIC ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const plantSelect = document.getElementById('plant-select');
    const chartTypeSelect = document.getElementById('chart-type');

    function setupControls() {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear + 1; y >= 2022; y--) { yearSelect.add(new Option(y, y)); }
        yearSelect.value = currentYear.toString();
        monthSelect.value = String(currentDate.getMonth() + 1).padStart(2, '0');
    }

    async function loadAndRenderData() {
        const month = monthSelect.value;
        const year = yearSelect.value;
        
        currentRefillData = await fetchTellus32Data(month, year);
        renderRefillTable(currentRefillData);
        const processedData = processDataForChart(currentRefillData);
        createChart(processedData);
        updateChartSummary(processedData);
    }
    
    [monthSelect, yearSelect, plantSelect].forEach(el => el?.addEventListener('change', loadAndRenderData));

    chartTypeSelect.addEventListener('change', () => {
        if(currentRefillData.length > 0) {
            const processedData = processDataForChart(currentRefillData);
            createChart(processedData);
        }
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
    await loadAndRenderData();
});