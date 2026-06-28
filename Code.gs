/**
 * ============================================
 * Code.gs - نقطة الدخول الرئيسية للنظام
 * ============================================
 * 
 * يحتوي على:
 * - doGet: نقطة الدخول للـ Web App
 * - doPost: معالجة الطلبات POST
 * - Routing للـ API
 * - إعداد الصفحات
 */

// ============================================
// نقطة الدخول الرئيسية
// ============================================

/**
 * معالجة طلبات GET
 * @param {Object} e - كائن الحدث
 * @returns {HtmlOutput} صفحة HTML
 */
function doGet(e) {
  try {
    // التحقق من تهيئة النظام
    const isInitialized = propGet(PROPERTIES_KEYS.SYSTEM_INITIALIZED);
    if (isInitialized !== 'true') {
      initializeSystem();
    }
    
    // التحقق من وجود token في URL
    const token = e.parameter ? e.parameter.token : null;
    const page = e.parameter ? e.parameter.page : null;
    
    // إذا لم يوجد token أو صفحة، عرض صفحة الدخول
    if (!token) {
      return renderLoginPage();
    }
    
    // التحقق من صلاحية الجلسة
    const session = getSession(token);
    if (!session) {
      return renderLoginPage();
    }
    
    // تحديد الصفحة المطلوبة
    return renderPage(page || 'dashboard', token, session);
    
  } catch (err) {
    logError('doGet Error', { error: err.message, stack: err.stack });
    return renderLoginPage();
  }
}

/**
 * معالجة طلبات POST (API)
 * @param {Object} e - كائن الحدث
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    // التحقق من تهيئة النظام
    const isInitialized = propGet(PROPERTIES_KEYS.SYSTEM_INITIALIZED);
    if (isInitialized !== 'true') {
      return jsonResponse(errorResponse('النظام غير مهيأ'));
    }
    
    // قراءة البيانات
    let data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        // محاولة قراءة من parameters
        data = e.parameter || {};
      }
    }
    
    const action = data.action || '';
    const token = data.token || '';
    
    // Routing
    switch (action) {
      // Auth
      case 'login':
        return jsonResponse(login(data.username, data.password));
      case 'logout':
        return jsonResponse(logout(token));
      case 'checkSession':
        return jsonResponse(successResponse(checkSessionStatus(token), 'تم بنجاح'));
      case 'extendSession':
        return jsonResponse(extendSession(token));
      case 'changePassword':
        return jsonResponse(changePassword(token, data.currentPassword, data.newPassword));
      
      // Dashboard
      case 'getDashboard':
        return jsonResponse(getDashboardData(token));
      case 'getDashboardStats':
        return jsonResponse(getDashboardStats(token));
      
      // Shipments
      case 'getShipments':
        return jsonResponse(getShipmentsList(token, data.filters, data.pagination));
      case 'getShipment':
        return jsonResponse(getShipmentDetail(token, data.shipmentId));
      case 'createShipment':
        return jsonResponse(createShipment(token, data.shipment));
      case 'updateShipment':
        return jsonResponse(updateShipmentData(token, data.shipmentId, data.shipment));
      case 'deleteShipment':
        return jsonResponse(deleteShipmentData(token, data.shipmentId));
      case 'updateShipmentStatus':
        return jsonResponse(updateShipmentStatus(token, data.shipmentId, data.status, data.notes));
      case 'addShipmentNote':
        return jsonResponse(addShipmentNote(token, data.shipmentId, data.note));
      case 'importShipments':
        return jsonResponse(importShipmentsFromCsv(data.csvContent, getUserFromRequest(e) ? getUserFromRequest(e).id : ''));
      
      // Assignments
      case 'assignShipment':
        return jsonResponse(assignShipmentToEmployee(token, data.shipmentId, data.employeeId));
      case 'reassignShipment':
        return jsonResponse(reassignShipment(token, data.shipmentId, data.newEmployeeId));
      case 'bulkAssign':
        return jsonResponse(bulkAssignShipments(token, data.shipmentIds, data.employeeId, data.assignmentType));
      case 'autoAssign':
        return jsonResponse(autoAssignShipments(token, data.filters, data.assignmentType));
      case 'getUnassignedShipments':
        return jsonResponse(getUnassignedShipmentsList(token));
      
      // Employees
      case 'getEmployees':
        return jsonResponse(getEmployeesList(token));
      case 'getEmployee':
        return jsonResponse(getEmployeeDetail(token, data.employeeId));
      case 'createEmployee':
        return jsonResponse(createEmployeeData(token, data.employee));
      case 'updateEmployee':
        return jsonResponse(updateEmployeeData(token, data.employeeId, data.employee));
      case 'deleteEmployee':
        return jsonResponse(deleteEmployeeData(token, data.employeeId));
      case 'toggleEmployeeStatus':
        return jsonResponse(toggleEmployeeStatus(token, data.employeeId));
      case 'resetEmployeePassword':
        return jsonResponse(resetPassword(token, data.employeeId, data.newPassword));
      
      // Roles
      case 'getRoles':
        return jsonResponse(getRoles(token));
      case 'getRole':
        return jsonResponse(getRole(token, data.roleId));
      case 'createRole':
        return jsonResponse(createRole(token, data.role));
      case 'updateRole':
        return jsonResponse(updateRole(token, data.roleId, data.role));
      case 'deleteRole':
        return jsonResponse(deleteRole(token, data.roleId));
      case 'getPermissions':
        return jsonResponse(getPermissions(token));
      case 'getEmployeePermissions':
        return jsonResponse(getEmployeePermissionsList(token, data.employeeId));
      case 'updateEmployeePermissions':
        return jsonResponse(updateEmployeePermissions(token, data.employeeId, data.permissions));
      
      // Search
      case 'searchShipments':
        return jsonResponse(searchShipments(token, data.query, data.filters));
      
      // History
      case 'getShipmentHistory':
        return jsonResponse(getShipmentHistoryData(token, data.shipmentId));
      case 'getHistory':
        return jsonResponse(getAllHistory(token, data.filters));
      
      // Reports
      case 'getReports':
        return jsonResponse(getReportsData(token, data.filters));
      case 'exportReport':
        return jsonResponse(exportReportCsv(token, data.filters));
      
      // Notifications
      case 'getNotifications':
        return jsonResponse(getNotificationsData(token));
      case 'markNotificationRead':
        return jsonResponse(markNotificationRead(data.notificationId));
      case 'markAllNotificationsRead':
        return jsonResponse(markAllNotificationsRead(token));
      
      // Settings
      case 'getSettings':
        return jsonResponse(successResponse(getAllSettings(), 'تم بنجاح'));
      case 'updateSetting':
        return jsonResponse(updateSettingValue(token, data.key, data.value));
      case 'getSetting':
        return jsonResponse(successResponse({ key: data.key, value: getSetting(data.key) }, 'تم بنجاح'));
      
      // System
      case 'initialize':
        return jsonResponse(initializeSystem());
      case 'createBackup':
        return jsonResponse(createBackup());
      case 'getSystemInfo':
        return jsonResponse(getSystemInfo(token));
      
      default:
        return jsonResponse(errorResponse('إجراء غير معروف: ' + action));
    }
    
  } catch (err) {
    logError('doPost Error', { error: err.message, stack: err.stack });
    return jsonResponse(errorResponse(ERROR_MESSAGES.SERVER_ERROR));
  }
}

// ============================================
// عرض الصفحات
// ============================================

/**
 * عرض صفحة الدخول
 * @returns {HtmlOutput} صفحة الدخول
 */
function renderLoginPage() {
  return HtmlService.createHtmlOutputFromFile('Login')
    .setTitle(SYSTEM_CONFIG.APP_NAME + ' - تسجيل الدخول')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * عرض صفحة النظام
 * @param {string} page - اسم الصفحة
 * @param {string} token - رمز الجلسة
 * @param {Object} session - بيانات الجلسة
 * @returns {HtmlOutput} الصفحة
 */
function renderPage(page, token, session) {
  const template = HtmlService.createTemplateFromFile('Index');
  
  // تمرير البيانات للقالب
  template.token = token;
  template.user = JSON.stringify({
    id: session.employeeId,
    username: session.username,
    name: session.name,
    role: session.role,
    permissions: session.permissions
  });
  template.page = page;
  template.appName = SYSTEM_CONFIG.APP_NAME;
  template.appVersion = SYSTEM_CONFIG.APP_VERSION;
  
  return template.evaluate()
    .setTitle(SYSTEM_CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// دوال مساعدة للـ API
// ============================================

/**
 * الحصول على بيانات المستخدم من الطلب (للـ doPost)
 * @param {Object} e - كائن الحدث
 * @returns {Object|null} بيانات المستخدم
 */
function getUserFromPostRequest(e) {
  if (e.postData && e.postData.contents) {
    try {
      const data = JSON.parse(e.postData.contents);
      if (data.token) {
        return getCurrentUser(data.token);
      }
    } catch (err) {
      // تجاهل
    }
  }
  return null;
}

// ============================================
// دوال إضافية للنظام
// ============================================

/**
 * الحصول على معلومات النظام
 * @param {string} token - رمز الجلسة
 * @returns {Object} معلومات النظام
 */
function getSystemInfo(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const sheetInfo = [];
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      sheetInfo.push({
        name: sheet.getName(),
        rows: sheet.getLastRow() - 1, // بدون Header
        columns: sheet.getLastColumn()
      });
    }
    
    return successResponse({
      appName: SYSTEM_CONFIG.APP_NAME,
      appVersion: SYSTEM_CONFIG.APP_VERSION,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheets: sheetInfo,
      totalSheets: sheets.length,
      user: auth.user.username,
      timestamp: getCurrentDateTime()
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get System Info Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديث إعداد
 * @param {string} token - رمز الجلسة
 * @param {string} key - المفتاح
 * @param {string} value - القيمة
 * @returns {Object} النتيجة
 */
function updateSettingValue(token, key, value) {
  try {
    const auth = requirePermission(token, 'MANAGE_SETTINGS');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    return updateSetting(key, value, auth.user.username);
    
  } catch (e) {
    logError('Update Setting Value Error', { key: key, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديد جميع الإشعارات كمقروءة
 * @param {string} token - رمز الجلسة
 * @returns {Object} النتيجة
 */
function markAllNotificationsRead(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const notifications = getUserNotifications(auth.user.id, true);
    let count = 0;
    
    for (let i = 0; i < notifications.length; i++) {
      markNotificationRead(notifications[i].ID);
      count++;
    }
    
    return successResponse({ count: count }, 'تم تحديث ' + count + ' إشعار');
    
  } catch (e) {
    logError('Mark All Notifications Read Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// Trigger Functions
// ============================================

/**
 * تشغيل يومي - للأرشفة التلقائية والإشعارات
 */
function dailyTrigger() {
  try {
    // أرشفة الشحنات القديمة
    autoArchiveShipments();
    
    // إنشاء إشعارات
    generateDailyNotifications();
    
    logAction('DAILY_TRIGGER', 'System', { timestamp: getCurrentDateTime() });
    
  } catch (e) {
    logError('Daily Trigger Error', { error: e.message });
  }
}

/**
 * أرشفة الشحنات تلقائياً
 */
function autoArchiveShipments() {
  try {
    const archiveEnabled = getSetting('AUTO_ARCHIVE_ENABLED', 'true');
    if (archiveEnabled !== 'true') return;
    
    const archiveAfterDays = parseInt(getSetting('ARCHIVE_AFTER_DAYS', '30'));
    const cutoffDate = addDays(new Date(), -archiveAfterDays);
    
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const toArchive = [];
    
    for (let i = 0; i < shipments.length; i++) {
      const shipment = shipments[i];
      const finalStatuses = [
        SHIPMENT_STATUS.DELIVERED,
        SHIPMENT_STATUS.RETURNED,
        SHIPMENT_STATUS.CLOSED
      ];
      
      if (finalStatuses.indexOf(shipment.Status) !== -1) {
        const updatedAt = new Date(shipment.UpdatedAt);
        if (updatedAt < cutoffDate && shipment.IsArchived !== 'true') {
          toArchive.push(shipment.ID);
        }
      }
    }
    
    for (let i = 0; i < toArchive.length; i++) {
      archiveShipment(toArchive[i], 'System');
    }
    
    logAction('AUTO_ARCHIVE', 'System', { count: toArchive.length });
    
  } catch (e) {
    logError('Auto Archive Error', { error: e.message });
  }
}

/**
 * إنشاء إشعارات يومية
 */
function generateDailyNotifications() {
  try {
    const notificationEnabled = getSetting('NOTIFICATION_ENABLED', 'true');
    if (notificationEnabled !== 'true') return;
    
    // شحنات غير موزعة
    const unassigned = getShipments({ status: SHIPMENT_STATUS.UNASSIGNED }, false);
    if (unassigned.length > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.UNASSIGNED_SHIPMENTS,
        message: 'يوجد ' + unassigned.length + ' شحنة غير موزعة',
        forUser: 'all'
      });
    }
    
    // شحنات لم تُحدث منذ 24 ساعة
    const noUpdate = getShipments({ needsFollowUp: true }, false);
    if (noUpdate.length > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.NO_UPDATE_24H,
        message: 'يوجد ' + noUpdate.length + ' شحنة لم تُحدث منذ 24 ساعة',
        forUser: 'all'
      });
    }
    
    // شحنات "لا يرد" أكثر من 3 مرات
    const noAnswer = getShipments({ noAnswerThreshold: true }, false);
    if (noAnswer.length > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.NO_ANSWER_3X,
        message: 'يوجد ' + noAnswer.length + ' شحنة "لا يرد" أكثر من 3 مرات',
        forUser: 'all'
      });
    }
    
    // شحنات مؤجلة انتهى موعدها
    const overdue = getShipments({ overduePostponed: true }, false);
    if (overdue.length > 0) {
      addNotification({
        type: NOTIFICATION_TYPES.POSTPONED_OVERDUE,
        message: 'يوجد ' + overdue.length + ' شحنة مؤجلة انتهى موعد متابعتها',
        forUser: 'all'
      });
    }
    
  } catch (e) {
    logError('Generate Notifications Error', { error: e.message });
  }
}

// ============================================
// دوال التصدير
// ============================================

/**
 * تصدير تقرير كـ CSV
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} بيانات التصدير
 */
function exportReportCsv(token, filters) {
  try {
    const auth = requirePermission(token, 'EXPORT_REPORTS');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let shipments = getShipments(filters, false);
    
    // تصفية إضافية حسب الصلاحيات
    if (!hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS')) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === auth.user.id;
      });
    }
    
    if (shipments.length === 0) {
      return errorResponse('لا توجد بيانات للتصدير');
    }
    
    // تحديد الأعمدة للتصدير
    const exportHeaders = [
      'TrackingNumber', 'OrderCode', 'CustomerName', 'Phone', 'SecondPhone',
      'Governorate', 'City', 'Branch', 'Address', 'ProductName', 'Quantity',
      'Price', 'CODAmount', 'Status', 'AssignedEmployee', 'AssignedDate',
      'LastFollowUp', 'NextFollowUp', 'Notes', 'Priority', 'CreatedAt', 'UpdatedAt'
    ];
    
    const csv = objectsToCsv(shipments, exportHeaders);
    
    logAction('REPORT_EXPORTED', auth.user.username, {
      count: shipments.length,
      filters: filters
    });
    
    return successResponse({
      content: csv,
      filename: 'shipments_report_' + formatDate(new Date(), 'yyyy-MM-dd') + '.csv',
      count: shipments.length
    }, 'تم التصدير بنجاح');
    
  } catch (e) {
    logError('Export Report Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.EXPORT_ERROR);
  }
}
