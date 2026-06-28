/**
 * ============================================
 * Settings.gs - إدارة الإعدادات
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة إعدادات النظام:
 * - الحصول على الإعدادات
 * - تحديث الإعدادات
 * - إعادة تعيين للافتراضية
 * - التحقق من صحة الإعدادات
 */

// ============================================
// الحصول على الإعدادات
// ============================================

/**
 * الحصول على جميع إعدادات النظام (API wrapper)
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإعدادات ككائن
 */
function getSettingsData(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const settings = getAllSettings();
    
    return successResponse(settings, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Settings Data Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على إعداد واحد (API wrapper)
 * @param {string} token - رمز الجلسة
 * @param {string} key - مفتاح الإعداد
 * @returns {Object} الإعداد
 */
function getSettingData(token, key) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (isEmpty(key)) {
      return errorResponse('مفتاح الإعداد مطلوب');
    }
    
    const value = getSetting(key);
    
    return successResponse({
      key: key,
      value: value
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Setting Data Error', { key: key, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تحديث الإعدادات
// ============================================

/**
 * تحديث إعداد (API wrapper)
 * @param {string} token - رمز الجلسة
 * @param {string} key - المفتاح
 * @param {string} value - القيمة
 * @returns {Object} النتيجة
 */
function updateSettingData(token, key, value) {
  try {
    const auth = requirePermission(token, 'MANAGE_SETTINGS');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (isEmpty(key)) {
      return errorResponse('مفتاح الإعداد مطلوب');
    }
    
    // التحقق من صحة القيمة
    const validation = validateSetting(key, value);
    if (!validation.valid) {
      return errorResponse(validation.message);
    }
    
    const result = updateSetting(key, value, auth.user.username);
    
    if (result.success) {
      logAction('SETTING_UPDATED', auth.user.username, { key: key, value: value });
      return successResponse(null, 'تم تحديث الإعداد بنجاح');
    }
    
    return errorResponse('فشل في تحديث الإعداد');
    
  } catch (e) {
    logError('Update Setting Data Error', { key: key, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديث عدة إعدادات دفعة واحدة
 * @param {string} token - رمز الجلسة
 * @param {Object} settings - كائن الإعدادات
 * @returns {Object} النتيجة
 */
function updateMultipleSettings(token, settings) {
  try {
    const auth = requirePermission(token, 'MANAGE_SETTINGS');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!settings || typeof settings !== 'object') {
      return errorResponse('بيانات الإعدادات غير صحيحة');
    }
    
    const keys = Object.keys(settings);
    let updatedCount = 0;
    const errors = [];
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = settings[key];
      
      // التحقق من صحة القيمة
      const validation = validateSetting(key, value);
      if (!validation.valid) {
        errors.push({ key: key, error: validation.message });
        continue;
      }
      
      const result = updateSetting(key, value, auth.user.username);
      
      if (result.success) {
        updatedCount++;
      } else {
        errors.push({ key: key, error: result.message });
      }
    }
    
    if (errors.length > 0 && updatedCount === 0) {
      return errorResponse('فشل في تحديث جميع الإعدادات', { errors: errors });
    }
    
    logAction('MULTIPLE_SETTINGS_UPDATED', auth.user.username, {
      updated: updatedCount,
      errors: errors.length
    });
    
    return successResponse({
      updated: updatedCount,
      errors: errors
    }, 'تم تحديث ' + updatedCount + ' إعداد' + (errors.length > 0 ? '، ' + errors.length + ' خطأ' : ''));
    
  } catch (e) {
    logError('Update Multiple Settings Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إعادة تعيين الإعدادات
// ============================================

/**
 * إعادة تعيين جميع الإعدادات للافتراضية
 * @param {string} token - رمز الجلسة
 * @returns {Object} النتيجة
 */
function resetSettingsToDefault(token) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    
    if (!sheet) {
      return errorResponse('ورقة الإعدادات غير موجودة');
    }
    
    // حذف جميع البيانات ما عدا Header
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    
    // إضافة الإعدادات الافتراضية
    const defaultKeys = Object.keys(DEFAULT_SETTINGS);
    const rows = [];
    
    for (let i = 0; i < defaultKeys.length; i++) {
      const key = defaultKeys[i];
      rows.push([
        key,
        DEFAULT_SETTINGS[key],
        getCurrentDateTime(),
        auth.user.username
      ]);
    }
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    // تفريغ Cache
    cacheRemove(CACHE_KEYS.SETTINGS);
    const cacheKeys = Object.keys(DEFAULT_SETTINGS);
    for (let i = 0; i < cacheKeys.length; i++) {
      cacheRemove(CACHE_KEYS.SETTINGS + '_' + cacheKeys[i]);
    }
    
    logAction('SETTINGS_RESET', auth.user.username, { count: rows.length });
    
    return successResponse(null, 'تم إعادة تعيين الإعدادات للافتراضية');
    
  } catch (e) {
    logError('Reset Settings Error', { error: e.message });
    return errorResponse('فشل في إعادة التعيين: ' + e.message);
  }
}

// ============================================
// التحقق من صحة الإعدادات
// ============================================

/**
 * التحقق من صحة قيمة إعداد
 * @param {string} key - المفتاح
 * @param {string} value - القيمة
 * @returns {Object} نتيجة التحقق
 */
function validateSetting(key, value) {
  const validators = {
    'ARCHIVE_AFTER_DAYS': function(v) {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 365;
    },
    'NO_ANSWER_THRESHOLD': function(v) {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 10;
    },
    'FOLLOW_UP_REMINDER_HOURS': function(v) {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 168;
    },
    'POSTPONED_REMINDER_HOURS': function(v) {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 168;
    },
    'NOTIFICATION_ENABLED': function(v) {
      return v === 'true' || v === 'false';
    },
    'AUTO_ARCHIVE_ENABLED': function(v) {
      return v === 'true' || v === 'false';
    },
    'THEME': function(v) {
      return v === 'light' || v === 'dark';
    }
  };
  
  if (validators[key] && !validators[key](value)) {
    return {
      valid: false,
      message: 'قيمة غير صحيحة للإعداد: ' + key
    };
  }
  
  return { valid: true };
}

// ============================================
// دوال مساعدة للإعدادات
// ============================================

/**
 * الحصول على إعدادات النظام للعرض
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإعدادات
 */
function getSettingsForDisplay(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const settings = getAllSettings();
    const canManage = hasPermission(auth.user.permissions, 'MANAGE_SETTINGS');
    
    // تصنيف الإعدادات
    const categorized = {
      general: [],
      notifications: [],
      archive: [],
      display: []
    };
    
    const categoryMap = {
      'SYSTEM_NAME': 'general',
      'SYSTEM_LOGO': 'general',
      'DEFAULT_GOVERNORATE': 'general',
      'DEFAULT_BRANCH': 'general',
      'COMPANY_NAME': 'general',
      'COMPANY_PHONE': 'general',
      'COMPANY_ADDRESS': 'general',
      'CURRENCY': 'general',
      
      'NOTIFICATION_ENABLED': 'notifications',
      'FOLLOW_UP_REMINDER_HOURS': 'notifications',
      'POSTPONED_REMINDER_HOURS': 'notifications',
      
      'AUTO_ARCHIVE_ENABLED': 'archive',
      'ARCHIVE_AFTER_DAYS': 'archive',
      'NO_ANSWER_THRESHOLD': 'archive',
      
      'THEME': 'display',
      'DATE_FORMAT': 'display'
    };
    
    const settingLabels = {
      'SYSTEM_NAME': 'اسم النظام',
      'SYSTEM_LOGO': 'شعار النظام',
      'DEFAULT_GOVERNORATE': 'المحافظة الافتراضية',
      'DEFAULT_BRANCH': 'الفرع الافتراضي',
      'COMPANY_NAME': 'اسم الشركة',
      'COMPANY_PHONE': 'هاتف الشركة',
      'COMPANY_ADDRESS': 'عنوان الشركة',
      'CURRENCY': 'العملة',
      'NOTIFICATION_ENABLED': 'تفعيل الإشعارات',
      'FOLLOW_UP_REMINDER_HOURS': 'تذكير المتابعة (ساعات)',
      'POSTPONED_REMINDER_HOURS': 'تذكير المؤجل (ساعات)',
      'AUTO_ARCHIVE_ENABLED': 'الأرشفة التلقائية',
      'ARCHIVE_AFTER_DAYS': 'أرشفة بعد (أيام)',
      'NO_ANSWER_THRESHOLD': 'حد "لا يرد"',
      'THEME': 'السمة',
      'DATE_FORMAT': 'تنسيق التاريخ'
    };
    
    const settingTypes = {
      'SYSTEM_NAME': 'text',
      'SYSTEM_LOGO': 'text',
      'DEFAULT_GOVERNORATE': 'select',
      'DEFAULT_BRANCH': 'text',
      'COMPANY_NAME': 'text',
      'COMPANY_PHONE': 'text',
      'COMPANY_ADDRESS': 'textarea',
      'CURRENCY': 'text',
      'NOTIFICATION_ENABLED': 'boolean',
      'FOLLOW_UP_REMINDER_HOURS': 'number',
      'POSTPONED_REMINDER_HOURS': 'number',
      'AUTO_ARCHIVE_ENABLED': 'boolean',
      'ARCHIVE_AFTER_DAYS': 'number',
      'NO_ANSWER_THRESHOLD': 'number',
      'THEME': 'select',
      'DATE_FORMAT': 'select'
    };
    
    const keys = Object.keys(settings);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const category = categoryMap[key] || 'general';
      
      categorized[category].push({
        key: key,
        label: settingLabels[key] || key,
        value: settings[key],
        type: settingTypes[key] || 'text',
        editable: canManage
      });
    }
    
    return successResponse({
      settings: categorized,
      canManage: canManage
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Settings For Display Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تهيئة الإعدادات الافتراضية إذا لم تكن موجودة
 * @returns {Object} النتيجة
 */
function initializeSettingsIfNeeded() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    
    if (!sheet) {
      return errorResponse('ورقة الإعدادات غير موجودة');
    }
    
    const data = sheet.getDataRange().getValues();
    const existingKeys = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        existingKeys.push(data[i][0]);
      }
    }
    
    const defaultKeys = Object.keys(DEFAULT_SETTINGS);
    let addedCount = 0;
    
    for (let i = 0; i < defaultKeys.length; i++) {
      const key = defaultKeys[i];
      if (existingKeys.indexOf(key) === -1) {
        // إضافة الإعداد المفقود
        const newRow = [
          key,
          DEFAULT_SETTINGS[key],
          getCurrentDateTime(),
          'System'
        ];
        sheet.appendRow(newRow);
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      cacheRemove(CACHE_KEYS.SETTINGS);
    }
    
    return successResponse({ added: addedCount }, 'تم التحقق من الإعدادات');
    
  } catch (e) {
    logError('Initialize Settings Error', { error: e.message });
    return errorResponse('فشل في تهيئة الإعدادات');
  }
}
