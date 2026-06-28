/**
 * ============================================
 * Notifications.gs - إدارة الإشعارات
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة الإشعارات:
 * - الحصول على إشعارات المستخدم
 * - تحديث حالة القراءة
 * - إنشاء إشعارات تلقائية
 * - إدارة الإشعارات (Admin)
 */

// ============================================
// الحصول على الإشعارات
// ============================================

/**
 * الحصول على إشعارات المستخدم (API wrapper)
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإشعارات
 */
function getNotificationsData(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const notifications = getUserNotifications(auth.user.id, true);
    
    // تنسيق البيانات للعرض
    const formatted = notifications.map(function(n) {
      return {
        id: n.ID,
        type: n.Type,
        message: n.Message,
        relatedShipment: n.RelatedShipment,
        isRead: n.IsRead === 'true' || n.IsRead === true,
        createdAt: n.CreatedAt,
        forUser: n.ForUser
      };
    });
    
    return successResponse(formatted, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Notifications Data Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على جميع الإشعارات (Admin)
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} جميع الإشعارات
 */
function getAllNotifications(token, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let data = getSheetDataAsObjects(SHEET_NAMES.NOTIFICATIONS, false);
    
    // تطبيق فلاتر
    if (filters) {
      if (filters.type && filters.type !== 'all') {
        data = data.filter(function(n) { return n.Type === filters.type; });
      }
      if (filters.isRead !== undefined && filters.isRead !== '') {
        const isReadVal = filters.isRead === 'true' || filters.isRead === true;
        data = data.filter(function(n) {
          const nRead = n.IsRead === 'true' || n.IsRead === true;
          return nRead === isReadVal;
        });
      }
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        data = data.filter(function(n) {
          if (!n.CreatedAt) return false;
          return new Date(n.CreatedAt) >= fromDate;
        });
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        data = data.filter(function(n) {
          if (!n.CreatedAt) return false;
          return new Date(n.CreatedAt) <= toDate;
        });
      }
    }
    
    // الترتيب
    data.sort(function(a, b) {
      return new Date(b.CreatedAt) - new Date(a.CreatedAt);
    });
    
    // الترقيم
    const page = filters ? filters.page || 1 : 1;
    const pageSize = filters ? filters.pageSize || 50 : 50;
    const paginated = paginate(data, page, pageSize);
    
    const formatted = paginated.items.map(function(n) {
      return {
        id: n.ID,
        type: n.Type,
        message: n.Message,
        relatedShipment: n.RelatedShipment,
        isRead: n.IsRead === 'true' || n.IsRead === true,
        createdAt: n.CreatedAt,
        forUser: n.ForUser
      };
    });
    
    return successResponse({
      notifications: formatted,
      pagination: paginated.pagination,
      total: data.length
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get All Notifications Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تحديث حالة الإشعارات
// ============================================

/**
 * تحديث إشعار إلى مقروء (API wrapper)
 * @param {string} notificationId - معرف الإشعار
 * @returns {Object} النتيجة
 */
function markNotificationRead(notificationId) {
  try {
    if (!notificationId) {
      return errorResponse('معرف الإشعار مطلوب');
    }
    
    const notification = findById(SHEET_NAMES.NOTIFICATIONS, 'ID', notificationId);
    if (!notification) {
      return errorResponse('الإشعار غير موجود');
    }
    
    notification.IsRead = 'true';
    
    const result = updateRow(SHEET_NAMES.NOTIFICATIONS, 'ID', notificationId, notification);
    
    if (result.success) {
      return successResponse(null, 'تم تحديث الإشعار');
    }
    
    return errorResponse('فشل في تحديث الإشعار');
    
  } catch (e) {
    logError('Mark Notification Read Error', { notificationId: notificationId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديث جميع إشعارات مستخدم إلى مقروءة
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
      const result = markNotificationRead(notifications[i].ID);
      if (result.success) {
        count++;
      }
    }
    
    return successResponse({ count: count }, 'تم تحديث ' + count + ' إشعار');
    
  } catch (e) {
    logError('Mark All Notifications Read Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إنشاء إشعارات تلقائية
// ============================================

/**
 * إنشاء إشعار جديد
 * @param {Object} notification - بيانات الإشعار
 * @returns {Object} النتيجة
 */
function createNotification(notification) {
  try {
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
    
  } catch (e) {
    logError('Create Notification Error', { error: e.message });
    return errorResponse('فشل في إنشاء الإشعار');
  }
}

/**
 * إنشاء إشعار تعيين شحنة لموظف
 * @param {string} employeeId - معرف الموظف
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @returns {Object} النتيجة
 */
function notifyNewAssignment(employeeId, shipmentId, trackingNumber) {
  return createNotification({
    type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
    message: 'تم تعيين شحنة جديدة لك: ' + (trackingNumber || ''),
    shipmentId: shipmentId,
    forUser: employeeId
  });
}

/**
 * إنشاء إشعار تغيير حالة
 * @param {string} employeeId - معرف الموظف
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @param {string} newStatus - الحالة الجديدة
 * @returns {Object} النتيجة
 */
function notifyStatusChange(employeeId, shipmentId, trackingNumber, newStatus) {
  return createNotification({
    type: NOTIFICATION_TYPES.SYSTEM,
    message: 'تغيير حالة الشحنة ' + (trackingNumber || '') + ' إلى: ' + newStatus,
    shipmentId: shipmentId,
    forUser: employeeId
  });
}

/**
 * إنشاء إشعار "لا يرد" متكرر
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @param {number} count - عدد المرات
 * @returns {Object} النتيجة
 */
function notifyNoAnswerThreshold(shipmentId, trackingNumber, count) {
  return createNotification({
    type: NOTIFICATION_TYPES.NO_ANSWER_3X,
    message: 'شحنة ' + (trackingNumber || '') + ' - "لا يرد" ' + count + ' مرات',
    shipmentId: shipmentId,
    forUser: 'all'
  });
}

/**
 * إنشاء إشعار شحنة مؤجلة منتهية
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @returns {Object} النتيجة
 */
function notifyPostponedOverdue(shipmentId, trackingNumber) {
  return createNotification({
    type: NOTIFICATION_TYPES.POSTPONED_OVERDUE,
    message: 'شحنة مؤجلة انتهى موعد متابعتها: ' + (trackingNumber || ''),
    shipmentId: shipmentId,
    forUser: 'all'
  });
}

/**
 * إنشاء إشعار شحنات غير موزعة
 * @param {number} count - عدد الشحنات
 * @returns {Object} النتيجة
 */
function notifyUnassignedShipments(count) {
  return createNotification({
    type: NOTIFICATION_TYPES.UNASSIGNED_SHIPMENTS,
    message: 'يوجد ' + count + ' شحنة غير موزعة',
    shipmentId: '',
    forUser: 'all'
  });
}

/**
 * إنشاء إشعار شحنات لم تُحدث منذ 24 ساعة
 * @param {number} count - عدد الشحنات
 * @returns {Object} النتيجة
 */
function notifyNoUpdate24H(count) {
  return createNotification({
    type: NOTIFICATION_TYPES.NO_UPDATE_24H,
    message: 'يوجد ' + count + ' شحنة لم تُحدث منذ 24 ساعة',
    shipmentId: '',
    forUser: 'all'
  });
}

/**
 * إنشاء إشعار شحنة جاهزة للاستلام
 * @param {string} employeeId - معرف الموظف
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @returns {Object} النتيجة
 */
function notifyReadyForPickup(employeeId, shipmentId, trackingNumber) {
  return createNotification({
    type: NOTIFICATION_TYPES.READY_FOR_PICKUP,
    message: 'شحنة جاهزة للاستلام: ' + (trackingNumber || ''),
    shipmentId: shipmentId,
    forUser: employeeId
  });
}

/**
 * إنشاء إشعار شحنة مرتجعة
 * @param {string} employeeId - معرف الموظف
 * @param {string} shipmentId - معرف الشحنة
 * @param {string} trackingNumber - رقم التتبع
 * @returns {Object} النتيجة
 */
function notifyReturned(employeeId, shipmentId, trackingNumber) {
  return createNotification({
    type: NOTIFICATION_TYPES.RETURNED,
    message: 'شحنة مرتجعة: ' + (trackingNumber || ''),
    shipmentId: shipmentId,
    forUser: employeeId
  });
}

// ============================================
// إدارة الإشعارات (Admin)
// ============================================

/**
 * حذف إشعار
 * @param {string} token - رمز الجلسة
 * @param {string} notificationId - معرف الإشعار
 * @returns {Object} النتيجة
 */
function deleteNotification(token, notificationId) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!notificationId) {
      return errorResponse('معرف الإشعار مطلوب');
    }
    
    const result = deleteRow(SHEET_NAMES.NOTIFICATIONS, 'ID', notificationId);
    
    if (result.success) {
      logAction('NOTIFICATION_DELETED', auth.user.username, {
        notificationId: notificationId
      });
      
      return successResponse(null, 'تم حذف الإشعار');
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Notification Error', { notificationId: notificationId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * حذف جميع إشعارات مقروءة
 * @param {string} token - رمز الجلسة
 * @returns {Object} النتيجة
 */
function deleteReadNotifications(token) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    let data = getSheetDataAsObjects(SHEET_NAMES.NOTIFICATIONS, false);
    const readIds = [];
    
    for (let i = 0; i < data.length; i++) {
      if (data[i].IsRead === 'true' || data[i].IsRead === true) {
        readIds.push(data[i].ID);
      }
    }
    
    if (readIds.length === 0) {
      return successResponse({ count: 0 }, 'لا توجد إشعارات مقروءة للحذف');
    }
    
    const result = batchDeleteRows(SHEET_NAMES.NOTIFICATIONS, 'ID', readIds);
    
    if (result.success) {
      logAction('READ_NOTIFICATIONS_DELETED', auth.user.username, {
        count: readIds.length
      });
      
      return successResponse({ count: readIds.length }, 'تم حذف ' + readIds.length + ' إشعار مقروء');
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Read Notifications Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على عدد الإشعارات غير المقروءة
 * @param {string} token - رمز الجلسة
 * @returns {Object} العدد
 */
function getUnreadCount(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const notifications = getUserNotifications(auth.user.id, true);
    
    return successResponse({
      count: notifications.length
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Unread Count Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
