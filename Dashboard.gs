/**
 * ============================================
 * Dashboard.gs - بيانات لوحة التحكم
 * ============================================
 * 
 * يحتوي على جميع دوال جلب بيانات لوحة التحكم:
 * - إحصائيات الشحنات
 * - بيانات الموظفين
 * - الرسوم البيانية
 * - آخر التحديثات
 * - الإشعارات
 */

// ============================================
// بيانات لوحة التحكم الرئيسية
// ============================================

/**
 * الحصول على بيانات لوحة التحكم
 * @param {string} token - رمز الجلسة
 * @returns {Object} بيانات لوحة التحكم
 */
function getDashboardData(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const user = auth.user;
    const isAdmin = user.role === 'SYSTEM_ADMIN';
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    // إحصائيات الشحنات
    const stats = getDashboardStats(token);
    
    // شحنات حسب الحالة (للرسم البياني)
    const statusDistribution = getStatusDistribution(token);
    
    // أداء الموظفين
    const employeePerformance = getEmployeePerformance(token);
    
    // آخر الشحنات
    const recentShipments = getRecentShipments(token, 10);
    
    // آخر التحديثات
    const recentActivity = getRecentActivity(token, 15);
    
    // الإشعارات
    const notifications = getDashboardNotifications(token);
    
    return successResponse({
      stats: stats.data || {},
      statusDistribution: statusDistribution,
      employeePerformance: employeePerformance,
      recentShipments: recentShipments,
      recentActivity: recentActivity,
      notifications: notifications,
      userRole: user.role,
      userName: user.name
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Dashboard Data Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * إحصائيات لوحة التحكم
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإحصائيات
 */
function getDashboardStats(token) {
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
    
    // تصفية الشحنات غير المؤرشفة
    const activeShipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    const stats = {
      totalShipments: activeShipments.length,
      unassigned: 0,
      readyForPickup: 0,
      delivered: 0,
      noAnswer: 0,
      postponed: 0,
      returned: 0,
      rejectedQuality: 0,
      rejectedDelay: 0,
      closed: 0,
      totalValue: 0,
      codTotal: 0,
      deliveredValue: 0,
      needsFollowUp: 0,
      noAnswerThreshold: 0,
      overduePostponed: 0,
      todayDelivered: 0,
      todayCreated: 0,
      myShipments: 0
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < activeShipments.length; i++) {
      const s = activeShipments[i];
      const status = s.Status;
      const price = toNumber(s.Price);
      const cod = toNumber(s.CODAmount);
      
      // العد حسب الحالة
      if (status === SHIPMENT_STATUS.UNASSIGNED) stats.unassigned++;
      else if (status === SHIPMENT_STATUS.READY_FOR_PICKUP) stats.readyForPickup++;
      else if (status === SHIPMENT_STATUS.DELIVERED) {
        stats.delivered++;
        stats.deliveredValue += price;
      }
      else if (status === SHIPMENT_STATUS.NO_ANSWER) stats.noAnswer++;
      else if (status === SHIPMENT_STATUS.POSTPONED) stats.postponed++;
      else if (status === SHIPMENT_STATUS.RETURNED) stats.returned++;
      else if (status === SHIPMENT_STATUS.REJECTED_QUALITY) stats.rejectedQuality++;
      else if (status === SHIPMENT_STATUS.REJECTED_DELAY) stats.rejectedDelay++;
      else if (status === SHIPMENT_STATUS.CLOSED) stats.closed++;
      
      // القيم المالية
      stats.totalValue += price;
      stats.codTotal += cod;
      
      // تحتاج متابعة
      if (!s.LastFollowUp || isOlderThanHours(s.LastFollowUp, 24)) {
        stats.needsFollowUp++;
      }
      
      // لا يرد أكثر من 3 مرات
      if (parseInt(s.NoAnswerCount || 0) >= 3) {
        stats.noAnswerThreshold++;
      }
      
      // مؤجل وانتهى الموعد
      if (status === SHIPMENT_STATUS.POSTPONED && 
          s.NextFollowUp && 
          new Date(s.NextFollowUp) < new Date()) {
        stats.overduePostponed++;
      }
      
      // تم التسليم اليوم
      if (status === SHIPMENT_STATUS.DELIVERED && s.UpdatedAt) {
        const updatedDate = new Date(s.UpdatedAt);
        updatedDate.setHours(0, 0, 0, 0);
        if (updatedDate.getTime() === today.getTime()) {
          stats.todayDelivered++;
        }
      }
      
      // تم الإنشاء اليوم
      if (s.CreatedAt) {
        const createdDate = new Date(s.CreatedAt);
        createdDate.setHours(0, 0, 0, 0);
        if (createdDate.getTime() === today.getTime()) {
          stats.todayCreated++;
        }
      }
      
      // شحناتي (للموظف العادي)
      if (s.AssignedEmployee === user.id) {
        stats.myShipments++;
      }
    }
    
    // نسبة التسليم
    stats.deliveryRate = stats.totalShipments > 0 
      ? ((stats.delivered / stats.totalShipments) * 100).toFixed(1) 
      : 0;
    
    // متوسط قيمة الشحنة
    stats.avgShipmentValue = stats.totalShipments > 0 
      ? (stats.totalValue / stats.totalShipments).toFixed(2) 
      : 0;
    
    return successResponse(stats, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Dashboard Stats Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// توزيع الحالات (للرسم البياني)
// ============================================

/**
 * الحصول على توزيع حالات الشحنات
 * @param {string} token - رمز الجلسة
 * @returns {Array} بيانات التوزيع
 */
function getStatusDistribution(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === user.id;
      });
    }
    
    const activeShipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    const distribution = [
      { label: 'غير موزعة', value: 0, color: STATUS_COLORS['غير موزعة'] },
      { label: 'جاهز للاستلام', value: 0, color: STATUS_COLORS['جاهز للاستلام'] },
      { label: 'تم التسليم', value: 0, color: STATUS_COLORS['تم التسليم'] },
      { label: 'لا يرد', value: 0, color: STATUS_COLORS['لا يرد'] },
      { label: 'مؤجل', value: 0, color: STATUS_COLORS['مؤجل'] },
      { label: 'مرتجع', value: 0, color: STATUS_COLORS['مرتجع'] },
      { label: 'رفض خامة', value: 0, color: STATUS_COLORS['رفض بسبب الخامة'] },
      { label: 'رفض تأخير', value: 0, color: STATUS_COLORS['رفض بسبب التأخير'] },
      { label: 'مغلق', value: 0, color: STATUS_COLORS['مغلق'] }
    ];
    
    const statusMap = {
      'غير موزعة': 0,
      'جاهز للاستلام': 1,
      'تم التسليم': 2,
      'لا يرد': 3,
      'مؤجل': 4,
      'مرتجع': 5,
      'رفض بسبب الخامة': 6,
      'رفض بسبب التأخير': 7,
      'مغلق': 8
    };
    
    for (let i = 0; i < activeShipments.length; i++) {
      const status = activeShipments[i].Status;
      const index = statusMap[status];
      if (index !== undefined) {
        distribution[index].value++;
      }
    }
    
    // إزالة الحالات ذات القيمة صفر (اختياري)
    return distribution.filter(function(d) { return d.value > 0; });
    
  } catch (e) {
    logError('Get Status Distribution Error', { error: e.message });
    return [];
  }
}

// ============================================
// أداء الموظفين
// ============================================

/**
 * الحصول على أداء الموظفين
 * @param {string} token - رمز الجلسة
 * @returns {Array} بيانات الأداء
 */
function getEmployeePerformance(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    // فقط Admin و Team Leader يمكنهم رؤية أداء الفريق
    if (auth.user.role !== 'SYSTEM_ADMIN' && auth.user.role !== 'TEAM_LEADER') {
      // الموظف العادي يرى أداءه فقط
      return getMyPerformance(token);
    }
    
    const employees = getActiveEmployees(false);
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const activeShipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const performance = [];
    
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const empShipments = activeShipments.filter(function(s) {
        return s.AssignedEmployee === emp.ID;
      });
      
      const delivered = empShipments.filter(function(s) {
        return s.Status === SHIPMENT_STATUS.DELIVERED;
      }).length;
      
      const total = empShipments.length;
      
      // تم التسليم اليوم
      const todayDelivered = empShipments.filter(function(s) {
        if (s.Status !== SHIPMENT_STATUS.DELIVERED || !s.UpdatedAt) return false;
        const d = new Date(s.UpdatedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      }).length;
      
      performance.push({
        id: emp.ID,
        name: emp.Name || emp.Username,
        totalShipments: total,
        delivered: delivered,
        deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : 0,
        todayDelivered: todayDelivered,
        noAnswer: empShipments.filter(function(s) {
          return s.Status === SHIPMENT_STATUS.NO_ANSWER;
        }).length,
        postponed: empShipments.filter(function(s) {
          return s.Status === SHIPMENT_STATUS.POSTPONED;
        }).length
      });
    }
    
    // ترتيب حسب عدد التسليمات
    return performance.sort(function(a, b) {
      return b.delivered - a.delivered;
    });
    
  } catch (e) {
    logError('Get Employee Performance Error', { error: e.message });
    return [];
  }
}

/**
 * الحصول على أداء الموظف الحالي
 * @param {string} token - رمز الجلسة
 * @returns {Array} بيانات الأداء
 */
function getMyPerformance(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const user = auth.user;
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const myShipments = shipments.filter(function(s) {
      return s.AssignedEmployee === user.id && 
             s.IsArchived !== 'true' && 
             s.IsArchived !== true;
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const delivered = myShipments.filter(function(s) {
      return s.Status === SHIPMENT_STATUS.DELIVERED;
    }).length;
    
    const total = myShipments.length;
    
    const todayDelivered = myShipments.filter(function(s) {
      if (s.Status !== SHIPMENT_STATUS.DELIVERED || !s.UpdatedAt) return false;
      const d = new Date(s.UpdatedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    
    return [{
      id: user.id,
      name: user.name,
      totalShipments: total,
      delivered: delivered,
      deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : 0,
      todayDelivered: todayDelivered,
      noAnswer: myShipments.filter(function(s) {
        return s.Status === SHIPMENT_STATUS.NO_ANSWER;
      }).length,
      postponed: myShipments.filter(function(s) {
        return s.Status === SHIPMENT_STATUS.POSTPONED;
      }).length
    }];
    
  } catch (e) {
    logError('Get My Performance Error', { error: e.message });
    return [];
  }
}

// ============================================
// آخر الشحنات
// ============================================

/**
 * الحصول على آخر الشحنات
 * @param {string} token - رمز الجلسة
 * @param {number} limit - الحد الأقصى
 * @returns {Array} الشحنات
 */
function getRecentShipments(token, limit) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === user.id;
      });
    }
    
    // تصفية غير مؤرشفة
    shipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    // ترتيب حسب التحديث
    shipments.sort(function(a, b) {
      return new Date(b.UpdatedAt || b.CreatedAt) - new Date(a.UpdatedAt || a.CreatedAt);
    });
    
    return shipments.slice(0, limit || 10).map(function(s) {
      return {
        id: s.ID,
        trackingNumber: s.TrackingNumber,
        customerName: s.CustomerName,
        status: s.Status,
        statusColor: STATUS_COLORS[s.Status] || '#999',
        assignedEmployee: s.AssignedEmployee,
        price: s.Price,
        updatedAt: s.UpdatedAt,
        createdAt: s.CreatedAt
      };
    });
    
  } catch (e) {
    logError('Get Recent Shipments Error', { error: e.message });
    return [];
  }
}

// ============================================
// آخر النشاطات
// ============================================

/**
 * الحصول على آخر النشاطات
 * @param {string} token - رمز الجلسة
 * @param {number} limit - الحد الأقصى
 * @returns {Array} النشاطات
 */
function getRecentActivity(token, limit) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    // تصفية حسب الموظف إذا لم يكن لديه صلاحية رؤية الكل
    if (!canViewAll) {
      history = history.filter(function(h) {
        return h.EmployeeID === user.id;
      });
    }
    
    // ترتيب حسب التاريخ
    history.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    return history.slice(0, limit || 15).map(function(h) {
      return {
        id: h.ID,
        shipmentId: h.ShipmentID,
        employeeName: h.EmployeeName,
        oldStatus: h.OldStatus,
        newStatus: h.NewStatus,
        actionType: h.ActionType,
        notes: h.Notes,
        timestamp: h.Timestamp
      };
    });
    
  } catch (e) {
    logError('Get Recent Activity Error', { error: e.message });
    return [];
  }
}

// ============================================
// إشعارات لوحة التحكم
// ============================================

/**
 * الحصول على إشعارات لوحة التحكم
 * @param {string} token - رمز الجلسة
 * @returns {Array} الإشعارات
 */
function getDashboardNotifications(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const notifications = getUserNotifications(auth.user.id, true);
    
    return notifications.slice(0, 5).map(function(n) {
      return {
        id: n.ID,
        type: n.Type,
        message: n.Message,
        relatedShipment: n.RelatedShipment,
        createdAt: n.CreatedAt,
        isRead: n.IsRead
      };
    });
    
  } catch (e) {
    logError('Get Dashboard Notifications Error', { error: e.message });
    return [];
  }
}

// ============================================
// بيانات الرسم البياني (الشحنات حسب اليوم)
// ============================================

/**
 * الحصول على إحصائيات الشحنات حسب اليوم (للأسبوع الأخير)
 * @param {string} token - رمز الجلسة
 * @returns {Array} البيانات
 */
function getWeeklyStats(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) return [];
    
    const user = auth.user;
    const canViewAll = hasPermission(user.permissions, 'VIEW_ALL_SHIPMENTS');
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    if (!canViewAll) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === user.id;
      });
    }
    
    const days = [];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayShipments = shipments.filter(function(s) {
        if (!s.CreatedAt) return false;
        const sDate = new Date(s.CreatedAt);
        sDate.setHours(0, 0, 0, 0);
        return sDate.getTime() === date.getTime();
      });
      
      const dayDelivered = shipments.filter(function(s) {
        if (s.Status !== SHIPMENT_STATUS.DELIVERED || !s.UpdatedAt) return false;
        const sDate = new Date(s.UpdatedAt);
        sDate.setHours(0, 0, 0, 0);
        return sDate.getTime() === date.getTime();
      });
      
      days.push({
        label: i === 0 ? 'اليوم' : (i === 1 ? 'أمس' : dayNames[date.getDay()]),
        created: dayShipments.length,
        delivered: dayDelivered.length
      });
    }
    
    return days;
    
  } catch (e) {
    logError('Get Weekly Stats Error', { error: e.message });
    return [];
  }
}
