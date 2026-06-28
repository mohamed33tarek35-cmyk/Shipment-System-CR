/**
 * ============================================
 * Logs.gs - إدارة السجلات والسجلات
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة سجلات النظام:
 * - عرض السجلات
 * - البحث في السجلات
 * - إحصائيات السجلات
 * - تصدير السجلات
 * - تنظيف السجلات القديمة
 * 
 * ملاحظة: دوال الكتابة (logError, logAction) موجودة في Utils.gs
 */

// ============================================
// الحصول على السجلات
// ============================================

/**
 * الحصول على سجلات النظام
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} السجلات
 */
function getLogs(token, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let logs = getSheetDataAsObjects(SHEET_NAMES.LOGS, false);
    
    // تطبيق فلاتر
    if (filters) {
      if (filters.action && filters.action !== 'all') {
        logs = logs.filter(function(l) {
          return l.Action && l.Action.indexOf(filters.action) !== -1;
        });
      }
      
      if (filters.user && filters.user !== 'all') {
        logs = logs.filter(function(l) {
          return l.User === filters.user;
        });
      }
      
      if (filters.type && filters.type === 'error') {
        logs = logs.filter(function(l) {
          return l.Action && l.Action.indexOf('ERROR:') === 0;
        });
      }
      
      if (filters.type && filters.type === 'action') {
        logs = logs.filter(function(l) {
          return l.Action && l.Action.indexOf('ERROR:') !== 0;
        });
      }
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) <= toDate;
        });
      }
    }
    
    // الترتيب (الأحدث أولاً)
    logs.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    // الترقيم
    const page = filters ? filters.page || 1 : 1;
    const pageSize = filters ? filters.pageSize || 50 : 50;
    const paginated = paginate(logs, page, pageSize);
    
    // تنسيق البيانات
    const formatted = paginated.items.map(function(l) {
      return {
        id: l.ID,
        action: l.Action,
        user: l.User,
        details: l.Details,
        timestamp: l.Timestamp,
        isError: l.Action && l.Action.indexOf('ERROR:') === 0
      };
    });
    
    return successResponse({
      logs: formatted,
      pagination: paginated.pagination,
      total: logs.length
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Logs Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// البحث في السجلات
// ============================================

/**
 * البحث في سجلات النظام
 * @param {string} token - رمز الجلسة
 * @param {string} query - نص البحث
 * @param {Object} filters - الفلاتر الإضافية
 * @returns {Object} نتائج البحث
 */
function searchLogs(token, query, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let logs = getSheetDataAsObjects(SHEET_NAMES.LOGS, false);
    
    // البحث النصي
    if (query && query.trim() !== '') {
      const searchTerm = query.toLowerCase().trim();
      logs = logs.filter(function(l) {
        return (l.Action && l.Action.toLowerCase().indexOf(searchTerm) !== -1) ||
               (l.User && l.User.toLowerCase().indexOf(searchTerm) !== -1) ||
               (l.Details && l.Details.toLowerCase().indexOf(searchTerm) !== -1);
      });
    }
    
    // فلاتر إضافية
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) <= toDate;
        });
      }
      
      if (filters.type && filters.type === 'error') {
        logs = logs.filter(function(l) {
          return l.Action && l.Action.indexOf('ERROR:') === 0;
        });
      }
    }
    
    // الترتيب
    logs.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    // الترقيم
    const page = filters ? filters.page || 1 : 1;
    const pageSize = filters ? filters.pageSize || 50 : 50;
    const paginated = paginate(logs, page, pageSize);
    
    const formatted = paginated.items.map(function(l) {
      return {
        id: l.ID,
        action: l.Action,
        user: l.User,
        details: l.Details,
        timestamp: l.Timestamp,
        isError: l.Action && l.Action.indexOf('ERROR:') === 0
      };
    });
    
    return successResponse({
      logs: formatted,
      pagination: paginated.pagination,
      totalResults: logs.length
    }, 'تم البحث بنجاح');
    
  } catch (e) {
    logError('Search Logs Error', { query: query, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إحصائيات السجلات
// ============================================

/**
 * الحصول على إحصائيات السجلات
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} الإحصائيات
 */
function getLogStats(token, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let logs = getSheetDataAsObjects(SHEET_NAMES.LOGS, false);
    
    // تطبيق فلاتر التاريخ
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) <= toDate;
        });
      }
    }
    
    const stats = {
      totalLogs: logs.length,
      totalErrors: 0,
      totalActions: 0,
      byAction: {},
      byUser: {},
      byDay: {},
      recentErrors: []
    };
    
    logs.forEach(function(l) {
      const isError = l.Action && l.Action.indexOf('ERROR:') === 0;
      const actionName = isError ? l.Action.substring(6).trim() : l.Action;
      
      if (isError) {
        stats.totalErrors++;
      } else {
        stats.totalActions++;
      }
      
      // حسب نوع العملية
      if (!stats.byAction[actionName]) {
        stats.byAction[actionName] = { count: 0, errors: 0 };
      }
      stats.byAction[actionName].count++;
      if (isError) stats.byAction[actionName].errors++;
      
      // حسب المستخدم
      const user = l.User || 'System';
      if (!stats.byUser[user]) {
        stats.byUser[user] = { count: 0, errors: 0 };
      }
      stats.byUser[user].count++;
      if (isError) stats.byUser[user].errors++;
      
      // حسب اليوم
      if (l.Timestamp) {
        const day = formatDate(new Date(l.Timestamp), 'yyyy-MM-dd');
        if (!stats.byDay[day]) {
          stats.byDay[day] = { count: 0, errors: 0 };
        }
        stats.byDay[day].count++;
        if (isError) stats.byDay[day].errors++;
      }
    });
    
    // آخر 5 أخطاء
    stats.recentErrors = logs
      .filter(function(l) { return l.Action && l.Action.indexOf('ERROR:') === 0; })
      .slice(0, 5)
      .map(function(l) {
        return {
          action: l.Action.substring(6).trim(),
          details: l.Details,
          timestamp: l.Timestamp
        };
      });
    
    return successResponse(stats, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Log Stats Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تصدير السجلات
// ============================================

/**
 * تصدير السجلات كـ CSV
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} بيانات التصدير
 */
function exportLogsCsv(token, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let logs = getSheetDataAsObjects(SHEET_NAMES.LOGS, false);
    
    // تطبيق فلاتر
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        logs = logs.filter(function(l) {
          if (!l.Timestamp) return false;
          return new Date(l.Timestamp) <= toDate;
        });
      }
      
      if (filters.type && filters.type === 'error') {
        logs = logs.filter(function(l) {
          return l.Action && l.Action.indexOf('ERROR:') === 0;
        });
      }
    }
    
    if (logs.length === 0) {
      return errorResponse('لا توجد سجلات للتصدير');
    }
    
    // ترتيب حسب التاريخ
    logs.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    const exportHeaders = ['ID', 'Action', 'User', 'Details', 'Timestamp'];
    const csv = objectsToCsv(logs, exportHeaders);
    
    logAction('LOGS_EXPORTED', auth.user.username, { count: logs.length });
    
    return successResponse({
      content: csv,
      filename: 'system_logs_' + formatDate(new Date(), 'yyyy-MM-dd') + '.csv',
      count: logs.length
    }, 'تم التصدير بنجاح');
    
  } catch (e) {
    logError('Export Logs CSV Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.EXPORT_ERROR);
  }
}

// ============================================
// تنظيف السجلات
// ============================================

/**
 * حذف السجلات القديمة
 * @param {string} token - رمز الجلسة
 * @param {number} days - حذف سجلات أقدم من هذا العدد من الأيام
 * @returns {Object} النتيجة
 */
function clearOldLogs(token, days) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const cutoffDays = days || 30;
    const cutoffDate = addDays(new Date(), -cutoffDays);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    
    if (!sheet) {
      return errorResponse('ورقة السجلات غير موجودة');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const timestampIndex = headers.indexOf('Timestamp');
    
    if (timestampIndex === -1) {
      return errorResponse('عمود التاريخ غير موجود');
    }
    
    const rowsToDelete = [];
    
    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][timestampIndex];
      if (timestamp) {
        const logDate = new Date(timestamp);
        if (logDate < cutoffDate) {
          rowsToDelete.push(i + 1);
        }
      }
    }
    
    if (rowsToDelete.length === 0) {
      return successResponse({ count: 0 }, 'لا توجد سجلات قديمة للحذف');
    }
    
    // حذف من الأسفل للأعلى
    rowsToDelete.sort(function(a, b) { return b - a; });
    
    for (let i = 0; i < rowsToDelete.length; i++) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    
    logAction('OLD_LOGS_CLEARED', auth.user.username, {
      days: cutoffDays,
      count: rowsToDelete.length
    });
    
    return successResponse({
      count: rowsToDelete.length,
      days: cutoffDays
    }, 'تم حذف ' + rowsToDelete.length + ' سجل قديم');
    
  } catch (e) {
    logError('Clear Old Logs Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على قائمة المستخدمين المسجلين في السجلات
 * @param {string} token - رمز الجلسة
 * @returns {Object} قائمة المستخدمين
 */
function getLogUsers(token) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const logs = getSheetDataAsObjects(SHEET_NAMES.LOGS, false);
    const users = [];
    
    logs.forEach(function(l) {
      const user = l.User || 'System';
      if (users.indexOf(user) === -1) {
        users.push(user);
      }
    });
    
    return successResponse(users.sort(), 'تم بنجاح');
    
  } catch (e) {
    logError('Get Log Users Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
