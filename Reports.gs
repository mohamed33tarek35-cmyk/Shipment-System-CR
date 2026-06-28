/**
 * ============================================
 * Reports.gs - التقارير والإحصائيات
 * ============================================
 * 
 * يحتوي على جميع دوال التقارير:
 * - تقارير الشحنات
 * - تقارير الموظفين
 * - تقارير الأداء
 * - التصدير
 */

// ============================================
// تقارير الشحنات
// ============================================

/**
 * الحصول على بيانات التقارير
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} بيانات التقارير
 */
function getReportsData(token, filters) {
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
    
    // تطبيق فلاتر التاريخ
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          const d = new Date(s.CreatedAt);
          d.setHours(0, 0, 0, 0);
          return d >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          return new Date(s.CreatedAt) <= toDate;
        });
      }
      
      if (filters.status && filters.status !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.Status === filters.status;
        });
      }
      
      if (filters.governorate && filters.governorate !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.Governorate === filters.governorate;
        });
      }
      
      if (filters.employee && filters.employee !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.AssignedEmployee === filters.employee;
        });
      }
    }
    
    // إحصائيات عامة
    const stats = calculateShipmentStats(shipments);
    
    // توزيع حسب الحالة
    const statusDistribution = calculateStatusDistribution(shipments);
    
    // توزيع حسب المحافظة
    const governorateDistribution = calculateGovernorateDistribution(shipments);
    
    // توزيع حسب الموظف
    const employeeDistribution = calculateEmployeeDistribution(shipments);
    
    // توزيع حسب الأولوية
    const priorityDistribution = calculatePriorityDistribution(shipments);
    
    // الشحنات حسب اليوم
    const dailyStats = calculateDailyStats(shipments, filters);
    
    // أداء الموظفين
    const employeePerformance = calculateEmployeeReportStats(shipments);
    
    return successResponse({
      summary: stats,
      statusDistribution: statusDistribution,
      governorateDistribution: governorateDistribution,
      employeeDistribution: employeeDistribution,
      priorityDistribution: priorityDistribution,
      dailyStats: dailyStats,
      employeePerformance: employeePerformance,
      totalShipments: shipments.length,
      filters: filters || {}
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Reports Data Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// حساب الإحصائيات
// ============================================

/**
 * حساب إحصائيات الشحنات
 * @param {Array} shipments - الشحنات
 * @returns {Object} الإحصائيات
 */
function calculateShipmentStats(shipments) {
  const stats = {
    total: shipments.length,
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
    avgPrice: 0
  };
  
  let totalPrice = 0;
  
  shipments.forEach(function(s) {
    const status = s.Status;
    const price = toNumber(s.Price);
    const cod = toNumber(s.CODAmount);
    
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
    
    stats.totalValue += price;
    stats.codTotal += cod;
    totalPrice += price;
  });
  
  stats.avgPrice = shipments.length > 0 ? (totalPrice / shipments.length).toFixed(2) : 0;
  stats.deliveryRate = shipments.length > 0 ? ((stats.delivered / shipments.length) * 100).toFixed(1) : 0;
  
  return stats;
}

/**
 * توزيع حسب الحالة
 * @param {Array} shipments - الشحنات
 * @returns {Array} التوزيع
 */
function calculateStatusDistribution(shipments) {
  const counts = {};
  
  shipments.forEach(function(s) {
    const status = s.Status || 'غير محدد';
    if (!counts[status]) counts[status] = 0;
    counts[status]++;
  });
  
  return Object.keys(counts).map(function(status) {
    return {
      label: status,
      value: counts[status],
      color: STATUS_COLORS[status] || '#999'
    };
  });
}

/**
 * توزيع حسب المحافظة
 * @param {Array} shipments - الشحنات
 * @returns {Array} التوزيع
 */
function calculateGovernorateDistribution(shipments) {
  const counts = {};
  
  shipments.forEach(function(s) {
    const gov = s.Governorate || 'غير محدد';
    if (!counts[gov]) counts[gov] = 0;
    counts[gov]++;
  });
  
  const result = Object.keys(counts).map(function(gov) {
    return {
      label: gov,
      value: counts[gov]
    };
  });
  
  return result.sort(function(a, b) {
    return b.value - a.value;
  });
}

/**
 * توزيع حسب الموظف
 * @param {Array} shipments - الشحنات
 * @returns {Array} التوزيع
 */
function calculateEmployeeDistribution(shipments) {
  const counts = {};
  
  shipments.forEach(function(s) {
    const emp = s.AssignedEmployee || 'غير موزعة';
    if (!counts[emp]) counts[emp] = { count: 0, name: 'غير موزعة' };
    counts[emp].count++;
  });
  
  // الحصول على أسماء الموظفين
  const employees = getActiveEmployees(false);
  const empMap = {};
  employees.forEach(function(e) {
    empMap[e.ID] = e.Name || e.Username;
  });
  
  return Object.keys(counts).map(function(empId) {
    return {
      label: empMap[empId] || counts[empId].name,
      value: counts[empId].count
    };
  }).sort(function(a, b) {
    return b.value - a.value;
  });
}

/**
 * توزيع حسب الأولوية
 * @param {Array} shipments - الشحنات
 * @returns {Array} التوزيع
 */
function calculatePriorityDistribution(shipments) {
  const counts = {};
  
  shipments.forEach(function(s) {
    const priority = s.Priority || 'عادي';
    if (!counts[priority]) counts[priority] = 0;
    counts[priority]++;
  });
  
  return Object.keys(counts).map(function(priority) {
    return {
      label: priority,
      value: counts[priority],
      color: PRIORITY_COLORS[priority] || '#999'
    };
  });
}

/**
 * إحصائيات يومية
 * @param {Array} shipments - الشحنات
 * @param {Object} filters - الفلاتر
 * @returns {Array} الإحصائيات اليومية
 */
function calculateDailyStats(shipments, filters) {
  const days = [];
  const dayCount = 7;
  
  for (let i = dayCount - 1; i >= 0; i--) {
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
    
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const label = i === 0 ? 'اليوم' : (i === 1 ? 'أمس' : dayNames[date.getDay()]);
    
    days.push({
      label: label,
      date: formatDate(date, 'yyyy-MM-dd'),
      created: dayShipments.length,
      delivered: dayDelivered.length
    });
  }
  
  return days;
}

/**
 * أداء الموظفين للتقرير
 * @param {Array} shipments - الشحنات
 * @returns {Array} الأداء
 */
function calculateEmployeeReportStats(shipments) {
  const empStats = {};
  
  shipments.forEach(function(s) {
    const empId = s.AssignedEmployee;
    if (!empId) return;
    
    if (!empStats[empId]) {
      empStats[empId] = {
        id: empId,
        total: 0,
        delivered: 0,
        noAnswer: 0,
        postponed: 0,
        returned: 0,
        totalValue: 0
      };
    }
    
    empStats[empId].total++;
    empStats[empId].totalValue += toNumber(s.Price);
    
    if (s.Status === SHIPMENT_STATUS.DELIVERED) empStats[empId].delivered++;
    if (s.Status === SHIPMENT_STATUS.NO_ANSWER) empStats[empId].noAnswer++;
    if (s.Status === SHIPMENT_STATUS.POSTPONED) empStats[empId].postponed++;
    if (s.Status === SHIPMENT_STATUS.RETURNED) empStats[empId].returned++;
  });
  
  // الحصول على أسماء الموظفين
  const employees = getActiveEmployees(false);
  const empMap = {};
  employees.forEach(function(e) {
    empMap[e.ID] = e.Name || e.Username;
  });
  
  return Object.values(empStats).map(function(stat) {
    return {
      id: stat.id,
      name: empMap[stat.id] || stat.id,
      total: stat.total,
      delivered: stat.delivered,
      deliveryRate: stat.total > 0 ? ((stat.delivered / stat.total) * 100).toFixed(1) : 0,
      noAnswer: stat.noAnswer,
      postponed: stat.postponed,
      returned: stat.returned,
      totalValue: stat.totalValue
    };
  }).sort(function(a, b) {
    return b.delivered - a.delivered;
  });
}

// ============================================
// تصدير التقارير
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
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    // تصفية إضافية حسب الصلاحيات
    if (!hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS')) {
      shipments = shipments.filter(function(s) {
        return s.AssignedEmployee === auth.user.id;
      });
    }
    
    // تصفية غير مؤرشفة
    shipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    // تطبيق فلاتر
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          return new Date(s.CreatedAt) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          return new Date(s.CreatedAt) <= toDate;
        });
      }
      
      if (filters.status && filters.status !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.Status === filters.status;
        });
      }
      
      if (filters.governorate && filters.governorate !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.Governorate === filters.governorate;
        });
      }
      
      if (filters.employee && filters.employee !== 'all') {
        shipments = shipments.filter(function(s) {
          return s.AssignedEmployee === filters.employee;
        });
      }
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
    logError('Export Report CSV Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.EXPORT_ERROR);
  }
}

// ============================================
// تقرير أداء موظف
// ============================================

/**
 * الحصول على تقرير أداء موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @param {Object} filters - الفلاتر
 * @returns {Object} التقرير
 */
function getEmployeeReport(token, employeeId, filters) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // يمكن للموظف رؤية تقريره فقط
    if (auth.user.id !== employeeId && !hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS')) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN);
    }
    
    let shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    shipments = shipments.filter(function(s) {
      return s.AssignedEmployee === employeeId;
    });
    
    // تصفية غير مؤرشفة
    shipments = shipments.filter(function(s) {
      return s.IsArchived !== 'true' && s.IsArchived !== true;
    });
    
    // تطبيق فلاتر التاريخ
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          return new Date(s.CreatedAt) >= fromDate;
        });
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        shipments = shipments.filter(function(s) {
          if (!s.CreatedAt) return false;
          return new Date(s.CreatedAt) <= toDate;
        });
      }
    }
    
    const stats = {
      totalShipments: shipments.length,
      delivered: 0,
      noAnswer: 0,
      postponed: 0,
      returned: 0,
      rejected: 0,
      totalValue: 0,
      deliveredValue: 0,
      avgDeliveryTime: 0
    };
    
    let deliveryCount = 0;
    let totalDeliveryHours = 0;
    
    shipments.forEach(function(s) {
      const price = toNumber(s.Price);
      stats.totalValue += price;
      
      if (s.Status === SHIPMENT_STATUS.DELIVERED) {
        stats.delivered++;
        stats.deliveredValue += price;
        
        // حساب وقت التسليم
        if (s.CreatedAt && s.UpdatedAt) {
          const created = new Date(s.CreatedAt);
          const updated = new Date(s.UpdatedAt);
          const hours = (updated - created) / (1000 * 60 * 60);
          totalDeliveryHours += hours;
          deliveryCount++;
        }
      }
      else if (s.Status === SHIPMENT_STATUS.NO_ANSWER) stats.noAnswer++;
      else if (s.Status === SHIPMENT_STATUS.POSTPONED) stats.postponed++;
      else if (s.Status === SHIPMENT_STATUS.RETURNED) stats.returned++;
      else if (s.Status === SHIPMENT_STATUS.REJECTED_QUALITY || s.Status === SHIPMENT_STATUS.REJECTED_DELAY) {
        stats.rejected++;
      }
    });
    
    stats.deliveryRate = stats.totalShipments > 0 ? ((stats.delivered / stats.totalShipments) * 100).toFixed(1) : 0;
    stats.avgDeliveryTime = deliveryCount > 0 ? (totalDeliveryHours / deliveryCount).toFixed(1) : 0;
    
    // الحصول على سجل العمليات للموظف
    const history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    const employeeHistory = history.filter(function(h) {
      return h.EmployeeID === employeeId;
    });
    
    const activityStats = {
      totalActions: employeeHistory.length,
      statusChanges: 0,
      notesAdded: 0
    };
    
    employeeHistory.forEach(function(h) {
      if (h.ActionType === ACTION_TYPES.STATUS_CHANGE) activityStats.statusChanges++;
      if (h.ActionType === ACTION_TYPES.NOTE_ADDED) activityStats.notesAdded++;
    });
    
    return successResponse({
      employeeId: employeeId,
      stats: stats,
      activity: activityStats,
      period: filters || {}
    }, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employee Report Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تقرير عام للنظام
// ============================================

/**
 * الحصول على تقرير عام للنظام
 * @param {string} token - رمز الجلسة
 * @param {Object} filters - الفلاتر
 * @returns {Object} التقرير
 */
function getSystemReport(token, filters) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const employees = getActiveEmployees(false);
    const history = getSheetDataAsObjects(SHEET_NAMES.HISTORY, false);
    
    const report = {
      overview: {
        totalShipments: shipments.length,
        activeShipments: shipments.filter(function(s) {
          return s.IsArchived !== 'true' && s.IsArchived !== true;
        }).length,
        archivedShipments: shipments.filter(function(s) {
          return s.IsArchived === 'true' || s.IsArchived === true;
        }).length,
        totalEmployees: employees.length,
        totalActions: history.length
      },
      shipments: calculateShipmentStats(shipments),
      topGovernorates: calculateGovernorateDistribution(shipments).slice(0, 5),
      topEmployees: calculateEmployeeReportStats(shipments).slice(0, 5),
      recentActivity: history.sort(function(a, b) {
        return new Date(b.Timestamp) - new Date(a.Timestamp);
      }).slice(0, 10).map(function(h) {
        return {
          action: h.ActionType,
          employee: h.EmployeeName,
          timestamp: h.Timestamp
        };
      })
    };
    
    return successResponse(report, 'تم بنجاح');
    
  } catch (e) {
    logError('Get System Report Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}
