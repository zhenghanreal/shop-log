'use strict';

const STORAGE_KEY = 'orderRecords_v1';
let records = [];
let editingRecordId = null;

const dom = {
  tabListBtn: document.getElementById('tabListBtn'),
  tabStatsBtn: document.getElementById('tabStatsBtn'),
  listView: document.getElementById('listView'),
  statsView: document.getElementById('statsView'),
  openAddModalBtn: document.getElementById('openAddModalBtn'),
  openFilterModalBtn: document.getElementById('openFilterModalBtn'),
  entryModal: document.getElementById('entryModal'),
  filterModal: document.getElementById('filterModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  closeFilterModalBtn: document.getElementById('closeFilterModalBtn'),
  applyFilterBtn: document.getElementById('applyFilterBtn'),
  recordForm: document.getElementById('recordForm'),
  formTitle: document.getElementById('formTitle'),
  submitBtn: document.getElementById('submitBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  productName: document.getElementById('productName'),
  vendor: document.getElementById('vendor'),
  deposit: document.getElementById('deposit'),
  tailPayment: document.getElementById('tailPayment'),
  discount: document.getElementById('discount'),
  totalPrice: document.getElementById('totalPrice'),
  orderDate: document.getElementById('orderDate'),
  arrivalDate: document.getElementById('arrivalDate'),
  paymentStatus: document.getElementById('paymentStatus'),
  searchName: document.getElementById('searchName'),
  searchVendor: document.getElementById('searchVendor'),
  statusFilter: document.getElementById('statusFilter'),
  resetFilterBtn: document.getElementById('resetFilterBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importInput: document.getElementById('importInput'),
  clearBtn: document.getElementById('clearBtn'),
  recordList: document.getElementById('recordList'),
  emptyState: document.getElementById('emptyState'),
  filterSummary: document.getElementById('filterSummary'),
  statUnpaidDeposit: document.getElementById('statUnpaidDeposit'),
  statUnpaidTail: document.getElementById('statUnpaidTail'),
  statSpent: document.getElementById('statSpent'),
  statTotal: document.getElementById('statTotal')
};

init();

function init() {
  loadRecords();
  bindEvents();
  updateTotalPreview();
  switchView('list');
  renderAll();
  registerServiceWorker();
}

function bindEvents() {
  dom.tabListBtn.addEventListener('click', function () {
    switchView('list');
  });
  dom.tabStatsBtn.addEventListener('click', function () {
    switchView('stats');
  });

  dom.openAddModalBtn.addEventListener('click', openAddModal);
  dom.openFilterModalBtn.addEventListener('click', openFilterModal);
  dom.closeModalBtn.addEventListener('click', closeModal);
  dom.closeFilterModalBtn.addEventListener('click', closeFilterModal);
  dom.applyFilterBtn.addEventListener('click', applyFilters);

  dom.entryModal.addEventListener('click', function (event) {
    if (event.target === dom.entryModal) {
      closeModal();
    }
  });
  dom.filterModal.addEventListener('click', function (event) {
    if (event.target === dom.filterModal) {
      closeFilterModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    if (!dom.filterModal.classList.contains('hidden')) {
      closeFilterModal();
      return;
    }

    if (!dom.entryModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  dom.recordForm.addEventListener('submit', handleFormSubmit);
  dom.cancelEditBtn.addEventListener('click', exitEditMode);

  [dom.deposit, dom.tailPayment, dom.discount].forEach(function (input) {
    input.addEventListener('input', updateTotalPreview);
  });

  dom.resetFilterBtn.addEventListener('click', resetFilters);
  dom.exportBtn.addEventListener('click', exportRecords);
  dom.importBtn.addEventListener('click', function () {
    dom.importInput.click();
  });
  dom.importInput.addEventListener('change', importRecords);
  dom.clearBtn.addEventListener('click', clearAllRecords);

  // 列表按钮使用事件委托，避免每次渲染都重复绑定。
  dom.recordList.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'edit') {
      enterEditMode(id);
    }
    if (action === 'delete') {
      deleteRecord(id);
    }
  });
}

function switchView(view) {
  const showList = view === 'list';

  dom.listView.classList.toggle('hidden', !showList);
  dom.statsView.classList.toggle('hidden', showList);
  dom.tabListBtn.classList.toggle('active', showList);
  dom.tabStatsBtn.classList.toggle('active', !showList);
}

function openAddModal() {
  resetFormForAdd();
  showModal();
}

function openFilterModal() {
  dom.filterModal.classList.remove('hidden');
  updateModalBodyState();
}

function showModal() {
  dom.entryModal.classList.remove('hidden');
  updateModalBodyState();
  setTimeout(function () {
    dom.productName.focus();
  }, 0);
}

function closeModal() {
  dom.entryModal.classList.add('hidden');
  updateModalBodyState();
  resetFormForAdd();
}

function closeFilterModal() {
  dom.filterModal.classList.add('hidden');
  updateModalBodyState();
}

function applyFilters() {
  renderList();
  closeFilterModal();
}

function updateModalBodyState() {
  const hasOpenModal =
    !dom.entryModal.classList.contains('hidden') ||
    !dom.filterModal.classList.contains('hidden');
  document.body.classList.toggle('modal-open', hasOpenModal);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('Service Worker 注册失败：', error);
    });
  });
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      records = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      records = [];
      return;
    }

    records = parsed.map(normalizeRecord).filter(Boolean);
  } catch (error) {
    console.warn('读取本地数据失败，已自动重置为空：', error);
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeNumber(value) {
  const numberValue = Number.parseFloat(value);
  if (!Number.isFinite(numberValue)) return 0;
  if (numberValue < 0) return 0;
  return roundMoney(numberValue);
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const deposit = normalizeNumber(raw.deposit);
  const tailPayment = normalizeNumber(raw.tailPayment);
  const discount = normalizeNumber(raw.discount);
  const totalPrice = calculateTotalPrice(deposit, tailPayment, discount);

  return {
    id: String(raw.id || createRecordId()),
    productName: String(raw.productName || '').trim(),
    vendor: String(raw.vendor || '').trim(),
    deposit: deposit,
    tailPayment: tailPayment,
    discount: discount,
    totalPrice: totalPrice,
    orderDate: normalizeDate(raw.orderDate),
    arrivalDate: normalizeDate(raw.arrivalDate),
    paymentStatus: raw.paymentStatus === '已补' ? '已补' : '未补',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function normalizeDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateTotalPrice(deposit, tailPayment, discount) {
  return roundMoney(normalizeNumber(deposit) + normalizeNumber(tailPayment) - normalizeNumber(discount));
}

function formatMoney(value) {
  return '¥' + Number(value || 0).toFixed(2);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateTotalPreview() {
  const deposit = normalizeNumber(dom.deposit.value);
  const tailPayment = normalizeNumber(dom.tailPayment.value);
  const discount = normalizeNumber(dom.discount.value);
  const total = calculateTotalPrice(deposit, tailPayment, discount);
  dom.totalPrice.value = total.toFixed(2);
}

function handleFormSubmit(event) {
  event.preventDefault();

  const productName = dom.productName.value.trim();
  const vendor = dom.vendor.value.trim();
  if (!productName || !vendor) {
    alert('商品名称和厂商为必填项。');
    return;
  }

  const deposit = normalizeNumber(dom.deposit.value);
  const tailPayment = normalizeNumber(dom.tailPayment.value);
  const discount = normalizeNumber(dom.discount.value);
  const totalPrice = calculateTotalPrice(deposit, tailPayment, discount);

  const data = {
    productName: productName,
    vendor: vendor,
    deposit: deposit,
    tailPayment: tailPayment,
    discount: discount,
    totalPrice: totalPrice,
    orderDate: normalizeDate(dom.orderDate.value),
    arrivalDate: normalizeDate(dom.arrivalDate.value),
    paymentStatus: dom.paymentStatus.value === '已补' ? '已补' : '未补'
  };

  if (editingRecordId) {
    const index = records.findIndex(function (item) {
      return item.id === editingRecordId;
    });

    if (index === -1) {
      alert('未找到要编辑的条目，已退出编辑模式。');
      resetFormForAdd();
      return;
    }

    records[index] = {
      ...records[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
  } else {
    records.push({
      id: createRecordId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveRecords();
  renderAll();
  closeModal();
}

function createRecordId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function enterEditMode(id) {
  const target = records.find(function (item) {
    return item.id === id;
  });
  if (!target) return;

  editingRecordId = target.id;
  dom.formTitle.textContent = '编辑条目';
  dom.submitBtn.textContent = '保存修改';
  dom.cancelEditBtn.classList.remove('hidden');

  dom.productName.value = target.productName;
  dom.vendor.value = target.vendor;
  dom.deposit.value = target.deposit;
  dom.tailPayment.value = target.tailPayment;
  dom.discount.value = target.discount;
  dom.orderDate.value = target.orderDate;
  dom.arrivalDate.value = target.arrivalDate;
  dom.paymentStatus.value = target.paymentStatus;
  updateTotalPreview();

  showModal();
}

function resetFormForAdd() {
  editingRecordId = null;
  dom.formTitle.textContent = '新增条目';
  dom.submitBtn.textContent = '新增条目';
  dom.cancelEditBtn.classList.add('hidden');
  dom.recordForm.reset();
  dom.deposit.value = '0';
  dom.tailPayment.value = '0';
  dom.discount.value = '0';
  dom.paymentStatus.value = '未补';
  updateTotalPreview();
}

function exitEditMode() {
  resetFormForAdd();
}

function deleteRecord(id) {
  const target = records.find(function (item) {
    return item.id === id;
  });
  if (!target) return;

  const confirmed = confirm('确认删除条目：' + target.productName + ' ?');
  if (!confirmed) return;

  records = records.filter(function (item) {
    return item.id !== id;
  });

  saveRecords();
  renderAll();
}

function getFilteredRecords() {
  const nameKeyword = dom.searchName.value.trim().toLowerCase();
  const vendorKeyword = dom.searchVendor.value.trim().toLowerCase();
  const statusValue = dom.statusFilter.value;

  return getSortedRecords().filter(function (record) {
    const matchName = !nameKeyword || record.productName.toLowerCase().includes(nameKeyword);
    const matchVendor = !vendorKeyword || record.vendor.toLowerCase().includes(vendorKeyword);
    const matchStatus = statusValue === '全部' || record.paymentStatus === statusValue;
    return matchName && matchVendor && matchStatus;
  });
}

function getSortedRecords() {
  return records.slice().sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function renderAll() {
  renderStats();
  renderList();
}

function renderStats() {
  let unpaidDeposit = 0;
  let unpaidTail = 0;
  let spent = 0;
  let total = 0;

  records.forEach(function (record) {
    total += record.totalPrice;

    if (record.paymentStatus === '未补') {
      unpaidDeposit += record.deposit;
      unpaidTail += record.tailPayment;

      const currentSpent = Math.max(record.deposit - record.discount, 0);
      spent += currentSpent;
    } else {
      spent += record.totalPrice;
    }
  });

  unpaidDeposit = Math.max(unpaidDeposit, 0);
  unpaidTail = Math.max(unpaidTail, 0);
  spent = Math.max(spent, 0);
  total = Math.max(total, 0);

  dom.statUnpaidDeposit.textContent = formatMoney(unpaidDeposit);
  dom.statUnpaidTail.textContent = formatMoney(unpaidTail);
  dom.statSpent.textContent = formatMoney(spent);
  dom.statTotal.textContent = formatMoney(total);
}

function renderList() {
  const list = getFilteredRecords();
  updateFilterSummary();

  dom.recordList.innerHTML = '';
  dom.emptyState.style.display = list.length ? 'none' : 'block';

  if (!list.length) return;

  list.forEach(function (record) {
    const statusClass = record.paymentStatus === '已补' ? 'paid' : 'unpaid';

    const card = document.createElement('article');
    card.className = 'record-card';
    card.innerHTML = `
      <div class="record-top">
        <div>
          <h3 class="record-title">${escapeHtml(record.productName)}</h3>
          <p class="record-vendor">厂商：${escapeHtml(record.vendor)}</p>
        </div>
        <span class="status-tag ${statusClass}">${escapeHtml(record.paymentStatus)}</span>
      </div>

      <div class="record-grid">
        <div class="record-item"><small>订金</small><span>${formatMoney(record.deposit)}</span></div>
        <div class="record-item"><small>补款</small><span>${formatMoney(record.tailPayment)}</span></div>
        <div class="record-item"><small>优惠</small><span>${formatMoney(record.discount)}</span></div>
        <div class="record-item"><small>总价</small><span>${formatMoney(record.totalPrice)}</span></div>
        <div class="record-item"><small>订购日期</small><span>${escapeHtml(record.orderDate || '-')}</span></div>
        <div class="record-item"><small>入手日期</small><span>${escapeHtml(record.arrivalDate || '-')}</span></div>
      </div>

      <div class="record-actions">
        <button type="button" class="btn secondary" data-action="edit" data-id="${record.id}">编辑</button>
        <button type="button" class="btn danger" data-action="delete" data-id="${record.id}">删除</button>
      </div>
    `;

    dom.recordList.appendChild(card);
  });
}

function resetFilters() {
  dom.searchName.value = '';
  dom.searchVendor.value = '';
  dom.statusFilter.value = '全部';
  renderList();
}

function updateFilterSummary() {
  const nameKeyword = dom.searchName.value.trim();
  const vendorKeyword = dom.searchVendor.value.trim();
  const statusValue = dom.statusFilter.value;
  const parts = [];

  if (nameKeyword) parts.push('商品名称=' + nameKeyword);
  if (vendorKeyword) parts.push('厂商=' + vendorKeyword);
  if (statusValue !== '全部') parts.push('状态=' + statusValue);

  dom.filterSummary.textContent = parts.length
    ? '当前筛选：' + parts.join('，')
    : '当前筛选：全部条目';
}

function exportRecords() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const fileName = [
    'order-records-',
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    '.json'
  ].join('');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function importRecords(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const firstConfirm = confirm('导入会覆盖当前全部条目，是否继续？');
  if (!firstConfirm) {
    dom.importInput.value = '';
    return;
  }

  file.text()
    .then(function (text) {
      const parsed = JSON.parse(text);
      const imported = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(imported)) {
        throw new Error('JSON 格式不正确：未找到 records 数组');
      }

      const normalized = imported.map(normalizeRecord).filter(Boolean);
      records = normalized;
      saveRecords();
      renderAll();
      closeModal();
      alert('导入完成，共导入 ' + normalized.length + ' 条条目。');
    })
    .catch(function (error) {
      alert('导入失败：' + error.message);
    })
    .finally(function () {
      dom.importInput.value = '';
    });
}

function clearAllRecords() {
  if (!records.length) {
    alert('当前没有可清空的条目。');
    return;
  }

  const firstConfirm = confirm('确认清空全部条目？此操作不可撤销。');
  if (!firstConfirm) return;

  const secondConfirm = confirm('请再次确认：真的要清空全部条目吗？');
  if (!secondConfirm) return;

  records = [];
  saveRecords();
  renderAll();
  closeModal();
}
