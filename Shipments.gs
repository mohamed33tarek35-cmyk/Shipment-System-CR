/**
 * ============================================
 * Shipments.gs - إدارة الشحنات
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة الشحنات:
 * - CRUD للشحنات
 * - تحديث الحالة
 * - إضافة ملاحظات
 * - البحث والتصفية
 * - الاستيراد والتصدير
 */

// ============================================
// الحصول على قائمة الشحنات
// ============================================

/**
 * الحصول على قائمة الشحنات مع التصفية والترقيم
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @param {Object} pagination - الترقيم
 * @returns {Object} قائمة الشحنات
 */
function getShipmentsList(token, filters, pagination) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    // بناء الفلاتر
    const queryFilters = filters || {};
    
    // إذا كان موظف عادي، يعرض شحناته فقط
    if (!canViewAll) {
      queryFilters.assignedEmployee = user.id;
    }
    
    // الحصول على البيانات
    let shipments = getShipments(queryFilters, false);
    
    // الترتيب (افتراضي: الأحدث)
    shipments.sort(function(a, b) {
      return new Date(b.UpdatedAt || b.CreatedAt) - new Date(a.UpdatedAt || a.CreatedAt);
    });
    
    // الترقيم
    const page = pagination ? pagination.page || 1 : 1;
    const pageSize = pagination ? pagination.pageSize || 20 : 20;
    const paginated = paginate(shipments, page, pageSize);
    
    // تنسيق البيانات للعرض
    const formattedShipments = paginated.items.map(function(s) {
      return formatShipmentForDisplay(s);
    });
    
    return successResponse({
      shipments: formattedShipments,
      pagination: paginated.pagination,
      filters: queryFilters
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Shipments List Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على تفاصيل شحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @returns {Object} تفاصيل الشحنة
 */
function getShipmentDetail(token, shipmentId) {
  try {
    // التحقق من الصلاحيات
    const auth = canViewShipment(token, shipmentId);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // الحصول على سجل التحديثات
    const history = getShipmentHistory(shipmentId);
    
    // الحصول على معلومات الموظف المسؤول
    let assignedEmployeeName = '';
    if (shipment.AssignedEmployee) {
      const emp = getEmployeeById(shipment.AssignedEmployee);
      assignedEmployeeName = emp ? (emp.Name || emp.Username) : '';
    }
    
    // تنسيق البيانات
    const detail = formatShipmentForDisplay(shipment);
    detail.assignedEmployeeName = assignedEmployeeName;
    detail.history = history;
    
    return successResponse(detail, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Shipment Detail Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إنشاء شحنة جديدة
// ============================================

/**
 * إنشاء شحنة جديدة
 * @param {string} token - رمز الجلسة
 * @param {Object} shipment - بيانات الشحنة
 * @returns {Object} نتيجة الإنشاء
 */
function createShipment(token, shipment) {
  try {
    const auth = requirePermission(token, 'ADD_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من البيانات
    const validation = validateShipment(shipment);
    if (!validation.valid) {
      return errorResponse(ERROR_MESSAGES.VALIDATION_ERROR, { errors: validation.errors });
    }
    
    // إنشاء الشحنة
    const newShipment = {
      ID: generateId('SHP'),
      TrackingNumber: shipment.TrackingNumber || '',
      OrderCode: shipment.OrderCode || '',
      CustomerName: shipment.CustomerName || '',
      Phone: cleanPhone(shipment.Phone) || '',
      SecondPhone: cleanPhone(shipment.SecondPhone) || '',
      Governorate: shipment.Governorate || '',
      City: shipment.City || '',
      Branch: shipment.Branch || '',
      Address: shipment.Address || '',
      ProductName: shipment.ProductName || '',
      Quantity: shipment.Quantity || '1',
      Price: toNumber(shipment.Price) || 0,
      CODAmount: toNumber(shipment.CODAmount) || 0,
      Status: SHIPMENT_STATUS.UNASSIGNED,
      AssignedEmployee: '',
      AssignedBy: '',
      AssignedDate: '',
      LastFollowUp: '',
      NextFollowUp: '',
      Notes: shipment.Notes || '',
      Priority: shipment.Priority || PRIORITY.NORMAL,
      Tags: shipment.Tags || '',
      CreatedAt: getCurrentDateTime(),
      UpdatedAt: getCurrentDateTime(),
      NoAnswerCount: '0',
      IsArchived: 'false'
    };
    
    const result = insertRow(SHEET_NAMES.SHIPMENTS, newShipment);
    
    if (result.success) {
      // إضافة سجل
      addHistoryRecord({
        shipmentId: newShipment.ID,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        actionType: ACTION_TYPES.CREATE,
        notes: 'إنشاء شحنة جديدة'
      });
      
      // إشعار
      addNotification({
        type: NOTIFICATION_TYPES.UNASSIGNED_SHIPMENTS,
        message: 'شحنة جديدة غير موزعة: ' + newShipment.TrackingNumber,
        forUser: 'all'
      });
      
      logAction(ACTION_TYPES.CREATE, auth.user.username, {
        shipmentId: newShipment.ID,
        trackingNumber: newShipment.TrackingNumber
      });
      
      return successResponse({ id: newShipment.ID }, SUCCESS_MESSAGES.CREATED);
    }
    
    return errorResponse('فشل في إنشاء الشحنة');
    
  } catch (e) {
    logError('Create Shipment Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تحديث شحنة
// ============================================

/**
 * تحديث بيانات شحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @param {Object} shipment - البيانات الجديدة
 * @returns {Object} نتيجة التحديث
 */
function updateShipmentData(token, shipmentId, shipment) {
  try {
    const auth = requirePermission(token, 'EDIT_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من الصلاحية على الشحنة المحددة
    const viewAuth = canViewShipment(token, shipmentId);
    if (!viewAuth.valid) {
      return errorResponse(viewAuth.error);
    }
    
    const existing = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!existing) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // تحديث الحقول المسموح بها
    const allowedFields = [
      'TrackingNumber', 'OrderCode', 'CustomerName', 'Phone', 'SecondPhone',
      'Governorate', 'City', 'Branch', 'Address', 'ProductName', 'Quantity',
      'Price', 'CODAmount', 'Notes', 'Priority', 'Tags'
    ];
    
    for (let i = 0; i < allowedFields.length; i++) {
      const field = allowedFields[i];
      if (shipment[field] !== undefined) {
        existing[field] = shipment[field];
      }
    }
    
    // تنظيف رقم الهاتف
    if (shipment.Phone) existing.Phone = cleanPhone(shipment.Phone);
    if (shipment.SecondPhone) existing.SecondPhone = cleanPhone(shipment.SecondPhone);
    
    // تحديث التاريخ
    existing.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, existing);
    
    if (result.success) {
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        actionType: ACTION_TYPES.UPDATE,
        notes: 'تحديث بيانات الشحنة'
      });
      
      logAction(ACTION_TYPES.UPDATE, auth.user.username, { shipmentId: shipmentId });
      
      return successResponse(null, SUCCESS_MESSAGES.UPDATED);
    }
    
    return errorResponse('فشل في التحديث');
    
  } catch (e) {
    logError('Update Shipment Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// حذف شحنة
// ============================================

/**
 * حذف شحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @returns {Object} نتيجة الحذف
 */
function deleteShipmentData(token, shipmentId) {
  try {
    const auth = requirePermission(token, 'DELETE_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const existing = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!existing) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // نقل للأرشيف بدلاً من الحذف الفعلي
    const result = archiveShipment(shipmentId, auth.user.username);
    
    if (result.success) {
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        actionType: ACTION_TYPES.DELETE,
        notes: 'حذف ونقل للأرشيف'
      });
      
      logAction(ACTION_TYPES.DELETE, auth.user.username, { shipmentId: shipmentId });
      
      return successResponse(null, SUCCESS_MESSAGES.DELETED);
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Shipment Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تحديث حالة الشحنة
// ============================================

/**
 * تحديث حالة الشحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} newStatus - الحالة الجديدة
 * @param {string} notes - ملاحظات
 * @returns {Object} نتيجة التحديث
 */
function updateShipmentStatus(token, shipmentId, newStatus, notes) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من الصلاحية على الشحنة
    const viewAuth = canViewShipment(token, shipmentId);
    if (!viewAuth.valid) {
      return errorResponse(viewAuth.error);
    }
    
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    const oldStatus = shipment.Status;
    
    // التحقق من صحة الحالة
    const validStatuses = Object.values(SHIPMENT_STATUS);
    if (validStatuses.indexOf(newStatus) === -1) {
      return errorResponse('حالة غير صحيحة');
    }
    
    // تحديث الحالة
    shipment.Status = newStatus;
    shipment.UpdatedAt = getCurrentDateTime();
    shipment.LastFollowUp = getCurrentDateTime();
    
    // تحديث عدد "لا يرد"
    if (newStatus === SHIPMENT_STATUS.NO_ANSWER) {
      shipment.NoAnswerCount = (parseInt(shipment.NoAnswerCount || 0) + 1).toString();
    }
    
    // إذا تم التسليم، تحديث القيم
    if (newStatus === SHIPMENT_STATUS.DELIVERED) {
      // يمكن إضافة منطق إضافي هنا
    }
    
    // إذا كانت حالة نهائية، تعيين موعد الأرشيف
    const finalStatuses = [
      SHIPMENT_STATUS.DELIVERED,
      SHIPMENT_STATUS.RETURNED,
      SHIPMENT_STATUS.CLOSED
    ];
    
    const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, shipment);
    
    if (result.success) {
      // إضافة سجل
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        oldStatus: oldStatus,
        newStatus: newStatus,
        actionType: ACTION_TYPES.STATUS_CHANGE,
        notes: notes || 'تحديث الحالة إلى: ' + newStatus
      });
      
      // إشعار إذا كانت حالة تحتاج متابعة
      if (newStatus === SHIPMENT_STATUS.NO_ANSWER && parseInt(shipment.NoAnswerCount) >= 3) {
        addNotification({
          type: NOTIFICATION_TYPES.NO_ANSWER_3X,
          message: 'شحنة ' + shipment.TrackingNumber + ' - لا يرد أكثر من 3 مرات',
          shipmentId: shipmentId,
          forUser: 'all'
        });
      }
      
      logAction(ACTION_TYPES.STATUS_CHANGE, auth.user.username, {
        shipmentId: shipmentId,
        oldStatus: oldStatus,
        newStatus: newStatus
      });
      
      return successResponse(null, 'تم تحديث الحالة بنجاح');
    }
    
    return errorResponse('فشل في تحديث الحالة');
    
  } catch (e) {
    logError('Update Shipment Status Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إضافة ملاحظة
// ============================================

/**
 * إضافة ملاحظة لشحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} note - الملاحظة
 * @returns {Object} نتيجة الإضافة
 */
function addShipmentNote(token, shipmentId, note) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const viewAuth = canViewShipment(token, shipmentId);
    if (!viewAuth.valid) {
      return errorResponse(viewAuth.error);
    }
    
    if (!note || note.trim() === '') {
      return errorResponse('الملاحظة فارغة');
    }
    
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // إضافة الملاحظة للملاحظات الموجودة
    const existingNotes = shipment.Notes || '';
    const newNote = '[' + getCurrentDateTime() + '] ' + auth.user.name + ': ' + note;
    shipment.Notes = existingNotes ? existingNotes + '\n---\n' + newNote : newNote;
    shipment.UpdatedAt = getCurrentDateTime();
    shipment.LastFollowUp = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, shipment);
    
    if (result.success) {
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        actionType: ACTION_TYPES.NOTE_ADDED,
        notes: note
      });
      
      logAction(ACTION_TYPES.NOTE_ADDED, auth.user.username, {
        shipmentId: shipmentId,
        note: note
      });
      
      return successResponse(null, 'تمت إضافة الملاحظة');
    }
    
    return errorResponse('فشل في إضافة الملاحظة');
    
  } catch (e) {
    logError('Add Shipment Note Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// البحث في الشحنات
// ============================================

/**
 * البحث في الشحنات
 * @param {string} token - رمز الجلسة
 * @param {string} query - نص البحث
 * @param {Object} filters - الفلاتر الإضافية
 * @returns {Object} نتائج البحث
 */
function searchShipments(token, query, filters) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    // تصفية حسب الموظف
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === user.id;
      });
    }
    
    // تصفية غير مؤرشفة
    shipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    // البحث
    const searchTerm = (query || '').toLowerCase().trim();
    if (searchTerm) {
      shipments = shipments.filter(function(s) {
        return (s.TrackingNumber && s.TrackingNumber.toLowerCase().indexOf(searchTerm) !== -1) ||
               (s.OrderCode && s.OrderCode.toLowerCase().indexOf(searchTerm) !== -1) ||
               (s.CustomerName && s.CustomerName.toLowerCase().indexOf(searchTerm) !== -1) ||
               (s.Phone && s.Phone.indexOf(searchTerm) !== -1) ||
               (s.ProductName && s.ProductName.toLowerCase().indexOf(searchTerm) !== -1) ||
               (s.Governorate && s.Governorate.toLowerCase().indexOf(searchTerm) !== -1) ||
               (s.Branch && s.Branch.toLowerCase().indexOf(searchTerm) !== -1);
      });
    }
    
    // فلاتر إضافية
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        shipments = shipments.filter(function(s) { return s.Status === filters.status; });
      }
      if (filters.governorate && filters.governorate !== 'all') {
        shipments = shipments.filter(function(s) { return s.Governorate === filters.governorate; });
      }
      if (filters.branch && filters.branch !== 'all') {
        shipments = shipments.filter(function(s) { return s.Branch === filters.branch; });
      }
      if (filters.employee && filters.employee !== 'all') {
        shipments = shipments.filter(function(s) { return s.AssignedEmployee === filters.employee; });
      }
      if (filters.priority && filters.priority !== 'all') {
        shipments = shipments.filter(function(s) { return s.Priority === filters.priority; });
      }
    }
    
    // الترتيب
    shipments.sort(function(a, b) {
      return new Date(b.UpdatedAt || b.CreatedAt) - new Date(a.UpdatedAt || a.CreatedAt);
    });
    
    // الترقيم
    const paginated = paginate(shipments, filters.page || 1, filters.pageSize || 20);
    
    return successResponse({
      shipments: paginated.items.map(function(s) { return formatShipmentForDisplay(s); }),
      pagination: paginated.pagination,
      totalResults: shipments.length
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Search Shipments Error', { query: query, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// دوال مساعدة
// ============================================

/**
 * تنسيق الشحنة للعرض
 * @param {Object} shipment - بيانات الشحنة
 * @returns {Object} البيانات المنسقة
 */
function formatShipmentForDisplay(shipment) {
  if (!shipment) return {};
  
  return {
    id: shipment.ID,
    trackingNumber: shipment.TrackingNumber,
    orderCode: shipment.OrderCode,
    customerName: shipment.CustomerName,
    phone: shipment.Phone,
    secondPhone: shipment.SecondPhone,
    governorate: shipment.Governorate,
    city: shipment.City,
    branch: shipment.Branch,
    address: shipment.Address,
    productName: shipment.ProductName,
    quantity: shipment.Quantity,
    price: shipment.Price,
    codAmount: shipment.CODAmount,
    status: shipment.Status,
    statusColor: STATUS_COLORS[shipment.Status] || '#999',
    assignedEmployee: shipment.AssignedEmployee,
    assignedBy: shipment.AssignedBy,
    assignedDate: shipment.AssignedDate,
    lastFollowUp: shipment.LastFollowUp,
    nextFollowUp: shipment.NextFollowUp,
    notes: shipment.Notes,
    priority: shipment.Priority,
    priorityColor: PRIORITY_COLORS[shipment.Priority] || '#999',
    tags: shipment.Tags,
    createdAt: shipment.CreatedAt,
    updatedAt: shipment.UpdatedAt,
    noAnswerCount: shipment.NoAnswerCount,
    isArchived: shipment.IsArchived
  };
}

/**
 * الحصول على الشحنات غير الموزعة
 * @param {string} token - رمز الجلسة
 * @returns {Object} الشحنات
 */
function getUnassignedShipmentsList(token) {
  try {
    const auth = requirePermission(token, 'ASSIGN_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipments = getShipments({ status: SHIPMENT_STATUS.UNASSIGNED }, false);
    
    return successResponse({
      shipments: shipments.map(function(s) { return formatShipmentForDisplay(s); })
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Unassigned Shipments Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
