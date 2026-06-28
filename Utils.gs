/**
 * ============================================
 * Utils.gs - الدوال المساعدة والأدوات
 * ============================================
 * 
 * يحتوي على جميع الدوال المساعدة المشتركة:
 * - التشفير والأمان
 * - إدارة الـ Cache
 * - التنسيق والتحويل
 * - التحقق من البيانات
 * - التعامل مع التواريخ
 * - توليد المعرفات
 * - الدوال العامة
 */

// ============================================
// التشفير والأمان
// ============================================

/**
 * توليد Salt عشوائي
 * @returns {string} Salt عشوائي بطول 16 حرف
 */
function generateSalt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * تشفير كلمة المرور باستخدام SHA-256 مع Salt
 * @param {string} password - كلمة المرور الأصلية
 * @param {string} salt - Salt
 * @returns {string} Hash مشفر
 */
function hashPassword(password, salt) {
  const input = salt + password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return hash.map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * التحقق من كلمة المرور
 * @param {string} password - كلمة المرور المدخلة
 * @param {string} salt - Salt المخزن
 * @param {string} hash - Hash المخزن
 * @returns {boolean} صحيح أو خطأ
 */
function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}

/**
 * توليد Session Token عشوائي آمن
 * @returns {string} Token فريد
 */
function generateSessionToken() {
  const timestamp = new Date().getTime().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    timestamp + random + random2 + generateSalt(),
    Utilities.Charset.UTF_8
  ).map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * توليد معرف فريد (UUID)
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * توليد معرف مختصر للشحنات
 * @param {string} prefix - البادئة (مثل: SHP)
 * @returns {string} معرف فريد
 */
function generateId(prefix) {
  const timestamp = new Date().getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + '-' + timestamp + '-' + random;
}

// ============================================
// إدارة الـ Cache
// ============================================

/**
 * الحصول على قيمة من الـ Cache
 * @param {string} key - المفتاح
 * @returns {any} القيمة أو null
 */
function cacheGet(key) {
  try {
    const cache = CacheService.getScriptCache();
    const value = cache.get(key);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  } catch (e) {
    logError('Cache Get Error', { key: key, error: e.message });
    return null;
  }
}

/**
 * تخزين قيمة في الـ Cache
 * @param {string} key - المفتاح
 * @param {any} value - القيمة
 * @param {number} seconds - مدة التخزين (افتراضي 300 ثانية)
 */
function cachePut(key, value, seconds) {
  try {
    const cache = CacheService.getScriptCache();
    const duration = seconds || SYSTEM_CONFIG.CACHE_DURATION_SECONDS;
    cache.put(key, JSON.stringify(value), duration);
  } catch (e) {
    logError('Cache Put Error', { key: key, error: e.message });
  }
}

/**
 * حذف قيمة من الـ Cache
 * @param {string} key - المفتاح
 */
function cacheRemove(key) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(key);
  } catch (e) {
    logError('Cache Remove Error', { key: key, error: e.message });
  }
}

/**
 * تفريغ الـ Cache بالكامل
 */
function cacheClear() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(Object.values(CACHE_KEYS));
  } catch (e) {
    logError('Cache Clear Error', { error: e.message });
  }
}

// ============================================
// إدارة PropertiesService
// ============================================

/**
 * الحصول على قيمة من PropertiesService
 * @param {string} key - المفتاح
 * @returns {string} القيمة أو null
 */
function propGet(key) {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key);
  } catch (e) {
    logError('Properties Get Error', { key: key, error: e.message });
    return null;
  }
}

/**
 * تخزين قيمة في PropertiesService
 * @param {string} key - المفتاح
 * @param {string} value - القيمة
 */
function propPut(key, value) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, value);
  } catch (e) {
    logError('Properties Put Error', { key: key, error: e.message });
  }
}

/**
 * حذف قيمة من PropertiesService
 * @param {string} key - المفتاح
 */
function propRemove(key) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(key);
  } catch (e) {
    logError('Properties Remove Error', { key: key, error: e.message });
  }
}

// ============================================
// التعامل مع التواريخ
// ============================================

/**
 * تنسيق التاريخ
 * @param {Date} date - التاريخ
 * @param {string} format - التنسيق (افتراضي: dd/MM/yyyy)
 * @returns {string} التاريخ المنسق
 */
function formatDate(date, format) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const fmt = format || SYSTEM_CONFIG.DATE_FORMAT;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  
  return fmt
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', year)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * الحصول على التاريخ والوقت الحالي
 * @returns {string} التاريخ والوقت
 */
function getCurrentDateTime() {
  return formatDate(new Date(), SYSTEM_CONFIG.DATETIME_FORMAT);
}

/**
 * الحصول على التاريخ الحالي فقط
 * @returns {string} التاريخ
 */
function getCurrentDate() {
  return formatDate(new Date(), SYSTEM_CONFIG.DATE_FORMAT);
}

/**
 * إضافة أيام إلى تاريخ
 * @param {Date} date - التاريخ
 * @param {number} days - عدد الأيام
 * @returns {Date} التاريخ الجديد
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * إضافة ساعات إلى تاريخ
 * @param {Date} date - التاريخ
 * @param {number} hours - عدد الساعات
 * @returns {Date} التاريخ الجديد
 */
function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * حساب الفرق بين تاريخين بالأيام
 * @param {Date} date1 - التاريخ الأول
 * @param {Date} date2 - التاريخ الثاني
 * @returns {number} عدد الأيام
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * التحقق إذا كان التاريخ منذ أكثر من X ساعات
 * @param {Date} date - التاريخ
 * @param {number} hours - عدد الساعات
 * @returns {boolean} true إذا مر الوقت
 */
function isOlderThanHours(date, hours) {
  if (!date) return true;
  const now = new Date();
  const checkDate = new Date(date);
  const diffMs = now - checkDate;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > hours;
}

// ============================================
// التحقق من البيانات والتنسيق
// ============================================

/**
 * التحقق من صحة البريد الإلكتروني
 * @param {string} email - البريد الإلكتروني
 * @returns {boolean} صحيح أو خطأ
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * التحقق من صحة رقم الهاتف المصري
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} صحيح أو خطأ
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.toString().replace(/\s/g, '').replace(/^\+?2/, '');
  const regex = /^(01)[0-2,5]{1}[0-9]{8}$/;
  return regex.test(cleaned);
}

/**
 * تنظيف رقم الهاتف
 * @param {string} phone - رقم الهاتف
 * @returns {string} الرقم المنظف
 */
function cleanPhone(phone) {
  if (!phone) return '';
  return phone.toString().replace(/\s/g, '').replace(/^\+?2/, '');
}

/**
 * التحقق من أن القيمة فارغة
 * @param {any} value - القيمة
 * @returns {boolean} true إذا كانت فارغة
 */
function isEmpty(value) {
  return value === null || value === undefined || value.toString().trim() === '';
}

/**
 * التحقق من أن القيمة رقم
 * @param {any} value - القيمة
 * @returns {boolean} true إذا كان رقم
 */
function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * تحويل قيمة إلى رقم
 * @param {any} value - القيمة
 * @returns {number} الرقم أو 0
 */
function toNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * تقصير النص
 * @param {string} text - النص
 * @param {number} maxLength - الحد الأقصى
 * @returns {string} النص المقصور
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * إزالة علامات HTML من النص
 * @param {string} text - النص
 * @returns {string} النص النظيف
 */
function stripHtml(text) {
  if (!text) return '';
  return text.toString().replace(/<[^>]*>/g, '');
}

/**
 * تنسيق الأرقام كعملة
 * @param {number} amount - المبلغ
 * @returns {string} المبلغ المنسق
 */
function formatCurrency(amount) {
  const num = toNumber(amount);
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ج.م';
}

/**
 * تنسيق الرقم كنسبة مئوية
 * @param {number} value - القيمة
 * @param {number} total - الإجمالي
 * @returns {string} النسبة
 */
function formatPercentage(value, total) {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

// ============================================
// الدوال المتعلقة بالصفوف والأعمدة
// ============================================

/**
 * تحويل صف من ورقة إلى كائن
 * @param {Array} headers - أسماء الأعمدة
 * @param {Array} row - بيانات الصف
 * @returns {Object} الكائن
 */
function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] !== undefined ? row[i] : '';
  }
  return obj;
}

/**
 * تحويل كائن إلى صف
 * @param {Array} headers - أسماء الأعمدة
 * @param {Object} obj - الكائن
 * @returns {Array} بيانات الصف
 */
function objectToRow(headers, obj) {
  return headers.map(function(header) {
    return obj[header] !== undefined ? obj[header] : '';
  });
}

/**
 * البحث عن صفوف في نطاق
 * @param {Array} data - البيانات
 * @param {string} columnName - اسم العمود
 * @param {any} value - القيمة
 * @returns {Array} الصفوف المطابقة
 */
function findRows(data, columnName, value) {
  if (!data || data.length < 2) return [];
  const headers = data[0];
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return [];
  
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) {
      results.push(rowToObject(headers, data[i]));
    }
  }
  return results;
}

/**
 * البحث عن صف واحد
 * @param {Array} data - البيانات
 * @param {string} columnName - اسم العمود
 * @param {any} value - القيمة
 * @returns {Object|null} الصف أو null
 */
function findRow(data, columnName, value) {
  const rows = findRows(data, columnName, value);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * تصفية البيانات
 * @param {Array} data - البيانات
 * @param {Function} filterFn - دالة التصفية
 * @returns {Array} البيانات المصفاة
 */
function filterData(data, filterFn) {
  if (!data || data.length < 2) return [];
  const headers = data[0];
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const obj = rowToObject(headers, data[i]);
    if (filterFn(obj)) {
      results.push(obj);
    }
  }
  return results;
}

// ============================================
// تسجيل الأخطاء والعمليات
// ============================================

/**
 * تسجيل خطأ
 * @param {string} action - الإجراء
 * @param {Object} details - التفاصيل
 */
function logError(action, details) {
  try {
    const logEntry = {
      ID: generateId('LOG'),
      Action: 'ERROR: ' + action,
      User: Session.getActiveUser().getEmail() || 'System',
      Details: JSON.stringify(details),
      Timestamp: getCurrentDateTime()
    };
    
    // محاولة تسجيل في Logs sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (sheet) {
      const headers = SHEET_HEADERS.LOGS;
      const row = objectToRow(headers, logEntry);
      sheet.appendRow(row);
    }
    
    // تسجيل في Console أيضاً
    console.error('[' + getCurrentDateTime() + '] ' + action + ': ' + JSON.stringify(details));
  } catch (e) {
    console.error('Failed to log error: ' + e.message);
  }
}

/**
 * تسجيل عملية
 * @param {string} action - الإجراء
 * @param {string} user - المستخدم
 * @param {Object} details - التفاصيل
 */
function logAction(action, user, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (!sheet) return;
    
    const logEntry = {
      ID: generateId('LOG'),
      Action: action,
      User: user || 'System',
      Details: JSON.stringify(details),
      Timestamp: getCurrentDateTime()
    };
    
    const headers = SHEET_HEADERS.LOGS;
    const row = objectToRow(headers, logEntry);
    sheet.appendRow(row);
  } catch (e) {
    console.error('Failed to log action: ' + e.message);
  }
}

// ============================================
// الردود JSON الموحدة
// ============================================

/**
 * إنشاء رد نجاح
 * @param {any} data - البيانات
 * @param {string} message - الرسالة
 * @returns {Object} الرد
 */
function successResponse(data, message) {
  return {
    success: true,
    message: message || SUCCESS_MESSAGES.UPDATED,
    data: data || null,
    timestamp: getCurrentDateTime()
  };
}

/**
 * إنشاء رد خطأ
 * @param {string} message - رسالة الخطأ
 * @param {Object} details - تفاصيل إضافية
 * @returns {Object} الرد
 */
function errorResponse(message, details) {
  return {
    success: false,
    message: message || ERROR_MESSAGES.SERVER_ERROR,
    details: details || null,
    timestamp: getCurrentDateTime()
  };
}

/**
 * إنشاء رد JSON للعميل
 * @param {Object} response - الرد
 * @returns {TextOutput} الناتج
 */
function jsonResponse(response) {
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// دوال مساعدة للـ HTML
// ============================================

/**
 * تضمين ملف HTML
 * @param {string} filename - اسم الملف
 * @returns {string} محتوى HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * تضمين ملف HTML مع معالجة
 * @param {string} filename - اسم الملف
 * @returns {string} محتوى HTML
 */
function includeFile(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    logError('Include File Error', { filename: filename, error: e.message });
    return '<!-- Error loading ' + filename + ' -->';
  }
}

/**
 * إنشاء قالب HTML مع بيانات
 * @param {string} template - اسم القالب
 * @param {Object} data - البيانات
 * @returns {HtmlOutput} الصفحة
 */
function renderTemplate(template, data) {
  const templateObj = HtmlService.createTemplateFromFile(template);
  if (data) {
    Object.keys(data).forEach(function(key) {
      templateObj[key] = data[key];
    });
  }
  return templateObj.evaluate()
    .setTitle(SYSTEM_CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// دوال التحقق من الصلاحيات
// ============================================

/**
 * التحقق من وجود صلاحية
 * @param {Array} permissions - قائمة الصلاحيات
 * @param {string} permission - الصلاحية المطلوبة
 * @returns {boolean} true إذا موجودة
 */
function hasPermission(permissions, permission) {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.indexOf(permission) !== -1;
}

/**
 * التحقق من وجود أي من الصلاحيات
 * @param {Array} permissions - قائمة الصلاحيات
 * @param {Array} requiredPermissions - الصلاحيات المطلوبة
 * @returns {boolean} true إذا موجودة واحدة على الأقل
 */
function hasAnyPermission(permissions, requiredPermissions) {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (!requiredPermissions || !Array.isArray(requiredPermissions)) return false;
  for (let i = 0; i < requiredPermissions.length; i++) {
    if (permissions.indexOf(requiredPermissions[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * التحقق من وجود جميع الصلاحيات
 * @param {Array} permissions - قائمة الصلاحيات
 * @param {Array} requiredPermissions - الصلاحيات المطلوبة
 * @returns {boolean} true إذا جميعها موجودة
 */
function hasAllPermissions(permissions, requiredPermissions) {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (!requiredPermissions || !Array.isArray(requiredPermissions)) return false;
  for (let i = 0; i < requiredPermissions.length; i++) {
    if (permissions.indexOf(requiredPermissions[i]) === -1) {
      return false;
    }
  }
  return true;
}

// ============================================
// دوال معالجة البيانات
// ============================================

/**
 * تجميع البيانات حسب عمود
 * @param {Array} data - البيانات
 * @param {string} groupBy - عمود التجميع
 * @returns {Object} البيانات المجمعة
 */
function groupBy(data, groupBy) {
  const grouped = {};
  for (let i = 0; i < data.length; i++) {
    const key = data[i][groupBy] || 'غير محدد';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(data[i]);
  }
  return grouped;
}

/**
 * حساب الإحصائيات
 * @param {Array} data - البيانات
 * @param {string} field - الحقل
 * @returns {Object} الإحصائيات
 */
function calculateStats(data, field) {
  const values = data.map(function(item) {
    return toNumber(item[field]);
  }).filter(function(val) {
    return val !== 0;
  });
  
  if (values.length === 0) {
    return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
  }
  
  const sum = values.reduce(function(a, b) { return a + b; }, 0);
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  
  return {
    sum: sum,
    avg: sum / values.length,
    min: min,
    max: max,
    count: values.length
  };
}

/**
 * ترتيب البيانات
 * @param {Array} data - البيانات
 * @param {string} field - الحقل
 * @param {boolean} ascending - تصاعدي
 * @returns {Array} البيانات المرتبة
 */
function sortBy(data, field, ascending) {
  const sorted = data.slice();
  sorted.sort(function(a, b) {
    let valA = a[field];
    let valB = b[field];
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });
  return sorted;
}

/**
 * تقسيم البيانات إلى صفحات
 * @param {Array} data - البيانات
 * @param {number} page - رقم الصفحة
 * @param {number} pageSize - حجم الصفحة
 * @returns {Object} البيانات المقسمة
 */
function paginate(data, page, pageSize) {
  const currentPage = Math.max(1, page || 1);
  const size = Math.max(1, pageSize || 20);
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / size);
  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, totalItems);
  const items = data.slice(startIndex, endIndex);
  
  return {
    items: items,
    pagination: {
      currentPage: currentPage,
      pageSize: size,
      totalItems: totalItems,
      totalPages: totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  };
}

// ============================================
// دوال مساعدة للـ Import/Export
// ============================================

/**
 * تحويل CSV إلى مصفوفة
 * @param {string} csv - نص CSV
 * @returns {Array} المصفوفة
 */
function csvToArray(csv) {
  const lines = csv.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = lines[i].split(',').map(function(val) {
      return val.trim().replace(/^"|"$/g, '');
    });
    result.push(values);
  }
  return result;
}

/**
 * تحويل مصفوفة إلى CSV
 * @param {Array} data - البيانات
 * @returns {string} نص CSV
 */
function arrayToCsv(data) {
  if (!data || data.length === 0) return '';
  return data.map(function(row) {
    return row.map(function(cell) {
      const val = cell !== undefined && cell !== null ? cell.toString() : '';
      if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');
}

/**
 * تحويل كائنات إلى CSV
 * @param {Array} objects - الكائنات
 * @param {Array} headers - الأعمدة
 * @returns {string} نص CSV
 */
function objectsToCsv(objects, headers) {
  if (!objects || objects.length === 0) return '';
  const rows = [headers];
  for (let i = 0; i < objects.length; i++) {
    rows.push(objectToRow(headers, objects[i]));
  }
  return arrayToCsv(rows);
}

// ============================================
// دوال مساعدة للأمان
// ============================================

/**
 * تطهير المدخلات
 * @param {string} input - المدخل
 * @returns {string} المدخل النظيف
 */
function sanitizeInput(input) {
  if (!input) return '';
  return input.toString()
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * التحقق من أن المدخل آمن
 * @param {string} input - المدخل
 * @returns {boolean} true إذا آمن
 */
function isSafeInput(input) {
  if (!input) return true;
  const dangerous = /<script|javascript:|on\w+=/i;
  return !dangerous.test(input);
}

/**
 * تشفير بيانات حساسة للعرض
 * @param {string} text - النص
 * @returns {string} النص المشفر
 */
function maskSensitive(text) {
  if (!text || text.length < 4) return '****';
  return text.substring(0, 2) + '****' + text.substring(text.length - 2);
}

// ============================================
// دوال مساعدة عامة
// ============================================

/**
 * الحصول على IP المستخدم (إن أمكن)
 * @returns {string} IP أو unknown
 */
function getClientIP() {
  try {
    return Session.getActiveUser().getEmail() || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * إنشاء رابط للتنزيل
 * @param {string} content - المحتوى
 * @param {string} filename - اسم الملف
 * @param {string} mimeType - نوع الملف
 * @returns {Object} بيانات التنزيل
 */
function createDownload(content, filename, mimeType) {
  return {
    content: Utilities.base64Encode(content),
    filename: filename,
    mimeType: mimeType || 'text/csv'
  };
}

/**
 * نسخ عميق لكائن
 * @param {Object} obj - الكائن
 * @returns {Object} النسخة
 */
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * دمج كائنات
 * @param {Object} target - الكائن الهدف
 * @param {Object} source - الكائن المصدر
 * @returns {Object} الكائن المدمج
 */
function mergeObjects(target, source) {
  const result = deepCopy(target);
  Object.keys(source).forEach(function(key) {
    result[key] = source[key];
  });
  return result;
}

/**
 * الحصول على الفرق بين كائنين
 * @param {Object} oldObj - الكائن القديم
 * @param {Object} newObj - الكائن الجديد
 * @returns {Object} الفروقات
 */
function getObjectDiff(oldObj, newObj) {
  const diff = {};
  const keys = Object.keys(newObj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (oldObj[key] !== newObj[key]) {
      diff[key] = {
        old: oldObj[key],
        new: newObj[key]
      };
    }
  }
  return diff;
}

/**
 * تأخير (Sleep) - استخدم بحذر
 * @param {number} milliseconds - المللي ثانية
 */
function sleep(milliseconds) {
  const start = new Date().getTime();
  while (new Date().getTime() - start < milliseconds) {
    // انتظار
  }
}

/**
 * تقسيم مصفوفة إلى دفعات
 * @param {Array} array - المصفوفة
 * @param {number} size - حجم الدفعة
 * @returns {Array} الدفعات
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * إزالة التكرارات من مصفوفة
 * @param {Array} array - المصفوفة
 * @returns {Array} بدون تكرارات
 */
function uniqueArray(array) {
  return array.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
}

/**
 * عدد المرات التي تظهر فيها قيمة
 * @param {Array} array - المصفوفة
 * @param {any} value - القيمة
 * @returns {number} العدد
 */
function countOccurrences(array, value) {
  return array.filter(function(item) {
    return item === value;
  }).length;
}

/**
 * الحصول على أول N عنصر
 * @param {Array} array - المصفوفة
 * @param {number} n - العدد
 * @returns {Array} العناصر
 */
function take(array, n) {
  return array.slice(0, n);
}

/**
 * الحصول على آخر N عنصر
 * @param {Array} array - المصفوفة
 * @param {number} n - العدد
 * @returns {Array} العناصر
 */
function takeLast(array, n) {
  return array.slice(-n);
}
