/**
 * ============================================
 * Search.gs - البحث المتقدم
 * ============================================
 * 
 * يحتوي على جميع دوال البحث المتقدم:
 * - البحث في الشحنات
 * - البحث في الموظفين
 * - البحث في السجل
 * - الفلاتر المتقدمة
 */

// ============================================
// البحث في الشحنات
// ============================================

/**
 * البحث المتقدم في الشحنات
 * @param {string} token - رمز الجلسة
 * @param {Object} params - معاملات البحث
 * @returns {Object} نتائج البحث
 */
function advancedSearch(token, params) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    // تصفية حسب الموظف إذا لم يكن لديه صلاحية رؤية الكل
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === user.id;
      });
    }
    
    // تصفية غير مؤرشفة افتراضياً
    const includeArchived = params.includeArchived === true || params.includeArchived === 'true';
    if (!includeArchived) {
      shipments = shipments.filter(function(s) {
        return s.IsArchived !== 'true' && s.IsArchived !== true;
      });
    }
    
    // البحث النصي
    if (params.query && params.query.trim() !== '') {
      const query = params.query.toLowerCase().trim();
      shipments = shipments.filter(function(s) {
        return (s.TrackingNumber && s.TrackingNumber.toLowerCase().indexOf(query) !== -1) ||
               (s.OrderCode && s.OrderCode.toLowerCase().indexOf(query) !== -1) ||
               (s.CustomerName && s.CustomerName.toLowerCase().indexOf(query) !== -1) ||
               (s.Phone && s.Phone.indexOf(query) !== -1) ||
               (s.SecondPhone && s.SecondPhone.indexOf(query) !== -1) ||
               (s.ProductName && s.ProductName.toLowerCase().indexOf(query) !== -1) ||
               (s.Governorate && s.Governorate.toLowerCase().indexOf(query) !== -1) ||
               (s.City && s.City.toLowerCase().indexOf(query) !== -1) ||
               (s.Branch && s.Branch.toLowerCase().indexOf(query) !== -1) ||
               (s.Address && s.Address.toLowerCase().indexOf(query) !== -1) ||
               (s.Notes && s.Notes.toLowerCase().indexOf(query) !== -1) ||
               (s.Tags && s.Tags.toLowerCase().indexOf(query) !== -1);
      });
    }
    
    // فلاتر محددة
    if (params.trackingNumber) {
      shipments = shipments.filter(function(s) {
        return s.TrackingNumber && s.TrackingNumber.toLowerCase().indexOf(params.trackingNumber.toLowerCase()) !== -1;
      });
    }
    
    if (params.orderCode) {
      shipments = shipments.filter(function(s) {
        return s.OrderCode && s.OrderCode.toLowerCase().indexOf(params.orderCode.toLowerCase()) !== -1;
      });
    }
    
    if (params.customerName) {
      shipments = shipments.filter(function(s) {
        return s.CustomerName && s.CustomerName.toLowerCase().indexOf(params.customerName.toLowerCase()) !== -1;
      });
    }
    
    if (params.phone) {
      const phoneQuery = cleanPhone(params.phone);
      shipments = shipments.filter(function(s) {
        return (s.Phone && s.Phone.indexOf(phoneQuery) !== -1) ||
               (s.SecondPhone && s.SecondPhone.indexOf(phoneQuery) !== -1);
      });
    }
    
    if (params.governorate && params.governorate !== 'all') {
      shipments = shipments.filter(function(s) { return s.Governorate === params.governorate; });
    }
    
    if (params.city && params.city !== 'all') {
      shipments = shipments.filter(function(s) { return s.City === params.city; });
    }
    
    if (params.branch && params.branch !== 'all') {
      shipments = shipments.filter(function(s) { return s.Branch === params.branch; });
    }
    
    if (params.productName) {
      shipments = shipments.filter(function(s) {
        return s.ProductName && s.ProductName.toLowerCase().indexOf(params.productName.toLowerCase()) !== -1;
      });
    }
    
    if (params.status && params.status !== 'all') {
      shipments = shipments.filter(function(s) { return s.Status === params.status; });
    }
    
    if (params.priority && params.priority !== 'all') {
      shipments = shipments.filter(function(s) { return s.Priority === params.priority; });
    }
    
    if (params.assignedEmployee && params.assignedEmployee !== 'all') {
      shipments = shipments.filter(function(s) { return s.AssignedEmployee === params.assignedEmployee; });
    }
    
    // فلتر السعر
    if (params.minPrice) {
      shipments = shipments.filter(function(s) { return toNumber(s.Price) >= toNumber(params.minPrice); });
    }
    
    if (params.maxPrice) {
      shipments = shipments.filter(function(s) { return toNumber(s.Price) <= toNumber(params.maxPrice); });
    }
    
    // فلتر التاريخ
    if (params.dateFrom) {
      const fromDate = new Date(params.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      shipments = shipments.filter(function(s) {
        if (!s.CreatedAt) return false;
        const d = new Date(s.CreatedAt);
        d.setHours(0, 0, 0, 0);
        return d >= fromDate;
      });
    }
    
    if (params.dateTo) {
      const toDate = new Date(params.dateTo);
      toDate.setHours(23, 59, 59, 999);
      shipments = shipments.filter(function(s) {
        if (!s.CreatedAt) return false;
        const d = new Date(s.CreatedAt);
        return d <= toDate;
      });
    }
    
    // فلتر آخر متابعة
    if (params.lastFollowUp) {
      const hours = parseInt(params.lastFollowUp);
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hours);
      shipments = shipments.filter(function(s) {
        if (!s.LastFollowUp) return true;
        return new Date(s.LastFollowUp) < cutoff;
      });
    }
    
    // فلتر "لا يرد" أكثر من
    if (params.noAnswerCount) {
      shipments = shipments.filter(function(s) {
        return parseInt(s.NoAnswerCount || 0) >= parseInt(params.noAnswerCount);
      });
    }
    
    // الترتيب
    const sortField = params.sortBy || 'UpdatedAt';
    const sortOrder = params.sortOrder || 'desc';
    
    shipments.sort(function(a, b) {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (sortField === 'Price' || sortField === 'CODAmount') {
        valA = toNumber(valA);
        valB = toNumber(valB);
      } else if (sortField === 'CreatedAt' || sortField === 'UpdatedAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    // الترقيم
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const paginated = paginate(shipments, page, pageSize);
    
    // تنسيق البيانات
    const formattedShipments = paginated.items.map(function(s) {
      return formatShipmentForDisplay(s);
    });
    
    return successResponse({
      shipments: formattedShipments,
      pagination: paginated.pagination,
      totalResults: shipments.length,
      filters: params
    }, 'تم البحث بنجاح');
    
  } catch (e) {
    logError('Advanced Search Error', { params: params, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// البحث السريع (Quick Search)
// ============================================

/**
 * البحث السريع
 * @param {string} token - رمز الجلسة
 * @param {string} query - نص البحث
 * @returns {Object} نتائج البحث
 */
function quickSearch(token, query) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!query || query.trim() === '') {
      return errorResponse('يرجى إدخال نص للبحث');
    }
    
    return advancedSearch(token, { query: query.trim() });
    
  } catch (e) {
    logError('Quick Search Error', { query: query, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// البحث في السجل
// ============================================

/**
 * البحث في سجل العمليات
 * @param {string} token - رمز الجلسة
 * @param {Object} params - معاملات البحث
 * @returns {Object} نتائج البحث
 */
function searchHistory(token, params) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    // تصفية حسب الموظف
    if (!canViewAll) {
      history = history.filter(function(h) {
        return h.EmployeeID === user.id;
      });
    }
    
    // البحث النصي
    if (params.query) {
      const query = params.query.toLowerCase();
      history = history.filter(function(h) {
        return (h.EmployeeName && h.EmployeeName.toLowerCase().indexOf(query) !== -1) ||
               (h.OldStatus && h.OldStatus.toLowerCase().indexOf(query) !== -1) ||
               (h.NewStatus && h.NewStatus.toLowerCase().indexOf(query) !== -1) ||
               (h.Notes && h.Notes.toLowerCase().indexOf(query) !== -1) ||
               (h.ActionType && h.ActionType.toLowerCase().indexOf(query) !== -1);
      });
    }
    
    // فلاتر
    if (params.shipmentId) {
      history = history.filter(function(h) { return h.ShipmentID === params.shipmentId; });
    }
    
    if (params.employeeId && params.employeeId !== 'all') {
      history = history.filter(function(h) { return h.EmployeeID === params.employeeId; });
    }
    
    if (params.actionType && params.actionType !== 'all') {
      history = history.filter(function(h) { return h.ActionType === params.actionType; });
    }
    
    if (params.dateFrom) {
      const fromDate = new Date(params.dateFrom);
      history = history.filter(function(h) {
        if (!h.Timestamp) return false;
        return new Date(h.Timestamp) >= fromDate;
      });
    }
    
    if (params.dateTo) {
      const toDate = new Date(params.dateTo);
      toDate.setHours(23, 59, 59, 999);
      history = history.filter(function(h) {
        if (!h.Timestamp) return false;
        return new Date(h.Timestamp) <= toDate;
      });
    }
    
    // الترتيب
    history.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    // الترقيم
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const paginated = paginate(history, page, pageSize);
    
    return successResponse({
      history: paginated.items,
      pagination: paginated.pagination,
      totalResults: history.length
    }, 'تم البحث بنجاح');
    
  } catch (e) {
    logError('Search History Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// الحصول على خيارات الفلاتر
// ============================================

/**
 * الحصول على قيم فريدة للفلاتر
 * @param {string} token - رمز الجلسة
 * @returns {Object} خيارات الفلاتر
 */
function getSearchFilterOptions(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    // المحافظات الفريدة
    const governorates = [];
    const cities = [];
    const branches = [];
    const products = [];
    
    shipments.forEach(function(s) {
      if (s.Governorate && governorates.indexOf(s.Governorate) === -1) {
        governorates.push(s.Governorate);
      }
      if (s.City && cities.indexOf(s.City) === -1) {
        cities.push(s.City);
      }
      if (s.Branch && branches.indexOf(s.Branch) === -1) {
        branches.push(s.Branch);
      }
      if (s.ProductName && products.indexOf(s.ProductName) === -1) {
        products.push(s.ProductName);
      }
    });
    
    // الموظفين
    const employees = getActiveEmployees(false).map(function(e) {
      return {
        id: e.ID,
        name: e.Name || e.Username
      };
    });
    
    return successResponse({
      governorates: governorates.sort(),
      cities: cities.sort(),
      branches: branches.sort(),
      products: products.sort(),
      employees: employees,
      statuses: Object.values(SHIPMENT_STATUS),
      priorities: Object.values(PRIORITY),
      actionTypes: Object.values(ACTION_TYPES)
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Filter Options Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
