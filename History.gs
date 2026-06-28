/**
 * ============================================
 * History.gs - سجل العمليات والتاريخ
 * ============================================
 * 
 * يحتوي على جميع دوال سجل العمليات:
 * - الحصول على سجل شحنة معين
 * - الحصول على جميع العمليات
 * - البحث في السجل
 * - إضافة سجلات تلقائياً
 */

// ============================================
// الحصول على سجل شحنة
// ============================================

/**
 * الحصول على سجل عمليات شحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @returns {Object} السجل
 */
function getShipmentHistoryData(token, shipmentId) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من صلاحية رؤية الشحنة
    const viewAuth = canViewShipment(token, shipmentId);
    if (!viewAuth.valid) {
      return errorResponse(viewAuth.error);
    }
    
    const history = getShipmentHistory(shipmentId);
    
    // تنسيق البيانات
    const formatted = history.map(function(record) {
      return {
        id: record.ID,
        shipmentId: record.ShipmentID,
        employeeId: record.EmployeeID,
        employeeName: record.EmployeeName,
        oldStatus: record.OldStatus,
        newStatus: record.NewStatus,
        notes: record.Notes,
        actionType: record.ActionType,
        timestamp: record.Timestamp
      };
    });
    
    return successResponse(formatted, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Shipment History Data Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// الحصول على جميع العمليات
// ============================================

/**
 * الحصول على جميع عمليات النظام
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} العمليات
 */
function getAllHistory(token, filters) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    // تصفية حسب الموظف إذا لم يكن لديه صلاحية رؤية الكل
    if (!canViewAll) {
      history = history.filter(function(h) {
        return h.EmployeeID === user.id;
      });
    }
    
    // تطبيق فلاتر إضافية
    if (filters) {
      if (filters.shipmentId) {
        history = history.filter(function(h) {
          return h.ShipmentID === filters.shipmentId;
        });
      }
      
      if (filters.employeeId && filters.employeeId !== 'all') {
        history = history.filter(function(h) {
          return h.EmployeeID === filters.employeeId;
        });
      }
      
      if (filters.actionType && filters.actionType !== 'all') {
        history = history.filter(function(h) {
          return h.ActionType === filters.actionType;
        });
      }
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) <= toDate;
        });
      }
    }
    
    // الترتيب حسب التاريخ (الأحدث أولاً)
    history.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    // الترقيم
    const page = filters ? filters.page || 1 : 1;
    const pageSize = filters ? filters.pageSize || 20 : 20;
    const paginated = paginate(history, page, pageSize);
    
    // تنسيق البيانات
    const formatted = paginated.items.map(function(record) {
      return {
        id: record.ID,
        shipmentId: record.ShipmentID,
        employeeId: record.EmployeeID,
        employeeName: record.EmployeeName,
        oldStatus: record.OldStatus,
        newStatus: record.NewStatus,
        notes: record.Notes,
        actionType: record.ActionType,
        timestamp: record.Timestamp
      };
    });
    
    return successResponse({
      history: formatted,
      pagination: paginated.pagination
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get All History Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// الحصول على إحصائيات السجل
// ============================================

/**
 * الحصول على إحصائيات العمليات
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} الإحصائيات
 */
function getHistoryStats(token, filters) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    if (!canViewAll) {
      history = history.filter(function(h) {
        return h.EmployeeID === user.id;
      });
    }
    
    // تطبيق نفس الفلاتر
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) <= toDate;
        });
      }
    }
    
    const stats = {
      totalActions: history.length,
      byActionType: {},
      byEmployee: {},
      byDay: {},
      statusChanges: 0,
      assignments: 0,
      notes: 0
    };
    
    history.forEach(function(h) {
      // حسب نوع العملية
      if (!stats.byActionType[h.ActionType]) {
        stats.byActionType[h.ActionType] = 0;
      }
      stats.byActionType[h.ActionType]++;
      
      // حسب الموظف
      if (h.EmployeeName) {
        if (!stats.byEmployee[h.EmployeeName]) {
          stats.byEmployee[h.EmployeeName] = 0;
        }
        stats.byEmployee[h.EmployeeName]++;
      }
      
      // حسب اليوم
      if (h.Timestamp) {
        const day = formatDate(new Date(h.Timestamp), 'yyyy-MM-dd');
        if (!stats.byDay[day]) {
          stats.byDay[day] = 0;
        }
        stats.byDay[day]++;
      }
      
      // إحصائيات خاصة
      if (h.ActionType === ACTION_TYPES.STATUS_CHANGE) stats.statusChanges++;
      if (h.ActionType === ACTION_TYPES.ASSIGN || h.ActionType === ACTION_TYPES.REASSIGN) stats.assignments++;
      if (h.ActionType === ACTION_TYPES.NOTE_ADDED) stats.notes++;
    });
    
    return successResponse(stats, 'تم بنجاح');
    
  } catch (e) {
    logError('Get History Stats Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// البحث في السجل
// ============================================

/**
 * البحث في سجل العمليات
 * @param {string} token - رمز الجلسة
 * @param {string} query - نص البحث
 * @param {Object} filters - الفلاتر
 * @returns {Object} نتائج البحث
 */
function searchHistoryRecords(token, query, filters) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    if (!canViewAll) {
      history = history.filter(function(h) {
        return h.EmployeeID === user.id;
      });
    }
    
    // البحث النصي
    if (query && query.trim() !== '') {
      const searchTerm = query.toLowerCase().trim();
      history = history.filter(function(h) {
        return (h.EmployeeName && h.EmployeeName.toLowerCase().indexOf(searchTerm) !== -1) ||
               (h.OldStatus && h.OldStatus.toLowerCase().indexOf(searchTerm) !== -1) ||
               (h.NewStatus && h.NewStatus.toLowerCase().indexOf(searchTerm) !== -1) ||
               (h.Notes && h.Notes.toLowerCase().indexOf(searchTerm) !== -1) ||
               (h.ActionType && h.ActionType.toLowerCase().indexOf(searchTerm) !== -1) ||
               (h.ShipmentID && h.ShipmentID.toLowerCase().indexOf(searchTerm) !== -1);
      });
    }
    
    // فلاتر إضافية
    if (filters) {
      if (filters.shipmentId) {
        history = history.filter(function(h) { return h.ShipmentID === filters.shipmentId; });
      }
      if (filters.employeeId && filters.employeeId !== 'all') {
        history = history.filter(function(h) { return h.EmployeeID === filters.employeeId; });
      }
      if (filters.actionType && filters.actionType !== 'all') {
        history = history.filter(function(h) { return h.ActionType === filters.actionType; });
      }
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) >= fromDate;
        });
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        history = history.filter(function(h) {
          if (!h.Timestamp) return false;
          return new Date(h.Timestamp) <= toDate;
        });
      }
    }
    
    // الترتيب
    history.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    // الترقيم
    const page = filters ? filters.page || 1 : 1;
    const pageSize = filters ? filters.pageSize || 20 : 20;
    const paginated = paginate(history, page, pageSize);
    
    const formatted = paginated.items.map(function(record) {
      return {
        id: record.ID,
        shipmentId: record.ShipmentID,
        employeeId: record.EmployeeID,
        employeeName: record.EmployeeName,
        oldStatus: record.OldStatus,
        newStatus: record.NewStatus,
        notes: record.Notes,
        actionType: record.ActionType,
        timestamp: record.Timestamp
      };
    });
    
    return successResponse({
      history: formatted,
      pagination: paginated.pagination,
      totalResults: history.length
    }, 'تم البحث بنجاح');
    
  } catch (e) {
    logError('Search History Records Error', { query: query, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// دوال مساعدة للسجل
// ============================================

/**
 * الحصول على أنواع العمليات الفريدة
 * @param {string} token - رمز الجلسة
 * @returns {Object} أنواع العمليات
 */
function getActionTypes(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const actionTypes = Object.values(ACTION_TYPES);
    
    return successResponse(actionTypes, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Action Types Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على ملخص نشاط موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @param {number} days - عدد الأيام
 * @returns {Object} الملخص
 */
function getEmployeeActivitySummary(token, employeeId, days) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // يمكن للموظف رؤية ملخصه فقط
    if (auth.user.id !== employeeId && !hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS')) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN);
    }
    
    const history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    const cutoffDate = addDays(new Date(), -(days || 30));
    
    const employeeHistory = history.filter(function(h) {
      if (h.EmployeeID !== employeeId) return false;
      if (!h.Timestamp) return false;
      return new Date(h.Timestamp) >= cutoffDate;
    });
    
    const summary = {
      totalActions: employeeHistory.length,
      statusChanges: 0,
      assignments: 0,
      notesAdded: 0,
      updates: 0,
      dailyActivity: {}
    };
    
    employeeHistory.forEach(function(h) {
      if (h.ActionType === ACTION_TYPES.STATUS_CHANGE) summary.statusChanges++;
      if (h.ActionType === ACTION_TYPES.ASSIGN || h.ActionType === ACTION_TYPES.REASSIGN) summary.assignments++;
      if (h.ActionType === ACTION_TYPES.NOTE_ADDED) summary.notesAdded++;
      if (h.ActionType === ACTION_TYPES.UPDATE) summary.updates++;
      
      const day = formatDate(new Date(h.Timestamp), 'yyyy-MM-dd');
      if (!summary.dailyActivity[day]) {
        summary.dailyActivity[day] = 0;
      }
      summary.dailyActivity[day]++;
    });
    
    return successResponse(summary, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employee Activity Summary Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
