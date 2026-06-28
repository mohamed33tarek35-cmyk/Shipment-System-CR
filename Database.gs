/**
 * ============================================
 * Database.gs - إدارة قاعدة البيانات (Google Sheets)
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة قاعدة البيانات:
 * - إنشاء الأوراق تلقائياً
 * - CRUD Operations
 * - Batch Operations للأداء
 * - Schema Management
 * - Data Validation
 */

// ============================================
// تهيئة قاعدة البيانات
// ============================================

/**
 * تهيئة النظام بالكامل - تُستدعى مرة واحدة عند أول تشغيل
 * @returns {Object} نتيجة التهيئة
 */
function initializeSystem() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // التحقق من التهيئة السابقة
    const isInitialized = propGet(PROPERTIES_KEYS.SYSTEM_INITIALIZED);
    if (isInitialized === 'true') {
      return successResponse(null, 'النظام مُهيأ مسبقاً');
    }
    
    // إنشاء جميع الأوراق
    createAllSheets(ss);
    
    // إضافة البيانات الافتراضية
    initializeDefaultData();
    
    // تسجيل التهيئة
    propPut(PROPERTIES_KEYS.SYSTEM_INITIALIZED, 'true');
    propPut(PROPERTIES_KEYS.SESSION_SECRET, generateSalt() + generateSalt());
    
    logAction('SYSTEM_INITIALIZED', 'System', { timestamp: getCurrentDateTime() });
    
    return successResponse(null, 'تم تهيئة النظام بنجاح');
    
  } catch (e) {
    logError('Initialize System Error', { error: e.message, stack: e.stack });
    return errorResponse('فشل في تهيئة النظام: ' + e.message);
  }
}

/**
 * إنشاء جميع أوراق النظام
 * @param {Spreadsheet} ss - ملف Google Sheets
 */
function createAllSheets(ss) {
  const sheetConfigs = [
    { name: SHEET_NAMES.EMPLOYEES, headers: SHEET_HEADERS.EMPLOYEES },
    { name: SHEET_NAMES.ROLES, headers: SHEET_HEADERS.ROLES },
    { name: SHEET_NAMES.PERMISSIONS, headers: SHEET_HEADERS.PERMISSIONS },
    { name: SHEET_NAMES.SHIPMENTS, headers: SHEET_HEADERS.SHIPMENTS },
    { name: SHEET_NAMES.HISTORY, headers: SHEET_HEADERS.HISTORY },
    { name: SHEET_NAMES.ASSIGNMENTS, headers: SHEET_HEADERS.ASSIGNMENTS },
    { name: SHEET_NAMES.SETTINGS, headers: SHEET_HEADERS.SETTINGS },
    { name: SHEET_NAMES.LOGS, headers: SHEET_HEADERS.LOGS },
    { name: SHEET_NAMES.NOTIFICATIONS, headers: SHEET_HEADERS.NOTIFICATIONS },
    { name: SHEET_NAMES.ARCHIVE, headers: SHEET_HEADERS.ARCHIVE }
  ];
  
  for (let i = 0; i < sheetConfigs.length; i++) {
    const config = sheetConfigs[i];
    let sheet = ss.getSheetByName(config.name);
    
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      // إضافة Headers
      const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
      headerRange.setValues([config.headers]);
      
      // تنسيق Headers
      headerRange.setFontWeight('bold')
        .setBackground('#1976D2')
        .setFontColor('#FFFFFF')
        .setHorizontalAlignment('center');
      
      // تجميد الصف الأول
      sheet.setFrozenRows(1);
      
      // تفعيل الفلتر
      sheet.getRange(1, 1, 1, config.headers.length).createFilter();
      
      // ضبط عرض الأعمدة
      for (let j = 0; j < config.headers.length; j++) {
        sheet.setColumnWidth(j + 1, Math.max(120, config.headers[j].length * 12));
      }
    }
  }
  
  // إخفاء ورقة Logs من العرض العادي
  const logsSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
  if (logsSheet) {
    logsSheet.hideSheet();
  }
}

/**
 * تهيئة البيانات الافتراضية
 */
function initializeDefaultData() {
  // إضافة الصلاحيات
  initializePermissions();
  
  // إضافة الأدوار
  initializeRoles();
  
  // إضافة الإعدادات الافتراضية
  initializeSettings();
  
  // إنشاء Admin افتراضي إذا لم يكن موجوداً
  initializeDefaultAdmin();
}

/**
 * إضافة الصلاحيات الافتراضية
 */
function initializePermissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PERMISSIONS);
  if (!sheet) return;
  
  const existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) return; // موجودة مسبقاً
  
  const permissions = DEFAULT_PERMISSIONS;
  const rows = [];
  
  for (let i = 0; i < permissions.length; i++) {
    const perm = permissions[i];
    rows.push([
      generateId('PERM'),
      perm.key,
      perm.name,
      perm.description || '',
      perm.category,
      getCurrentDateTime()
    ]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * إضافة الأدوار الافتراضية
 */
function initializeRoles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ROLES);
  if (!sheet) return;
  
  const existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) return;
  
  const roles = DEFAULT_ROLES;
  const rows = [];
  
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const permissions = DEFAULT_ROLE_PERMISSIONS[role.key] || [];
    
    rows.push([
      role.id,
      role.name,
      role.key,
      JSON.stringify(permissions),
      role.description,
      getCurrentDateTime(),
      getCurrentDateTime()
    ]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * إضافة الإعدادات الافتراضية
 */
function initializeSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return;
  
  const existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) return;
  
  const settings = Object.keys(DEFAULT_SETTINGS);
  const rows = [];
  
  for (let i = 0; i < settings.length; i++) {
    const key = settings[i];
    rows.push([
      key,
      DEFAULT_SETTINGS[key],
      getCurrentDateTime(),
      'System'
    ]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * إنشاء Admin افتراضي
 */
function initializeDefaultAdmin() {
  const adminExists = propGet(PROPERTIES_KEYS.ADMIN_CREATED);
  if (adminExists === 'true') return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  if (!sheet) return;
  
  const salt = generateSalt();
  const password = 'admin123'; // يجب تغييره فوراً
  const hash = hashPassword(password, salt);
  
  const adminData = [
    generateId('EMP'),
    'admin',
    hash,
    salt,
    'مدير النظام',
    'admin@system.com',
    '',
    'SYSTEM_ADMIN',
    JSON.stringify(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ADMIN),
    'true',
    '',
    getCurrentDateTime(),
    getCurrentDateTime()
  ];
  
  sheet.appendRow(adminData);
  propPut(PROPERTIES_KEYS.ADMIN_CREATED, 'true');
  
  logAction('DEFAULT_ADMIN_CREATED', 'System', { 
    username: 'admin',
    note: 'يجب تغيير كلمة المرور الافتراضية فوراً'
  });
}

// ============================================
// دوال CRUD الأساسية
// ============================================

/**
 * الحصول على بيانات ورقة كاملة
 * @param {string} sheetName - اسم الورقة
 * @param {boolean} useCache - استخدام الـ Cache
 * @returns {Array} البيانات
 */
function getSheetData(sheetName, useCache) {
  const cacheKey = CACHE_KEYS[sheetName.toUpperCase() + '_DATA'] || 'data_' + sheetName;
  
  if (useCache !== false) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      logError('Sheet Not Found', { sheetName: sheetName });
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    
    // تخزين في Cache
    if (useCache !== false) {
      cachePut(cacheKey, data);
    }
    
    return data;
    
  } catch (e) {
    logError('Get Sheet Data Error', { sheetName: sheetName, error: e.message });
    return [];
  }
}

/**
 * الحصول على بيانات ككائنات
 * @param {string} sheetName - اسم الورقة
 * @param {boolean} useCache - استخدام الـ Cache
 * @returns {Array} الكائنات
 */
function getSheetDataAsObjects(sheetName, useCache) {
  const data = getSheetData(sheetName, useCache);
  if (data.length < 2) return [];
  
  const headers = data[0];
  const objects = [];
  
  for (let i = 1; i < data.length; i++) {
    objects.push(rowToObject(headers, data[i]));
  }
  
  return objects;
}

/**
 * إضافة صف جديد
 * @param {string} sheetName - اسم الورقة
 * @param {Object} data - البيانات
 * @returns {Object} النتيجة
 */
function insertRow(sheetName, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة: ' + sheetName);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = objectToRow(headers, data);
    
    sheet.appendRow(row);
    
    // تحديث Cache
    cacheRemove('data_' + sheetName);
    
    return successResponse({ id: data.ID }, 'تمت الإضافة بنجاح');
    
  } catch (e) {
    logError('Insert Row Error', { sheetName: sheetName, error: e.message });
    return errorResponse('فشل في الإضافة: ' + e.message);
  }
}

/**
 * تحديث صف
 * @param {string} sheetName - اسم الورقة
 * @param {string} idColumn - عمود المعرف
 * @param {string} id - المعرف
 * @param {Object} data - البيانات الجديدة
 * @returns {Object} النتيجة
 */
function updateRow(sheetName, idColumn, id, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة: ' + sheetName);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColIndex = headers.indexOf(idColumn);
    
    if (idColIndex === -1) {
      return errorResponse('عمود المعرف غير موجود');
    }
    
    const allData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idColIndex] === id) {
        rowIndex = i + 1; // +1 لأن الصفوف تبدأ من 1
        break;
      }
    }
    
    if (rowIndex === -1) {
      return errorResponse('السجل غير موجود');
    }
    
    // تحديث البيانات
    const row = objectToRow(headers, data);
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    
    // تحديث Cache
    cacheRemove('data_' + sheetName);
    
    return successResponse({ id: id }, 'تم التحديث بنجاح');
    
  } catch (e) {
    logError('Update Row Error', { sheetName: sheetName, id: id, error: e.message });
    return errorResponse('فشل في التحديث: ' + e.message);
  }
}

/**
 * حذف صف
 * @param {string} sheetName - اسم الورقة
 * @param {string} idColumn - عمود المعرف
 * @param {string} id - المعرف
 * @returns {Object} النتيجة
 */
function deleteRow(sheetName, idColumn, id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة: ' + sheetName);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColIndex = headers.indexOf(idColumn);
    
    if (idColIndex === -1) {
      return errorResponse('عمود المعرف غير موجود');
    }
    
    const allData = sheet.getDataRange().getValues();
    
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idColIndex] === id) {
        sheet.deleteRow(i + 1);
        
        // تحديث Cache
        cacheRemove('data_' + sheetName);
        
        return successResponse(null, 'تم الحذف بنجاح');
      }
    }
    
    return errorResponse('السجل غير موجود');
    
  } catch (e) {
    logError('Delete Row Error', { sheetName: sheetName, id: id, error: e.message });
    return errorResponse('فشل في الحذف: ' + e.message);
  }
}

/**
 * البحث عن صف بواسطة المعرف
 * @param {string} sheetName - اسم الورقة
 * @param {string} idColumn - عمود المعرف
 * @param {string} id - المعرف
 * @returns {Object|null} السجل أو null
 */
function findById(sheetName, idColumn, id) {
  const data = getSheetData(sheetName);
  if (data.length < 2) return null;
  
  const headers = data[0];
  const colIndex = headers.indexOf(idColumn);
  
  if (colIndex === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === id) {
      return rowToObject(headers, data[i]);
    }
  }
  
  return null;
}

// ============================================
// Batch Operations (للأداء)
// ============================================

/**
 * إضافة عدة صفوف دفعة واحدة
 * @param {string} sheetName - اسم الورقة
 * @param {Array} rowsArray - مصفوفة الصفوف
 * @returns {Object} النتيجة
 */
function batchInsertRows(sheetName, rowsArray) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة: ' + sheetName);
    }
    
    if (!rowsArray || rowsArray.length === 0) {
      return successResponse(null, 'لا يوجد بيانات للإضافة');
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = [];
    
    for (let i = 0; i < rowsArray.length; i++) {
      rows.push(objectToRow(headers, rowsArray[i]));
    }
    
    // إضافة الصفوف دفعة واحدة
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    // تحديث Cache
    cacheRemove('data_' + sheetName);
    
    return successResponse({ count: rows.length }, 'تمت إضافة ' + rows.length + ' سجل');
    
  } catch (e) {
    logError('Batch Insert Error', { sheetName: sheetName, count: rowsArray.length, error: e.message });
    return errorResponse('فشل في الإضافة الدفعية: ' + e.message);
  }
}

/**
 * تحديث عدة صفوف دفعة واحدة
 * @param {string} sheetName - اسم الورقة
 * @param {string} idColumn - عمود المعرف
 * @param {Array} updatesArray - مصفوفة التحديثات [{id, data}]
 * @returns {Object} النتيجة
 */
function batchUpdateRows(sheetName, idColumn, updatesArray) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة');
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColIndex = headers.indexOf(idColumn);
    const allData = sheet.getDataRange().getValues();
    
    let updatedCount = 0;
    
    for (let i = 0; i < updatesArray.length; i++) {
      const update = updatesArray[i];
      
      for (let j = 1; j < allData.length; j++) {
        if (allData[j][idColIndex] === update.id) {
          const row = objectToRow(headers, update.data);
          sheet.getRange(j + 1, 1, 1, row.length).setValues([row]);
          updatedCount++;
          break;
        }
      }
    }
    
    // تحديث Cache
    cacheRemove('data_' + sheetName);
    
    return successResponse({ count: updatedCount }, 'تم تحديث ' + updatedCount + ' سجل');
    
  } catch (e) {
    logError('Batch Update Error', { sheetName: sheetName, error: e.message });
    return errorResponse('فشل في التحديث الدفعي: ' + e.message);
  }
}

/**
 * حذف عدة صفوف دفعة واحدة
 * @param {string} sheetName - اسم الورقة
 * @param {string} idColumn - عمود المعرف
 * @param {Array} idsArray - مصفوفة المعرفات
 * @returns {Object} النتيجة
 */
function batchDeleteRows(sheetName, idColumn, idsArray) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('الورقة غير موجودة');
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColIndex = headers.indexOf(idColumn);
    const allData = sheet.getDataRange().getValues();
    
    const rowsToDelete = [];
    
    for (let i = 1; i < allData.length; i++) {
      if (idsArray.indexOf(allData[i][idColIndex]) !== -1) {
        rowsToDelete.push(i + 1);
      }
    }
    
    // حذف من الأسفل للأعلى لتجنب مشاكل الفهارس
    rowsToDelete.sort(function(a, b) { return b - a; });
    
    for (let i = 0; i < rowsToDelete.length; i++) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    
    // تحديث Cache
    cacheRemove('data_' + sheetName);
    
    return successResponse({ count: rowsToDelete.length }, 'تم حذف ' + rowsToDelete.length + ' سجل');
    
  } catch (e) {
    logError('Batch Delete Error', { sheetName: sheetName, error: e.message });
    return errorResponse('فشل في الحذف الدفعي: ' + e.message);
  }
}

// ============================================
// دوال متخصصة للشحنات
// ============================================

/**
 * الحصول على الشحنات مع الفلاتر
 * @param {Object} filters - الفلاتر
 * @param {boolean} useCache - استخدام الـ Cache
 * @returns {Array} الشحنات
 */
function getShipments(filters, useCache) {
  let data = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, useCache);
  
  if (!filters) return data;
  
  // تصفية حسب الموظف (للموظفين العاديين)
  if (filters.assignedEmployee) {
    data = data.filter(function(item) {
      return item.AssignedEmployee === filters.assignedEmployee;
    });
  }
  
  // تصفية حسب الحالة
  if (filters.status && filters.status !== 'all') {
    data = data.filter(function(item) {
      return item.Status === filters.status;
    });
  }
  
  // تصفية حسب المحافظة
  if (filters.governorate && filters.governorate !== 'all') {
    data = data.filter(function(item) {
      return item.Governorate === filters.governorate;
    });
  }
  
  // تصفية حسب الفرع
  if (filters.branch && filters.branch !== 'all') {
    data = data.filter(function(item) {
      return item.Branch === filters.branch;
    });
  }
  
  // تصفية حسب المنتج
  if (filters.product && filters.product !== 'all') {
    data = data.filter(function(item) {
      return item.ProductName === filters.product;
    });
  }
  
  // تصفية حسب الأولوية
  if (filters.priority && filters.priority !== 'all') {
    data = data.filter(function(item) {
      return item.Priority === filters.priority;
    });
  }
  
  // تصفية الشحنات غير المؤرشفة افتراضياً
  if (filters.includeArchived !== true) {
    data = data.filter(function(item) {
      return item.IsArchived !== 'true' && item.IsArchived !== true;
    });
  }
  
  // تصفية الشحنات التي تحتاج متابعة
  if (filters.needsFollowUp === true) {
    data = data.filter(function(item) {
      return !item.LastFollowUp || isOlderThanHours(item.LastFollowUp, 24);
    });
  }
  
  // تصفية الشحنات المؤجلة التي انتهى موعدها
  if (filters.overduePostponed === true) {
    data = data.filter(function(item) {
      return item.Status === SHIPMENT_STATUS.POSTPONED && 
             item.NextFollowUp && 
             new Date(item.NextFollowUp) < new Date();
    });
  }
  
  // تصفية الشحنات "لا يرد" أكثر من 3 مرات
  if (filters.noAnswerThreshold === true) {
    data = data.filter(function(item) {
      return parseInt(item.NoAnswerCount || 0) >= 3;
    });
  }
  
  return data;
}

/**
 * الحصول على إحصائيات الشحنات
 * @param {string} employeeId - معرف الموظف (اختياري)
 * @returns {Object} الإحصائيات
 */
function getShipmentStats(employeeId) {
  let data = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
  
  if (employeeId) {
    data = data.filter(function(item) {
      return item.AssignedEmployee === employeeId;
    });
  }
  
  const stats = {
    total: data.length,
    unassigned: 0,
    readyForPickup: 0,
    delivered: 0,
    noAnswer: 0,
    postponed: 0,
    returned: 0,
    rejectedQuality: 0,
    rejectedDelay: 0,
    closed: 0,
    archived: 0,
    needsFollowUp: 0,
    noAnswerThreshold: 0,
    overduePostponed: 0,
    totalValue: 0,
    codTotal: 0
  };
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const status = item.Status;
    
    if (status === SHIPMENT_STATUS.UNASSIGNED) stats.unassigned++;
    else if (status === SHIPMENT_STATUS.READY_FOR_PICKUP) stats.readyForPickup++;
    else if (status === SHIPMENT_STATUS.DELIVERED) stats.delivered++;
    else if (status === SHIPMENT_STATUS.NO_ANSWER) stats.noAnswer++;
    else if (status === SHIPMENT_STATUS.POSTPONED) stats.postponed++;
    else if (status === SHIPMENT_STATUS.RETURNED) stats.returned++;
    else if (status === SHIPMENT_STATUS.REJECTED_QUALITY) stats.rejectedQuality++;
    else if (status === SHIPMENT_STATUS.REJECTED_DELAY) stats.rejectedDelay++;
    else if (status === SHIPMENT_STATUS.CLOSED) stats.closed++;
    
    if (item.IsArchived === 'true' || item.IsArchived === true) {
      stats.archived++;
    }
    
    if (!item.LastFollowUp || isOlderThanHours(item.LastFollowUp, 24)) {
      stats.needsFollowUp++;
    }
    
    if (parseInt(item.NoAnswerCount || 0) >= 3) {
      stats.noAnswerThreshold++;
    }
    
    if (status === SHIPMENT_STATUS.POSTPONED && 
        item.NextFollowUp && 
        new Date(item.NextFollowUp) < new Date()) {
      stats.overduePostponed++;
    }
    
    stats.totalValue += toNumber(item.Price);
    stats.codTotal += toNumber(item.CODAmount);
  }
  
  return stats;
}

/**
 * أرشفة شحنة
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} archivedBy - من قام بالأرشفة
 * @returns {Object} النتيجة
 */
function archiveShipment(shipmentId, archivedBy) {
  try {
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse('الشحنة غير موجودة');
    }
    
    // نسخ إلى Archive
    const archiveData = {};
    const archiveHeaders = SHEET_HEADERS.ARCHIVE;
    const shipmentHeaders = SHEET_HEADERS.SHIPMENTS;
    
    for (let i = 0; i < shipmentHeaders.length; i++) {
      archiveData[shipmentHeaders[i]] = shipment[shipmentHeaders[i]] || '';
    }
    
    archiveData.ArchivedAt = getCurrentDateTime();
    archiveData.ArchivedBy = archivedBy || 'System';
    
    const result = insertRow(SHEET_NAMES.ARCHIVE, archiveData);
    
    if (result.success) {
      // تحديث حالة الشحنة الأصلية
      shipment.IsArchived = 'true';
      shipment.UpdatedAt = getCurrentDateTime();
      updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, shipment);
      
      logAction('SHIPMENT_ARCHIVED', archivedBy, { shipmentId: shipmentId });
    }
    
    return result;
    
  } catch (e) {
    logError('Archive Shipment Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse('فشل في الأرشفة: ' + e.message);
  }
}

// ============================================
// دوال متخصصة للموظفين
// ============================================

/**
 * الحصول على جميع الموظفين النشطين
 * @param {boolean} useCache - استخدام الـ Cache
 * @returns {Array} الموظفين
 */
function getActiveEmployees(useCache) {
  const data = getSheetDataAsObjects(SHEET_NAMES.EMPLOYEES, useCache);
  return data.filter(function(emp) {
    return emp.IsActive === 'true' || emp.IsActive === true;
  });
}

/**
 * الحصول على موظف بواسطة اسم المستخدم
 * @param {string} username - اسم المستخدم
 * @returns {Object|null} الموظف أو null
 */
function getEmployeeByUsername(username) {
  const data = getSheetData(SHEET_NAMES.EMPLOYEES, false);
  if (data.length < 2) return null;
  
  const headers = data[0];
  const usernameIndex = headers.indexOf('Username');
  
  if (usernameIndex === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameIndex] === username) {
      return rowToObject(headers, data[i]);
    }
  }
  
  return null;
}

/**
 * الحصول على موظف بواسطة المعرف
 * @param {string} id - المعرف
 * @returns {Object|null} الموظف أو null
 */
function getEmployeeById(id) {
  return findById(SHEET_NAMES.EMPLOYEES, 'ID', id);
}

/**
 * تحديث آخر تسجيل دخول
 * @param {string} employeeId - معرف الموظف
 */
function updateLastLogin(employeeId) {
  const employee = getEmployeeById(employeeId);
  if (employee) {
    employee.LastLogin = getCurrentDateTime();
    employee.UpdatedAt = getCurrentDateTime();
    updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, employee);
  }
}

// ============================================
// دوال متخصصة للإعدادات
// ============================================

/**
 * الحصول على إعداد
 * @param {string} key - المفتاح
 * @param {string} defaultValue - القيمة الافتراضية
 * @returns {string} القيمة
 */
function getSetting(key, defaultValue) {
  const cacheKey = CACHE_KEYS.SETTINGS + '_' + key;
  const cached = cacheGet(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  const data = getSheetData(SHEET_NAMES.SETTINGS, false);
  if (data.length < 2) return defaultValue || '';
  
  const headers = data[0];
  const keyIndex = headers.indexOf('Key');
  const valueIndex = headers.indexOf('Value');
  
  if (keyIndex === -1 || valueIndex === -1) return defaultValue || '';
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][keyIndex] === key) {
      const value = data[i][valueIndex];
      cachePut(cacheKey, value, 600); // 10 دقائق
      return value;
    }
  }
  
  return defaultValue || '';
}

/**
 * تحديث إعداد
 * @param {string} key - المفتاح
 * @param {string} value - القيمة
 * @param {string} updatedBy - من قام بالتحديث
 * @returns {Object} النتيجة
 */
function updateSetting(key, value, updatedBy) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    
    if (!sheet) {
      return errorResponse('ورقة الإعدادات غير موجودة');
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const keyIndex = headers.indexOf('Key');
    
    if (keyIndex === -1) {
      return errorResponse('عمود المفتاح غير موجود');
    }
    
    const allData = sheet.getDataRange().getValues();
    
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][keyIndex] === key) {
        // تحديث الصف
        const rowData = rowToObject(headers, allData[i]);
        rowData.Value = value;
        rowData.UpdatedAt = getCurrentDateTime();
        rowData.UpdatedBy = updatedBy || 'System';
        
        const row = objectToRow(headers, rowData);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        
        // تحديث Cache
        cacheRemove(CACHE_KEYS.SETTINGS + '_' + key);
        cacheRemove(CACHE_KEYS.SETTINGS);
        
        return successResponse(null, 'تم تحديث الإعداد');
      }
    }
    
    // إضافة جديدة إذا لم تكن موجودة
    const newSetting = {
      Key: key,
      Value: value,
      UpdatedAt: getCurrentDateTime(),
      UpdatedBy: updatedBy || 'System'
    };
    
    return insertRow(SHEET_NAMES.SETTINGS, newSetting);
    
  } catch (e) {
    logError('Update Setting Error', { key: key, error: e.message });
    return errorResponse('فشل في تحديث الإعداد: ' + e.message);
  }
}

/**
 * الحصول على جميع الإعدادات
 * @returns {Object} الإعدادات ككائن
 */
function getAllSettings() {
  const cacheKey = CACHE_KEYS.SETTINGS;
  const cached = cacheGet(cacheKey);
  
  if (cached) return cached;
  
  const data = getSheetDataAsObjects(SHEET_NAMES.SETTINGS, false);
  const settings = {};
  
  for (let i = 0; i < data.length; i++) {
    settings[data[i].Key] = data[i].Value;
  }
  
  cachePut(cacheKey, settings, 300);
  return settings;
}

// ============================================
// دوال متخصصة للسجل (History)
// ============================================

/**
 * إضافة سجل جديد
 * @param {Object} historyData - بيانات السجل
 * @returns {Object} النتيجة
 */
function addHistoryRecord(historyData) {
  const record = {
    ID: generateId('HIS'),
    ShipmentID: historyData.shipmentId || '',
    EmployeeID: historyData.employeeId || '',
    EmployeeName: historyData.employeeName || '',
    OldStatus: historyData.oldStatus || '',
    NewStatus: historyData.newStatus || '',
    Notes: historyData.notes || '',
    ActionType: historyData.actionType || ACTION_TYPES.UPDATE,
    Timestamp: getCurrentDateTime()
  };
  
  return insertRow(SHEET_NAMES.HISTORY, record);
}

/**
 * الحصول على سجل شحنة
 * @param {string} shipmentId - معرف الشحنة
 * @returns {Array} السجل
 */
function getShipmentHistory(shipmentId) {
  const data = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
  return data.filter(function(item) {
    return item.ShipmentID === shipmentId;
  }).sort(function(a, b) {
    return new Date(b.Timestamp) - new Date(a.Timestamp);
  });
}

// ============================================
// دوال متخصصة للإشعارات
// ============================================

/**
 * إضافة إشعار
 * @param {Object} notification - بيانات الإشعار
 * @returns {Object} النتيجة
 */
function addNotification(notification) {
  const notif = {
    ID: generateId('NOT'),
    Type: notification.type || NOTIFICATION_TYPES.SYSTEM,
    Message: notification.message || '',
    RelatedShipment: notification.shipmentId || '',
    IsRead: 'false',
    CreatedAt: getCurrentDateTime(),
    ForUser: notification.forUser || 'all'
  };
  
  return insertRow(SHEET_NAMES.NOTIFICATIONS, notif);
}

/**
 * الحصول على إشعارات مستخدم
 * @param {string} userId - معرف المستخدم
 * @param {boolean} unreadOnly - غير مقروءة فقط
 * @returns {Array} الإشعارات
 */
function getUserNotifications(userId, unreadOnly) {
  let data = getSheetDataAsObjects(SHEET_NAMES.NOTIFICATIONS, false);
  
  data = data.filter(function(item) {
    return item.ForUser === userId || item.ForUser === 'all';
  });
  
  if (unreadOnly) {
    data = data.filter(function(item) {
      return item.IsRead !== 'true' && item.IsRead !== true;
    });
  }
  
  return data.sort(function(a, b) {
    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
  });
}

/**
 * تحديث حالة الإشعار إلى مقروء
 * @param {string} notificationId - معرف الإشعار
 * @returns {Object} النتيجة
 */
function markNotificationRead(notificationId) {
  const notification = findById(SHEET_NAMES.NOTIFICATIONS, 'ID', notificationId);
  if (!notification) {
    return errorResponse('الإشعار غير موجود');
  }
  
  notification.IsRead = 'true';
  return updateRow(SHEET_NAMES.NOTIFICATIONS, 'ID', notificationId, notification);
}

// ============================================
// دوال متخصصة للأدوار والصلاحيات
// ============================================

/**
 * الحصول على جميع الأدوار
 * @returns {Array} الأدوار
 */
function getAllRoles() {
  const cacheKey = CACHE_KEYS.ROLES;
  const cached = cacheGet(cacheKey);
  
  if (cached) return cached;
  
  const data = getSheetDataAsObjects(SHEET_NAMES.ROLES, false);
  const roles = [];
  
  for (let i = 0; i < data.length; i++) {
    const role = data[i];
    try {
      role.Permissions = JSON.parse(role.Permissions || '[]');
    } catch (e) {
      role.Permissions = [];
    }
    roles.push(role);
  }
  
  cachePut(cacheKey, roles, 600);
  return roles;
}

/**
 * الحصول على دور بواسطة المفتاح
 * @param {string} roleKey - مفتاح الدور
 * @returns {Object|null} الدور أو null
 */
function getRoleByKey(roleKey) {
  const roles = getAllRoles();
  for (let i = 0; i < roles.length; i++) {
    if (roles[i].RoleKey === roleKey) {
      return roles[i];
    }
  }
  return null;
}

/**
 * الحصول على جميع الصلاحيات
 * @returns {Array} الصلاحيات
 */
function getAllPermissions() {
  const cacheKey = CACHE_KEYS.PERMISSIONS;
  const cached = cacheGet(cacheKey);
  
  if (cached) return cached;
  
  const data = getSheetDataAsObjects(SHEET_NAMES.PERMISSIONS, false);
  cachePut(cacheKey, data, 600);
  return data;
}

/**
 * الحصول على صلاحيات موظف
 * @param {string} employeeId - معرف الموظف
 * @returns {Array} الصلاحيات
 */
function getEmployeePermissions(employeeId) {
  const employee = getEmployeeById(employeeId);
  if (!employee) return [];
  
  let permissions = [];
  
  // صلاحيات من حقل Permissions
  try {
    const empPerms = JSON.parse(employee.Permissions || '[]');
    if (Array.isArray(empPerms)) {
      permissions = permissions.concat(empPerms);
    }
  } catch (e) {
    // تجاهل خطأ JSON
  }
  
  // صلاحيات من الدور
  const role = getRoleByKey(employee.Role);
  if (role && role.Permissions) {
    permissions = permissions.concat(role.Permissions);
  }
  
  // إزالة التكرارات
  return uniqueArray(permissions);
}

// ============================================
// دوال التحقق من صحة البيانات
// ============================================

/**
 * التحقق من صحة بيانات الشحنة
 * @param {Object} shipment - بيانات الشحنة
 * @returns {Object} نتيجة التحقق
 */
function validateShipment(shipment) {
  const errors = [];
  
  if (isEmpty(shipment.TrackingNumber)) {
    errors.push('رقم التتبع مطلوب');
  }
  
  if (isEmpty(shipment.CustomerName)) {
    errors.push('اسم العميل مطلوب');
  }
  
  if (isEmpty(shipment.Phone)) {
    errors.push('رقم الهاتف مطلوب');
  } else if (!isValidPhone(shipment.Phone)) {
    errors.push('رقم الهاتف غير صحيح');
  }
  
  if (isEmpty(shipment.Governorate)) {
    errors.push('المحافظة مطلوبة');
  }
  
  if (isEmpty(shipment.ProductName)) {
    errors.push('اسم المنتج مطلوب');
  }
  
  if (!isNumber(shipment.Price) || toNumber(shipment.Price) < 0) {
    errors.push('السعر يجب أن يكون رقم موجب');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * التحقق من صحة بيانات الموظف
 * @param {Object} employee - بيانات الموظف
 * @param {boolean} isNew - هل هو جديد
 * @returns {Object} نتيجة التحقق
 */
function validateEmployee(employee, isNew) {
  const errors = [];
  
  if (isEmpty(employee.Username)) {
    errors.push('اسم المستخدم مطلوب');
  }
  
  if (isNew && isEmpty(employee.Password)) {
    errors.push('كلمة المرور مطلوبة للموظف الجديد');
  }
  
  if (employee.Password && employee.Password.length < SYSTEM_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push('كلمة المرور يجب أن تكون ' + SYSTEM_CONFIG.PASSWORD_MIN_LENGTH + ' أحرف على الأقل');
  }
  
  if (isEmpty(employee.Name)) {
    errors.push('الاسم مطلوب');
  }
  
  if (!isEmpty(employee.Email) && !isValidEmail(employee.Email)) {
    errors.push('البريد الإلكتروني غير صحيح');
  }
  
  if (isEmpty(employee.Role)) {
    errors.push('الدور مطلوب');
  }
  
  // التحقق من عدم تكرار اسم المستخدم
  if (isNew) {
    const existing = getEmployeeByUsername(employee.Username);
    if (existing) {
      errors.push('اسم المستخدم مستخدم مسبقاً');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================
// دوال النسخ الاحتياطي
// ============================================

/**
 * إنشاء نسخة احتياطية
 * @returns {Object} النتيجة
 */
function createBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSs = SpreadsheetApp.create(
      'Backup_' + ss.getName() + '_' + formatDate(new Date(), 'yyyy-MM-dd_HH-mm')
    );
    
    const sheetNames = Object.values(SHEET_NAMES);
    
    for (let i = 0; i < sheetNames.length; i++) {
      const sourceSheet = ss.getSheetByName(sheetNames[i]);
      if (sourceSheet) {
        sourceSheet.copyTo(backupSs).setName(sheetNames[i]);
      }
    }
    
    propPut(PROPERTIES_KEYS.LAST_BACKUP, getCurrentDateTime());
    
    return successResponse({ 
      backupId: backupSs.getId(),
      backupUrl: backupSs.getUrl()
    }, 'تم إنشاء النسخة الاحتياطية بنجاح');
    
  } catch (e) {
    logError('Backup Error', { error: e.message });
    return errorResponse('فشل في إنشاء النسخة الاحتياطية: ' + e.message);
  }
}

// ============================================
// دوال مساعدة للـ Import
// ============================================

/**
 * استيراد شحنات من CSV
 * @param {string} csvContent - محتوى CSV
 * @param {string} importedBy - من قام بالاستيراد
 * @returns {Object} النتيجة
 */
function importShipmentsFromCsv(csvContent, importedBy) {
  try {
    const lines = csvContent.split('\n');
    if (lines.length < 2) {
      return errorResponse('ملف CSV فارغ أو غير صحيح');
    }
    
    // قراءة Headers
    const csvHeaders = lines[0].split(',').map(function(h) {
      return h.trim().replace(/^"|"$/g, '');
    });
    
    const requiredFields = ['TrackingNumber', 'CustomerName', 'Phone', 'Governorate', 'ProductName'];
    for (let i = 0; i < requiredFields.length; i++) {
      if (csvHeaders.indexOf(requiredFields[i]) === -1) {
        return errorResponse('الحقل المطلوب مفقود: ' + requiredFields[i]);
      }
    }
    
    const shipments = [];
    const errors = [];
    
    for (let i = 1; i < lines.length && i <= SYSTEM_CONFIG.MAX_IMPORT_ROWS; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',').map(function(v) {
        return v.trim().replace(/^"|"$/g, '');
      });
      
      const shipment = {};
      for (let j = 0; j < csvHeaders.length; j++) {
        shipment[csvHeaders[j]] = values[j] || '';
      }
      
      // تعيين قيم افتراضية
      shipment.ID = generateId('SHP');
      shipment.Status = SHIPMENT_STATUS.UNASSIGNED;
      shipment.CreatedAt = getCurrentDateTime();
      shipment.UpdatedAt = getCurrentDateTime();
      shipment.IsArchived = 'false';
      shipment.NoAnswerCount = '0';
      shipment.Priority = shipment.Priority || PRIORITY.NORMAL;
      
      const validation = validateShipment(shipment);
      if (validation.valid) {
        shipments.push(shipment);
      } else {
        errors.push({ row: i + 1, errors: validation.errors });
      }
    }
    
    if (shipments.length === 0) {
      return errorResponse('لا توجد شحنات صالحة للاستيراد', { errors: errors });
    }
    
    // إضافة دفعة واحدة
    const result = batchInsertRows(SHEET_NAMES.SHIPMENTS, shipments);
    
    if (result.success) {
      logAction('SHIPMENTS_IMPORTED', importedBy, { 
        count: shipments.length,
        errors: errors.length
      });
      
      // إضافة سجل للتاريخ
      for (let i = 0; i < shipments.length; i++) {
        addHistoryRecord({
          shipmentId: shipments[i].ID,
          employeeId: importedBy,
          actionType: ACTION_TYPES.IMPORT,
          notes: 'استيراد من CSV'
        });
      }
    }
    
    return successResponse({
      imported: shipments.length,
      errors: errors,
      totalRows: lines.length - 1
    }, 'تم استيراد ' + shipments.length + ' شحنة بنجاح');
    
  } catch (e) {
    logError('Import CSV Error', { error: e.message });
    return errorResponse('فشل في الاستيراد: ' + e.message);
  }
}
