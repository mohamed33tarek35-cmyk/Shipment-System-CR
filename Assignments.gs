/**
 * ============================================
 * Assignments.gs - إدارة توزيع الشحنات
 * ============================================
 * 
 * يحتوي على جميع دوال توزيع الشحنات:
 * - التوزيع اليدوي
 * - التوزيع التلقائي (Round Robin)
 * - التوزيع حسب القواعد
 * - إعادة التوزيع
 * - نقل الشحنات بين الموظفين
 */

// ============================================
// توزيع شحنة واحدة
// ============================================

/**
 * توزيع شحنة على موظف
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} نتيجة التوزيع
 */
function assignShipmentToEmployee(token, shipmentId, employeeId) {
  try {
    const auth = requirePermission(token, 'ASSIGN_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من الشحنة
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse('الشحنة غير موجودة');
    }
    
    if (shipment.Status !== SHIPMENT_STATUS.UNASSIGNED) {
      return errorResponse('الشحنة موزعة مسبقاً، استخدم إعادة التوزيع');
    }
    
    // التحقق من الموظف
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse('الموظف غير موجود');
    }
    
    if (employee.IsActive !== 'true' && employee.IsActive !== true) {
      return errorResponse('الموظف غير مفعل');
    }
    
    // تحديث الشحنة
    const oldEmployee = shipment.AssignedEmployee;
    shipment.AssignedEmployee = employeeId;
    shipment.AssignedBy = auth.user.id;
    shipment.AssignedDate = getCurrentDateTime();
    shipment.Status = SHIPMENT_STATUS.READY_FOR_PICKUP;
    shipment.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, shipment);
    
    if (result.success) {
      // إضافة سجل التوزيع
      insertRow(SHEET_NAMES.ASSIGNMENTS, {
        ID: generateId('ASN'),
        ShipmentID: shipmentId,
        OldEmployee: oldEmployee,
        NewEmployee: employeeId,
        AssignedBy: auth.user.id,
        AssignmentType: ASSIGNMENT_TYPES.MANUAL,
        Timestamp: getCurrentDateTime()
      });
      
      // إضافة سجل للتاريخ
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        oldStatus: SHIPMENT_STATUS.UNASSIGNED,
        newStatus: SHIPMENT_STATUS.READY_FOR_PICKUP,
        actionType: ACTION_TYPES.ASSIGN,
        notes: 'توزيع يدوي على: ' + (employee.Name || employee.Username)
      });
      
      // إشعار للموظف
      addNotification({
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: 'تم تعيين شحنة جديدة لك: ' + shipment.TrackingNumber,
        shipmentId: shipmentId,
        forUser: employeeId
      });
      
      logAction(ACTION_TYPES.ASSIGN, auth.user.username, {
        shipmentId: shipmentId,
        employeeId: employeeId,
        employeeName: employee.Name || employee.Username,
        type: 'manual'
      });
      
      return successResponse(null, 'تم التوزيع بنجاح');
    }
    
    return errorResponse('فشل في التوزيع');
    
  } catch (e) {
    logError('Assign Shipment Error', { shipmentId: shipmentId, employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إعادة توزيع شحنة
// ============================================

/**
 * إعادة توزيع شحنة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} newEmployeeId - معرف الموظف الجديد
 * @returns {Object} نتيجة التوزيع
 */
function reassignShipment(token, shipmentId, newEmployeeId) {
  try {
    const auth = requirePermission(token, 'REASSIGN_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
    if (!shipment) {
      return errorResponse('الشحنة غير موجودة');
    }
    
    const newEmployee = getEmployeeById(newEmployeeId);
    if (!newEmployee) {
      return errorResponse('الموظف الجديد غير موجود');
    }
    
    const oldEmployeeId = shipment.AssignedEmployee;
    const oldEmployee = oldEmployeeId ? getEmployeeById(oldEmployeeId) : null;
    
    // تحديث الشحنة
    shipment.AssignedEmployee = newEmployeeId;
    shipment.AssignedBy = auth.user.id;
    shipment.AssignedDate = getCurrentDateTime();
    shipment.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId, shipment);
    
    if (result.success) {
      // إضافة سجل التوزيع
      insertRow(SHEET_NAMES.ASSIGNMENTS, {
        ID: generateId('ASN'),
        ShipmentID: shipmentId,
        OldEmployee: oldEmployeeId,
        NewEmployee: newEmployeeId,
        AssignedBy: auth.user.id,
        AssignmentType: ASSIGNMENT_TYPES.REASSIGN,
        Timestamp: getCurrentDateTime()
      });
      
      // سجل للتاريخ
      addHistoryRecord({
        shipmentId: shipmentId,
        employeeId: auth.user.id,
        employeeName: auth.user.name,
        actionType: ACTION_TYPES.REASSIGN,
        notes: 'إعادة توزيع من: ' + (oldEmployee ? oldEmployee.Name : 'غير موزعة') + 
               ' إلى: ' + (newEmployee.Name || newEmployee.Username)
      });
      
      // إشعار للموظف الجديد
      addNotification({
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: 'تم نقل شحنة إليك: ' + shipment.TrackingNumber,
        shipmentId: shipmentId,
        forUser: newEmployeeId
      });
      
      logAction(ACTION_TYPES.REASSIGN, auth.user.username, {
        shipmentId: shipmentId,
        oldEmployee: oldEmployeeId,
        newEmployee: newEmployeeId
      });
      
      return successResponse(null, 'تمت إعادة التوزيع بنجاح');
    }
    
    return errorResponse('فشل في إعادة التوزيع');
    
  } catch (e) {
    logError('Reassign Shipment Error', { shipmentId: shipmentId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// توزيع دفعة (Bulk)
// ============================================

/**
 * توزيع دفعة من الشحنات
 * @param {string} token - رمز الجلسة
 * @param {Array} shipmentIds - معرفات الشحنات
 * @param {string} employeeId - معرف الموظف
 * @param {string} assignmentType - نوع التوزيع
 * @returns {Object} نتيجة التوزيع
 */
function bulkAssignShipments(token, shipmentIds, employeeId, assignmentType) {
  try {
    const auth = requirePermission(token, 'BULK_ASSIGN');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!shipmentIds || shipmentIds.length === 0) {
      return errorResponse('لم يتم اختيار أي شحنة');
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse('الموظف غير موجود');
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < shipmentIds.length; i++) {
      const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentIds[i]);
      if (!shipment || shipment.Status !== SHIPMENT_STATUS.UNASSIGNED) {
        failCount++;
        continue;
      }
      
      const oldEmployee = shipment.AssignedEmployee;
      shipment.AssignedEmployee = employeeId;
      shipment.AssignedBy = auth.user.id;
      shipment.AssignedDate = getCurrentDateTime();
      shipment.Status = SHIPMENT_STATUS.READY_FOR_PICKUP;
      shipment.UpdatedAt = getCurrentDateTime();
      
      const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipmentIds[i], shipment);
      
      if (result.success) {
        successCount++;
        
        insertRow(SHEET_NAMES.ASSIGNMENTS, {
          ID: generateId('ASN'),
          ShipmentID: shipmentIds[i],
          OldEmployee: oldEmployee,
          NewEmployee: employeeId,
          AssignedBy: auth.user.id,
          AssignmentType: assignmentType || ASSIGNMENT_TYPES.BULK,
          Timestamp: getCurrentDateTime()
        });
        
        addHistoryRecord({
          shipmentId: shipmentIds[i],
          employeeId: auth.user.id,
          employeeName: auth.user.name,
          oldStatus: SHIPMENT_STATUS.UNASSIGNED,
          newStatus: SHIPMENT_STATUS.READY_FOR_PICKUP,
          actionType: ACTION_TYPES.ASSIGN,
          notes: 'توزيع دفعة على: ' + (employee.Name || employee.Username)
        });
      } else {
        failCount++;
      }
    }
    
    // إشعار للموظف
    if (successCount > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: 'تم تعيين ' + successCount + ' شحنة جديدة لك',
        forUser: employeeId
      });
    }
    
    logAction('BULK_ASSIGN', auth.user.username, {
      count: successCount,
      employeeId: employeeId,
      type: assignmentType
    });
    
    return successResponse({
      success: successCount,
      failed: failCount
    }, 'تم توزيع ' + successCount + ' شحنة بنجاح' + (failCount > 0 ? '، فشل ' + failCount : ''));
    
  } catch (e) {
    logError('Bulk Assign Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// التوزيع التلقائي (Round Robin)
// ============================================

/**
 * التوزيع التلقائي بالتساوي (Round Robin)
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - فلاتر الشحنات
 * @param {string} assignmentType - نوع التوزيع
 * @returns {Object} نتيجة التوزيع
 */
function autoAssignShipments(token, filters, assignmentType) {
  try {
    const auth = requirePermission(token, 'BULK_ASSIGN');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // الحصول على الشحنات غير الموزعة
    let shipments = getShipments({ status: SHIPMENT_STATUS.UNASSIGNED }, false);
    
    // تطبيق فلاتر إضافية
    if (filters) {
      if (filters.governorate && filters.governorate !== 'all') {
        shipments = shipments.filter(function(s) { return s.Governorate === filters.governorate; });
      }
      if (filters.branch && filters.branch !== 'all') {
        shipments = shipments.filter(function(s) { return s.Branch === filters.branch; });
      }
      if (filters.product && filters.product !== 'all') {
        shipments = shipments.filter(function(s) { return s.ProductName === filters.product; });
      }
    }
    
    if (shipments.length === 0) {
      return errorResponse('لا توجد شحنات غير موزعة مطابقة للفلاتر');
    }
    
    // الحصول على الموظفين النشطين
    const employees = getActiveEmployees(false).filter(function(e) {
      return e.Role !== 'SYSTEM_ADMIN'; // استبعاد الـ Admin
    });
    
    if (employees.length === 0) {
      return errorResponse('لا يوجد موظفين نشطين للتوزيع');
    }
    
    let distributedCount = 0;
    let currentIndex = 0;
    
    // Round Robin Distribution
    for (let i = 0; i < shipments.length; i++) {
      const employee = employees[currentIndex];
      
      const shipment = shipments[i];
      const oldEmployee = shipment.AssignedEmployee;
      shipment.AssignedEmployee = employee.ID;
      shipment.AssignedBy = auth.user.id;
      shipment.AssignedDate = getCurrentDateTime();
      shipment.Status = SHIPMENT_STATUS.READY_FOR_PICKUP;
      shipment.UpdatedAt = getCurrentDateTime();
      
      const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipment.ID, shipment);
      
      if (result.success) {
        distributedCount++;
        
        insertRow(SHEET_NAMES.ASSIGNMENTS, {
          ID: generateId('ASN'),
          ShipmentID: shipment.ID,
          OldEmployee: oldEmployee,
          NewEmployee: employee.ID,
          AssignedBy: auth.user.id,
          AssignmentType: assignmentType || ASSIGNMENT_TYPES.ROUND_ROBIN,
          Timestamp: getCurrentDateTime()
        });
        
        addHistoryRecord({
          shipmentId: shipment.ID,
          employeeId: auth.user.id,
          employeeName: auth.user.name,
          oldStatus: SHIPMENT_STATUS.UNASSIGNED,
          newStatus: SHIPMENT_STATUS.READY_FOR_PICKUP,
          actionType: ACTION_TYPES.ASSIGN,
          notes: 'توزيع تلقائي (Round Robin) على: ' + (employee.Name || employee.Username)
        });
        
        // الانتقال للموظف التالي
        currentIndex = (currentIndex + 1) % employees.length;
      }
    }
    
    // إشعارات للموظفين
    employees.forEach(function(emp) {
      addNotification({
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: 'تم تعيين شحنات جديدة لك عبر التوزيع التلقائي',
        forUser: emp.ID
      });
    });
    
    logAction('AUTO_ASSIGN', auth.user.username, {
      count: distributedCount,
      type: assignmentType || 'round_robin'
    });
    
    return successResponse({
      distributed: distributedCount,
      total: shipments.length
    }, 'تم توزيع ' + distributedCount + ' شحنة على ' + employees.length + ' موظف');
    
  } catch (e) {
    logError('Auto Assign Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// التوزيع حسب القواعد
// ============================================

/**
 * التوزيع حسب المحافظة
 * @param {string} token - رمز الجلسة
 * @returns {Object} نتيجة التوزيع
 */
function assignByGovernorate(token) {
  try {
    const auth = requirePermission(token, 'BULK_ASSIGN');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipments = getShipments({ status: SHIPMENT_STATUS.UNASSIGNED }, false);
    const employees = getActiveEmployees(false).filter(function(e) {
      return e.Role !== 'SYSTEM_ADMIN';
    });
    
    if (shipments.length === 0) {
      return errorResponse('لا توجد شحنات غير موزعة');
    }
    
    // بناء خريطة المحافظات للموظفين
    const governorateMap = {};
    employees.forEach(function(emp) {
      // يمكن إضافة حقل Governorate للموظف لاحقاً
      // حالياً: توزيع عشوائي حسب المحافظة
    });
    
    // توزيع حسب المحافظة (تبسيط: كل موظف يأخذ محافظة)
    let distributedCount = 0;
    
    // تجميع الشحنات حسب المحافظة
    const grouped = groupBy(shipments, 'Governorate');
    const governorates = Object.keys(grouped);
    
    for (let i = 0; i < governorates.length && i < employees.length; i++) {
      const gov = governorates[i];
      const emp = employees[i];
      const govShipments = grouped[gov];
      
      for (let j = 0; j < govShipments.length; j++) {
        const shipment = govShipments[j];
        const oldEmployee = shipment.AssignedEmployee;
        shipment.AssignedEmployee = emp.ID;
        shipment.AssignedBy = auth.user.id;
        shipment.AssignedDate = getCurrentDateTime();
        shipment.Status = SHIPMENT_STATUS.READY_FOR_PICKUP;
        shipment.UpdatedAt = getCurrentDateTime();
        
        updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipment.ID, shipment);
        
        insertRow(SHEET_NAMES.ASSIGNMENTS, {
          ID: generateId('ASN'),
          ShipmentID: shipment.ID,
          OldEmployee: oldEmployee,
          NewEmployee: emp.ID,
          AssignedBy: auth.user.id,
          AssignmentType: ASSIGNMENT_TYPES.BY_GOVERNORATE,
          Timestamp: getCurrentDateTime()
        });
        
        distributedCount++;
      }
    }
    
    logAction('ASSIGN_BY_GOVERNORATE', auth.user.username, { count: distributedCount });
    
    return successResponse({ distributed: distributedCount }, 'تم التوزيع حسب المحافظة');
    
  } catch (e) {
    logError('Assign By Governorate Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// نقل شحنات بين الموظفين
// ============================================

/**
 * نقل شحنات من موظف لآخر
 * @param {string} token - رمز الجلسة
 * @param {string} fromEmployeeId - من موظف
 * @param {string} toEmployeeId - إلى موظف
 * @param {Object} filters - فلاتر الشحنات
 * @returns {Object} نتيجة النقل
 */
function transferShipments(token, fromEmployeeId, toEmployeeId, filters) {
  try {
    const auth = requirePermission(token, 'REASSIGN_SHIPMENT');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const fromEmployee = getEmployeeById(fromEmployeeId);
    const toEmployee = getEmployeeById(toEmployeeId);
    
    if (!fromEmployee || !toEmployee) {
      return errorResponse('أحد الموظفين غير موجود');
    }
    
    // الحصول على شحنات الموظف الأول
    let shipments = getShipments({ assignedEmployee: fromEmployeeId }, false);
    
    // تطبيق فلاتر إضافية
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        shipments = shipments.filter(function(s) { return s.Status === filters.status; });
      }
      if (filters.limit && filters.limit > 0) {
        shipments = shipments.slice(0, filters.limit);
      }
    }
    
    if (shipments.length === 0) {
      return errorResponse('لا توجد شحنات للنقل');
    }
    
    let transferredCount = 0;
    
    for (let i = 0; i < shipments.length; i++) {
      const shipment = shipments[i];
      const oldEmployee = shipment.AssignedEmployee;
      
      shipment.AssignedEmployee = toEmployeeId;
      shipment.AssignedBy = auth.user.id;
      shipment.AssignedDate = getCurrentDateTime();
      shipment.UpdatedAt = getCurrentDateTime();
      
      const result = updateRow(SHEET_NAMES.SHIPMENTS, 'ID', shipment.ID, shipment);
      
      if (result.success) {
        transferredCount++;
        
        insertRow(SHEET_NAMES.ASSIGNMENTS, {
          ID: generateId('ASN'),
          ShipmentID: shipment.ID,
          OldEmployee: oldEmployee,
          NewEmployee: toEmployeeId,
          AssignedBy: auth.user.id,
          AssignmentType: ASSIGNMENT_TYPES.REASSIGN,
          Timestamp: getCurrentDateTime()
        });
        
        addHistoryRecord({
          shipmentId: shipment.ID,
          employeeId: auth.user.id,
          employeeName: auth.user.name,
          actionType: ACTION_TYPES.REASSIGN,
          notes: 'نقل من: ' + (fromEmployee.Name || fromEmployee.Username) + 
                 ' إلى: ' + (toEmployee.Name || toEmployee.Username)
        });
      }
    }
    
    // إشعار
    if (transferredCount > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: 'تم نقل ' + transferredCount + ' شحنة إليك',
        forUser: toEmployeeId
      });
    }
    
    logAction('TRANSFER_SHIPMENTS', auth.user.username, {
      count: transferredCount,
      from: fromEmployeeId,
      to: toEmployeeId
    });
    
    return successResponse({
      transferred: transferredCount
    }, 'تم نقل ' + transferredCount + ' شحنة بنجاح');
    
  } catch (e) {
    logError('Transfer Shipments Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// الحصول على إحصائيات التوزيع
// ============================================

/**
 * إحصائيات التوزيع
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإحصائيات
 */
function getAssignmentStats(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const canViewAll = hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === auth.user.id;
      });
    }
    
    const stats = {
      totalUnassigned: 0,
      totalAssigned: 0,
      byEmployee: {},
      byGovernorate: {},
      byStatus: {}
    };
    
    shipments.forEach(function(s) {
      if (s.Status === SHIPMENT_STATUS.UNASSIGNED) {
        stats.totalUnassigned++;
      } else {
        stats.totalAssigned++;
      }
      
      // حسب الموظف
      const empId = s.AssignedEmployee || 'unassigned';
      if (!stats.byEmployee[empId]) {
        stats.byEmployee[empId] = { count: 0, name: 'غير موزعة' };
      }
      stats.byEmployee[empId].count++;
      
      // حسب المحافظة
      const gov = s.Governorate || 'غير محدد';
      if (!stats.byGovernorate[gov]) stats.byGovernorate[gov] = 0;
      stats.byGovernorate[gov]++;
      
      // حسب الحالة
      const status = s.Status || 'غير محدد';
      if (!stats.byStatus[status]) stats.byStatus[status] = 0;
      stats.byStatus[status]++;
    });
    
    return successResponse(stats, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Assignment Stats Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
