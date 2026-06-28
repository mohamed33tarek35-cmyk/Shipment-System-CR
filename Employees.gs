/**
 * ============================================
 * Employees.gs - إدارة الموظفين
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة الموظفين:
 * - CRUD للموظفين
 * - تفعيل/تعطيل الحساب
 * - إعادة تعيين كلمة المرور
 * - إحصائيات الموظفين
 */

// ============================================
// الحصول على قائمة الموظفين
// ============================================

/**
 * الحصول على قائمة الموظفين
 * @param {string} token - رمز الجلسة
 * @returns {Object} قائمة الموظفين
 */
function getEmployeesList(token) {
  try {
    const auth = requirePermission(token, 'VIEW_EMPLOYEES');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employees = getSheetDataAsObjects(SHEET_NAMES.EMPLOYEES, false);
    
    // تنسيق البيانات (إخفاء كلمة المرور)
    const formatted = employees.map(function(emp) {
      return {
        id: emp.ID,
        username: emp.Username,
        name: emp.Name,
        email: emp.Email,
        phone: emp.Phone,
        role: emp.Role,
        roleName: getRoleName(emp.Role),
        isActive: emp.IsActive === 'true' || emp.IsActive === true,
        lastLogin: emp.LastLogin,
        createdAt: emp.CreatedAt,
        updatedAt: emp.UpdatedAt
      };
    });
    
    return successResponse(formatted, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employees List Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// الحصول على تفاصيل موظف
// ============================================

/**
 * الحصول على تفاصيل موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} تفاصيل الموظف
 */
function getEmployeeDetail(token, employeeId) {
  try {
    const auth = requirePermission(token, 'VIEW_EMPLOYEES');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // الحصول على الصلاحيات
    let permissions = [];
    try {
      permissions = JSON.parse(employee.Permissions || '[]');
    } catch (e) {
      permissions = [];
    }
    
    // الحصول على عدد الشحنات
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const assignedShipments = shipments.filter(function(s) {
      return s.AssignedEmployee === employeeId;
    }).length;
    
    const detail = {
      id: employee.ID,
      username: employee.Username,
      name: employee.Name,
      email: employee.Email,
      phone: employee.Phone,
      role: employee.Role,
      roleName: getRoleName(employee.Role),
      permissions: permissions,
      isActive: employee.IsActive === 'true' || employee.IsActive === true,
      lastLogin: employee.LastLogin,
      createdAt: employee.CreatedAt,
      updatedAt: employee.UpdatedAt,
      assignedShipments: assignedShipments
    };
    
    return successResponse(detail, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employee Detail Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إنشاء موظف جديد
// ============================================

/**
 * إنشاء موظف جديد
 * @param {string} token - رمز الجلسة
 * @param {Object} employee - بيانات الموظف
 * @returns {Object} نتيجة الإنشاء
 */
function createEmployeeData(token, employee) {
  try {
    const auth = requirePermission(token, 'ADD_EMPLOYEE');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من البيانات
    const validation = validateEmployee(employee, true);
    if (!validation.valid) {
      return errorResponse(ERROR_MESSAGES.VALIDATION_ERROR, { errors: validation.errors });
    }
    
    // التحقق من عدم التكرار
    const existing = getEmployeeByUsername(employee.Username);
    if (existing) {
      return errorResponse('اسم المستخدم مستخدم مسبقاً');
    }
    
    // إنشاء كلمة المرور
    const salt = generateSalt();
    const password = employee.Password || '123456';
    const hash = hashPassword(password, salt);
    
    // الحصول على صلاحيات الدور الافتراضية
    const role = getRoleByKey(employee.Role);
    const defaultPermissions = role ? (role.Permissions || []) : [];
    
    const newEmployee = {
      ID: generateId('EMP'),
      Username: employee.Username,
      PasswordHash: hash,
      Salt: salt,
      Name: employee.Name,
      Email: employee.Email || '',
      Phone: employee.Phone || '',
      Role: employee.Role,
      Permissions: JSON.stringify(employee.Permissions || defaultPermissions),
      IsActive: 'true',
      LastLogin: '',
      CreatedAt: getCurrentDateTime(),
      UpdatedAt: getCurrentDateTime()
    };
    
    const result = insertRow(SHEET_NAMES.EMPLOYEES, newEmployee);
    
    if (result.success) {
      logAction(ACTION_TYPES.CREATE, auth.user.username, {
        employeeId: newEmployee.ID,
        username: newEmployee.Username,
        role: newEmployee.Role
      });
      
      return successResponse({ id: newEmployee.ID }, SUCCESS_MESSAGES.CREATED);
    }
    
    return errorResponse('فشل في إنشاء الموظف');
    
  } catch (e) {
    logError('Create Employee Data Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تحديث موظف
// ============================================

/**
 * تحديث بيانات موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @param {Object} employee - البيانات الجديدة
 * @returns {Object} نتيجة التحديث
 */
function updateEmployeeData(token, employeeId, employee) {
  try {
    const auth = requirePermission(token, 'EDIT_EMPLOYEE');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const existing = getEmployeeById(employeeId);
    if (!existing) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن تعديل Admin آخر
    if (existing.Role === 'SYSTEM_ADMIN' && auth.user.id !== employeeId) {
      return errorResponse('لا يمكن تعديل مدير النظام');
    }
    
    // التحقق من اسم المستخدم إذا تغير
    if (employee.Username && employee.Username !== existing.Username) {
      const duplicate = getEmployeeByUsername(employee.Username);
      if (duplicate && duplicate.ID !== employeeId) {
        return errorResponse('اسم المستخدم مستخدم مسبقاً');
      }
    }
    
    // تحديث الحقول
    if (employee.Username) existing.Username = employee.Username;
    if (employee.Name) existing.Name = employee.Name;
    if (employee.Email !== undefined) existing.Email = employee.Email;
    if (employee.Phone !== undefined) existing.Phone = employee.Phone;
    if (employee.Role) existing.Role = employee.Role;
    if (employee.Permissions) existing.Permissions = JSON.stringify(employee.Permissions);
    
    existing.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, existing);
    
    if (result.success) {
      // إنهاء جلسات الموظف إذا تم تغيير الدور أو الصلاحيات
      if (employee.Role || employee.Permissions) {
        invalidateUserSessions(employeeId);
      }
      
      logAction(ACTION_TYPES.UPDATE, auth.user.username, {
        employeeId: employeeId,
        changes: Object.keys(employee).join(', ')
      });
      
      return successResponse(null, SUCCESS_MESSAGES.UPDATED);
    }
    
    return errorResponse('فشل في التحديث');
    
  } catch (e) {
    logError('Update Employee Data Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// حذف موظف
// ============================================

/**
 * حذف موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} نتيجة الحذف
 */
function deleteEmployeeData(token, employeeId) {
  try {
    const auth = requirePermission(token, 'DELETE_EMPLOYEE');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const existing = getEmployeeById(employeeId);
    if (!existing) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن حذف Admin
    if (existing.Role === 'SYSTEM_ADMIN') {
      return errorResponse('لا يمكن حذف مدير النظام');
    }
    
    // لا يمكن حذف نفسك
    if (auth.user.id === employeeId) {
      return errorResponse('لا يمكن حذف حسابك الحالي');
    }
    
    // التحقق من وجود شحنات مرتبطة
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    const hasShipments = shipments.some(function(s) {
      return s.AssignedEmployee === employeeId;
    });
    
    if (hasShipments) {
      return errorResponse('لا يمكن حذف الموظف، يوجد شحنات مرتبطة به. قم بنقل الشحنات أولاً.');
    }
    
    // إنهاء جلسات الموظف
    invalidateUserSessions(employeeId);
    
    const result = deleteRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId);
    
    if (result.success) {
      logAction(ACTION_TYPES.DELETE, auth.user.username, {
        employeeId: employeeId,
        username: existing.Username
      });
      
      return successResponse(null, SUCCESS_MESSAGES.DELETED);
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Employee Data Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تفعيل/تعطيل موظف
// ============================================

/**
 * تفعيل أو تعطيل حساب موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} نتيجة العملية
 */
function toggleEmployeeStatus(token, employeeId) {
  try {
    const auth = requirePermission(token, 'EDIT_EMPLOYEE');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const existing = getEmployeeById(employeeId);
    if (!existing) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن تعطيل Admin
    if (existing.Role === 'SYSTEM_ADMIN') {
      return errorResponse('لا يمكن تغيير حالة مدير النظام');
    }
    
    const currentStatus = existing.IsActive === 'true' || existing.IsActive === true;
    const newStatus = !currentStatus;
    
    existing.IsActive = newStatus ? 'true' : 'false';
    existing.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, existing);
    
    if (result.success) {
      // إنهاء الجلسات إذا تم التعطيل
      if (!newStatus) {
        invalidateUserSessions(employeeId);
      }
      
      logAction('EMPLOYEE_STATUS_CHANGED', auth.user.username, {
        employeeId: employeeId,
        newStatus: newStatus ? 'active' : 'inactive'
      });
      
      return successResponse({
        isActive: newStatus
      }, newStatus ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
    }
    
    return errorResponse('فشل في تغيير الحالة');
    
  } catch (e) {
    logError('Toggle Employee Status Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إعادة تعيين كلمة المرور
// ============================================

/**
 * إعادة تعيين كلمة المرور (Admin)
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @param {string} newPassword - كلمة المرور الجديدة
 * @returns {Object} نتيجة العملية
 */
function resetPassword(token, employeeId, newPassword) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    if (!newPassword || newPassword.length < SYSTEM_CONFIG.PASSWORD_MIN_LENGTH) {
      return errorResponse(ERROR_MESSAGES.PASSWORD_TOO_SHORT);
    }
    
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);
    
    employee.PasswordHash = newHash;
    employee.Salt = newSalt;
    employee.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, employee);
    
    if (result.success) {
      // إنهاء جميع جلسات الموظف
      invalidateUserSessions(employeeId);
      
      logAction('PASSWORD_RESET', auth.user.username, {
        targetEmployee: employeeId,
        targetUsername: employee.Username
      });
      
      return successResponse(null, 'تم إعادة تعيين كلمة المرور بنجاح');
    }
    
    return errorResponse('فشل في إعادة التعيين');
    
  } catch (e) {
    logError('Reset Password Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إحصائيات الموظفين
// ============================================

/**
 * الحصول على إحصائيات الموظفين
 * @param {string} token - رمز الجلسة
 * @returns {Object} الإحصائيات
 */
function getEmployeesStats(token) {
  try {
    const auth = requirePermission(token, 'VIEW_EMPLOYEES');
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employees = getSheetDataAsObjects(SHEET_NAMES.EMPLOYEES, false);
    const shipments = getSheetDataAsObjects(SHEET_NAMES.SHIPMENTS, false);
    
    const stats = {
      totalEmployees: employees.length,
      activeEmployees: 0,
      inactiveEmployees: 0,
      byRole: {},
      totalShipments: shipments.length,
      avgShipmentsPerEmployee: 0
    };
    
    employees.forEach(function(emp) {
      if (emp.IsActive === 'true' || emp.IsActive === true) {
        stats.activeEmployees++;
      } else {
        stats.inactiveEmployees++;
      }
      
      const role = emp.Role || 'غير محدد';
      if (!stats.byRole[role]) {
        stats.byRole[role] = { count: 0, name: getRoleName(role) };
      }
      stats.byRole[role].count++;
    });
    
    const activeEmps = employees.filter(function(e) {
      return e.IsActive === 'true' || e.IsActive === true;
    });
    
    stats.avgShipmentsPerEmployee = activeEmps.length > 0 ? 
      Math.round(shipments.length / activeEmps.length) : 0;
    
    return successResponse(stats, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employees Stats Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// دوال مساعدة
// ============================================

/**
 * الحصول على اسم الدور
 * @param {string} roleKey - مفتاح الدور
 * @returns {string} اسم الدور
 */
function getRoleName(roleKey) {
  const role = getRoleByKey(roleKey);
  return role ? role.RoleName : roleKey;
}
