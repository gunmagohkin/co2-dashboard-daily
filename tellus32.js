// Tellus-32 Hydraulic Oil Refill Dashboard

// Fetch Tellus 32 refill data (all Hydraulic Oil, all months/years)
async function fetchTellus32Data(month, year) {
  const url = '/.netlify/functions/kintone-tellus32';
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch data');
    return [];
  }
  const data = await response.json();
  console.log('Total rows fetched from backend:', (data.rows || []).length);

  // Filter by selected month, year, and Tellus 32 in frontend
  const selectedMonthStr = String(month).padStart(2, '0');
  return (data.rows || []).filter(row => {
    const date = row.Date?.value;
    return (
      date &&
      row.Tellus?.value === "Tellus 32" &&
      date.startsWith(`${year}-${selectedMonthStr}`)
    );
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

  // Initial load
  const refillRows = await fetchTellus32Data(selectedMonth, selectedYear);
  renderRefillTable(refillRows);

  // Filter on change
  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const refillRows = await fetchTellus32Data(m, y);
      renderRefillTable(refillRows);
    });
    yearSelect.addEventListener('change', async () => {
      const m = monthSelect.value;
      const y = yearSelect.value;
      const refillRows = await fetchTellus32Data(m, y);
      renderRefillTable(refillRows);
    });
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