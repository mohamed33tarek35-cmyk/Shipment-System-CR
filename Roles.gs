/**
 * ============================================
 * Roles.gs - إدارة الأدوار والصلاحيات
 * ============================================
 * 
 * يحتوي على جميع دوال إدارة الأدوار والصلاحيات:
 * - CRUD للأدوار
 * - CRUD للصلاحيات
 * - تعيين الصلاحيات للموظفين
 * - التحقق من الصلاحيات الديناميكية
 */

// ============================================
// إدارة الأدوار (Roles)
// ============================================

/**
 * الحصول على جميع الأدوار مع الصلاحيات
 * @param {string} token - رمز الجلسة
 * @returns {Object} الأدوار
 */
function getRoles(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!hasPermission(auth.user.permissions, 'MANAGE_ROLES') && 
        auth.user.role !== 'SYSTEM_ADMIN') {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN);
    }
    
    const roles = getAllRoles();
    
    return successResponse(roles, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Roles Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * الحصول على دور واحد
 * @param {string} token - رمز الجلسة
 * @param {string} roleId - معرف الدور
 * @returns {Object} الدور
 */
function getRole(token, roleId) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (!hasPermission(auth.user.permissions, 'MANAGE_ROLES') && 
        auth.user.role !== 'SYSTEM_ADMIN') {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN);
    }
    
    const roles = getAllRoles();
    for (let i = 0; i < roles.length; i++) {
      if (roles[i].ID === roleId) {
        return successResponse(roles[i], 'تم بنجاح');
      }
    }
    
    return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    
  } catch (e) {
    logError('Get Role Error', { roleId: roleId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * إضافة دور جديد
 * @param {string} token - رمز الجلسة
 * @param {Object} roleData - بيانات الدور
 * @returns {Object} نتيجة الإضافة
 */
function createRole(token, roleData) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من البيانات
    if (isEmpty(roleData.roleName)) {
      return errorResponse('اسم الدور مطلوب');
    }
    
    if (isEmpty(roleData.roleKey)) {
      return errorResponse('مفتاح الدور مطلوب');
    }
    
    // التحقق من عدم التكرار
    const existing = getRoleByKey(roleData.roleKey);
    if (existing) {
      return errorResponse('مفتاح الدور مستخدم مسبقاً');
    }
    
    const role = {
      ID: generateId('ROL'),
      RoleName: roleData.roleName,
      RoleKey: roleData.roleKey,
      Permissions: JSON.stringify(roleData.permissions || []),
      Description: roleData.description || '',
      CreatedAt: getCurrentDateTime(),
      UpdatedAt: getCurrentDateTime()
    };
    
    const result = insertRow(SHEET_NAMES.ROLES, role);
    
    if (result.success) {
      // تحديث Cache
      cacheRemove(CACHE_KEYS.ROLES);
      
      logAction('ROLE_CREATED', auth.user.username, {
        roleId: role.ID,
        roleName: role.RoleName,
        roleKey: role.RoleKey
      });
      
      return successResponse({ id: role.ID }, 'تم إنشاء الدور بنجاح');
    }
    
    return errorResponse('فشل في إنشاء الدور');
    
  } catch (e) {
    logError('Create Role Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديث دور
 * @param {string} token - رمز الجلسة
 * @param {string} roleId - معرف الدور
 * @param {Object} roleData - البيانات الجديدة
 * @returns {Object} نتيجة التحديث
 */
function updateRole(token, roleId, roleData) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const role = findById(SHEET_NAMES.ROLES, 'ID', roleId);
    if (!role) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن تعديل الأدوار الافتراضية
    const defaultRoleKeys = ['SYSTEM_ADMIN', 'TEAM_LEADER', 'SENIOR_CS', 'EMPLOYEE'];
    if (defaultRoleKeys.indexOf(role.RoleKey) !== -1) {
      // يمكن تعديل الصلاحيات فقط
      if (roleData.permissions) {
        role.Permissions = JSON.stringify(roleData.permissions);
        role.UpdatedAt = getCurrentDateTime();
        
        const result = updateRow(SHEET_NAMES.ROLES, 'ID', roleId, role);
        
        if (result.success) {
          cacheRemove(CACHE_KEYS.ROLES);
          
          logAction('ROLE_UPDATED', auth.user.username, {
            roleId: roleId,
            roleKey: role.RoleKey
          });
          
          return successResponse(null, 'تم تحديث صلاحيات الدور بنجاح');
        }
      }
      
      return errorResponse('لا يمكن تعديل بيانات الأدوار الافتراضية');
    }
    
    // تحديث البيانات
    if (roleData.roleName) role.RoleName = roleData.roleName;
    if (roleData.permissions) role.Permissions = JSON.stringify(roleData.permissions);
    if (roleData.description !== undefined) role.Description = roleData.description;
    role.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.ROLES, 'ID', roleId, role);
    
    if (result.success) {
      cacheRemove(CACHE_KEYS.ROLES);
      
      logAction('ROLE_UPDATED', auth.user.username, {
        roleId: roleId,
        roleKey: role.RoleKey
      });
      
      return successResponse(null, 'تم تحديث الدور بنجاح');
    }
    
    return errorResponse('فشل في التحديث');
    
  } catch (e) {
    logError('Update Role Error', { roleId: roleId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * حذف دور
 * @param {string} token - رمز الجلسة
 * @param {string} roleId - معرف الدور
 * @returns {Object} نتيجة الحذف
 */
function deleteRole(token, roleId) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const role = findById(SHEET_NAMES.ROLES, 'ID', roleId);
    if (!role) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن حذف الأدوار الافتراضية
    const defaultRoleKeys = ['SYSTEM_ADMIN', 'TEAM_LEADER', 'SENIOR_CS', 'EMPLOYEE'];
    if (defaultRoleKeys.indexOf(role.RoleKey) !== -1) {
      return errorResponse('لا يمكن حذف الأدوار الافتراضية');
    }
    
    // التحقق من عدم وجود موظفين مرتبطين
    const employees = getSheetDataAsObjects(SHEET_NAMES.EMPLOYEES, false);
    const hasEmployees = employees.some(function(emp) {
      return emp.Role === role.RoleKey;
    });
    
    if (hasEmployees) {
      return errorResponse('لا يمكن حذف الدور، يوجد موظفين مرتبطين به');
    }
    
    const result = deleteRow(SHEET_NAMES.ROLES, 'ID', roleId);
    
    if (result.success) {
      cacheRemove(CACHE_KEYS.ROLES);
      
      logAction('ROLE_DELETED', auth.user.username, {
        roleId: roleId,
        roleKey: role.RoleKey
      });
      
      return successResponse(null, 'تم حذف الدور بنجاح');
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Role Error', { roleId: roleId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إدارة الصلاحيات (Permissions)
// ============================================

/**
 * الحصول على جميع الصلاحيات مصنفة
 * @param {string} token - رمز الجلسة
 * @returns {Object} الصلاحيات مصنفة
 */
function getPermissions(token) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const permissions = getAllPermissions();
    
    // تصنيف الصلاحيات حسب الفئة
    const categorized = {};
    for (let i = 0; i < permissions.length; i++) {
      const perm = permissions[i];
      const category = perm.Category || 'عام';
      
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      categorized[category].push({
        id: perm.ID,
        key: perm.PermissionKey,
        name: perm.PermissionName,
        description: perm.Description
      });
    }
    
    return successResponse(categorized, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Permissions Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * إضافة صلاحية جديدة
 * @param {string} token - رمز الجلسة
 * @param {Object} permData - بيانات الصلاحية
 * @returns {Object} نتيجة الإضافة
 */
function createPermission(token, permData) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    if (isEmpty(permData.permissionKey)) {
      return errorResponse('مفتاح الصلاحية مطلوب');
    }
    
    if (isEmpty(permData.permissionName)) {
      return errorResponse('اسم الصلاحية مطلوب');
    }
    
    // التحقق من عدم التكرار
    const allPerms = getAllPermissions();
    for (let i = 0; i < allPerms.length; i++) {
      if (allPerms[i].PermissionKey === permData.permissionKey) {
        return errorResponse('مفتاح الصلاحية مستخدم مسبقاً');
      }
    }
    
    const perm = {
      ID: generateId('PERM'),
      PermissionKey: permData.permissionKey,
      PermissionName: permData.permissionName,
      Description: permData.description || '',
      Category: permData.category || 'عام',
      CreatedAt: getCurrentDateTime()
    };
    
    const result = insertRow(SHEET_NAMES.PERMISSIONS, perm);
    
    if (result.success) {
      cacheRemove(CACHE_KEYS.PERMISSIONS);
      
      logAction('PERMISSION_CREATED', auth.user.username, {
        permId: perm.ID,
        permKey: perm.PermissionKey
      });
      
      return successResponse({ id: perm.ID }, 'تم إنشاء الصلاحية بنجاح');
    }
    
    return errorResponse('فشل في الإنشاء');
    
  } catch (e) {
    logError('Create Permission Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * حذف صلاحية
 * @param {string} token - رمز الجلسة
 * @param {string} permId - معرف الصلاحية
 * @returns {Object} نتيجة الحذف
 */
function deletePermission(token, permId) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const perm = findById(SHEET_NAMES.PERMISSIONS, 'ID', permId);
    if (!perm) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // التحقق من عدم استخدامها في أدوار
    const roles = getAllRoles();
    for (let i = 0; i < roles.length; i++) {
      if (roles[i].Permissions && roles[i].Permissions.indexOf(perm.PermissionKey) !== -1) {
        return errorResponse('لا يمكن حذف الصلاحية، مستخدمة في أدوار');
      }
    }
    
    const result = deleteRow(SHEET_NAMES.PERMISSIONS, 'ID', permId);
    
    if (result.success) {
      cacheRemove(CACHE_KEYS.PERMISSIONS);
      
      logAction('PERMISSION_DELETED', auth.user.username, {
        permId: permId,
        permKey: perm.PermissionKey
      });
      
      return successResponse(null, 'تم حذف الصلاحية بنجاح');
    }
    
    return errorResponse('فشل في الحذف');
    
  } catch (e) {
    logError('Delete Permission Error', { permId: permId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// تعيين الصلاحيات للموظفين
// ============================================

/**
 * الحصول على صلاحيات موظف معين
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} الصلاحيات
 */
function getEmployeePermissionsList(token, employeeId) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // يمكن للموظف رؤية صلاحياته فقط
    if (auth.user.id !== employeeId && 
        !hasPermission(auth.user.permissions, 'MANAGE_ROLES') &&
        auth.user.role !== 'SYSTEM_ADMIN') {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN);
    }
    
    const permissions = getEmployeePermissions(employeeId);
    const allPerms = getAllPermissions();
    
    const result = [];
    for (let i = 0; i < allPerms.length; i++) {
      result.push({
        id: allPerms[i].ID,
        key: allPerms[i].PermissionKey,
        name: allPerms[i].PermissionName,
        category: allPerms[i].Category,
        granted: permissions.indexOf(allPerms[i].PermissionKey) !== -1
      });
    }
    
    return successResponse(result, 'تم بنجاح');
    
  } catch (e) {
    logError('Get Employee Permissions Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تحديث صلاحيات موظف
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @param {Array} permissions - قائمة الصلاحيات
 * @returns {Object} نتيجة التحديث
 */
function updateEmployeePermissions(token, employeeId, permissions) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // لا يمكن تعديل صلاحيات الـ Admin نفسه
    if (employee.Role === 'SYSTEM_ADMIN' && auth.user.id !== employeeId) {
      return errorResponse('لا يمكن تعديل صلاحيات مدير النظام');
    }
    
    // تحديث الصلاحيات
    employee.Permissions = JSON.stringify(permissions || []);
    employee.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, employee);
    
    if (result.success) {
      // إنهاء جلسات الموظف لتطبيق التغييرات
      invalidateUserSessions(employeeId);
      
      logAction('EMPLOYEE_PERMISSIONS_UPDATED', auth.user.username, {
        targetEmployee: employeeId,
        permissions: permissions
      });
      
      return successResponse(null, 'تم تحديث الصلاحيات بنجاح');
    }
    
    return errorResponse('فشل في التحديث');
    
  } catch (e) {
    logError('Update Employee Permissions Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * إعادة تعيين صلاحيات موظف للافتراضية (حسب الدور)
 * @param {string} token - رمز الجلسة
 * @param {string} employeeId - معرف الموظف
 * @returns {Object} نتيجة العملية
 */
function resetEmployeePermissions(token, employeeId) {
  try {
    const auth = requireAdmin(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    // الحصول على صلاحيات الدور الافتراضية
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[employee.Role] || [];
    
    employee.Permissions = JSON.stringify(rolePerms);
    employee.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employeeId, employee);
    
    if (result.success) {
      invalidateUserSessions(employeeId);
      
      logAction('EMPLOYEE_PERMISSIONS_RESET', auth.user.username, {
        targetEmployee: employeeId,
        role: employee.Role
      });
      
      return successResponse(null, 'تم إعادة تعيين الصلاحيات للافتراضية');
    }
    
    return errorResponse('فشل في العملية');
    
  } catch (e) {
    logError('Reset Employee Permissions Error', { employeeId: employeeId, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// دوال مساعدة
// ============================================

/**
 * الحصول على أسماء الأدوار للعرض
 * @returns {Array} الأدوار
 */
function getRoleOptions() {
  const roles = getAllRoles();
  return roles.map(function(role) {
    return {
      id: role.ID,
      key: role.RoleKey,
      name: role.RoleName
    };
  });
}

/**
 * التحقق من صلاحية دور
 * @param {string} roleKey - مفتاح الدور
 * @returns {boolean} true إذا صالح
 */
function isValidRole(roleKey) {
  const roles = getAllRoles();
  for (let i = 0; i < roles.length; i++) {
    if (roles[i].RoleKey === roleKey) {
      return true;
    }
  }
  return false;
}

/**
 * الحصول على اسم الدور
 * @param {string} roleKey - مفتاح الدور
 * @returns {string} اسم الدور
 */
function getRoleName(roleKey) {
  const role = getRoleByKey(roleKey);
  return role ? role.RoleName : roleKey;
}
