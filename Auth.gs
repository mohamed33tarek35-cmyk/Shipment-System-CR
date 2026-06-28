/**
 * ============================================
 * Auth.gs - نظام المصادقة وإدارة الجلسات
 * ============================================
 * 
 * يحتوي على جميع دوال المصادقة:
 * - تسجيل الدخول / الخروج
 * - إدارة الجلسات (Session Management)
 * - التحقق من الصلاحيات
 * - حماية من محاولات الدخول الفاشلة
 * - التحقق من صلاحية الجلسة
 */

// ============================================
// تسجيل الدخول
// ============================================

/**
 * تسجيل الدخول
 * @param {string} username - اسم المستخدم
 * @param {string} password - كلمة المرور
 * @returns {Object} نتيجة تسجيل الدخول
 */
function login(username, password) {
  try {
    // تطهير المدخلات
    username = sanitizeInput(username);
    password = sanitizeInput(password);
    
    // التحقق من المدخلات
    if (isEmpty(username) || isEmpty(password)) {
      return errorResponse(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }
    
    // البحث عن الموظف
    const employee = getEmployeeByUsername(username);
    
    if (!employee) {
      logAction('LOGIN_FAILED', username, { reason: 'User not found' });
      return errorResponse(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }
    
    // التحقق من تفعيل الحساب
    if (employee.IsActive !== 'true' && employee.IsActive !== true) {
      logAction('LOGIN_FAILED', username, { reason: 'Account inactive' });
      return errorResponse('الحساب غير مفعل، تواصل مع المسؤول');
    }
    
    // التحقق من كلمة المرور
    const isValid = verifyPassword(password, employee.Salt, employee.PasswordHash);
    
    if (!isValid) {
      logAction('LOGIN_FAILED', username, { reason: 'Invalid password' });
      return errorResponse(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }
    
    // إنشاء جلسة جديدة
    const sessionToken = generateSessionToken();
    const sessionData = {
      token: sessionToken,
      employeeId: employee.ID,
      username: employee.Username,
      name: employee.Name,
      role: employee.Role,
      permissions: getEmployeePermissions(employee.ID),
      loginTime: new Date().getTime(),
      lastActivity: new Date().getTime(),
      ip: getClientIP()
    };
    
    // تخزين الجلسة في Cache
    const cacheKey = CACHE_KEYS.SESSION_PREFIX + sessionToken;
    cachePut(cacheKey, sessionData, SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600);
    
    // تحديث آخر تسجيل دخول
    updateLastLogin(employee.ID);
    
    // تسجيل العملية
    logAction(ACTION_TYPES.LOGIN, employee.Username, { 
      name: employee.Name,
      role: employee.Role
    });
    
    return successResponse({
      token: sessionToken,
      user: {
        id: employee.ID,
        username: employee.Username,
        name: employee.Name,
        email: employee.Email,
        role: employee.Role,
        permissions: sessionData.permissions
      }
    }, SUCCESS_MESSAGES.LOGIN_SUCCESS);
    
  } catch (e) {
    logError('Login Error', { username: username, error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * تسجيل الخروج
 * @param {string} token - رمز الجلسة
 * @returns {Object} نتيجة تسجيل الخروج
 */
function logout(token) {
  try {
    if (!token) {
      return errorResponse(ERROR_MESSAGES.SESSION_INVALID);
    }
    
    // الحصول على بيانات الجلسة قبل الحذف
    const session = getSession(token);
    const username = session ? session.username : 'unknown';
    
    // حذف الجلسة من Cache
    const cacheKey = CACHE_KEYS.SESSION_PREFIX + token;
    cacheRemove(cacheKey);
    
    // تسجيل العملية
    logAction(ACTION_TYPES.LOGOUT, username, { token: maskSensitive(token) });
    
    return successResponse(null, SUCCESS_MESSAGES.LOGOUT_SUCCESS);
    
  } catch (e) {
    logError('Logout Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

// ============================================
// إدارة الجلسات
// ============================================

/**
 * الحصول على بيانات الجلسة
 * @param {string} token - رمز الجلسة
 * @returns {Object|null} بيانات الجلسة أو null
 */
function getSession(token) {
  if (!token) return null;
  
  try {
    const cacheKey = CACHE_KEYS.SESSION_PREFIX + token;
    const session = cacheGet(cacheKey);
    
    if (!session) return null;
    
    // التحقق من انتهاء الجلسة
    const now = new Date().getTime();
    const sessionDuration = SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600 * 1000;
    
    if (now - session.loginTime > sessionDuration) {
      // الجلسة منتهية
      cacheRemove(cacheKey);
      return null;
    }
    
    // تحديث آخر نشاط
    session.lastActivity = now;
    cachePut(cacheKey, session, SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600);
    
    return session;
    
  } catch (e) {
    logError('Get Session Error', { error: e.message });
    return null;
  }
}

/**
 * التحقق من صلاحية الجلسة
 * @param {string} token - رمز الجلسة
 * @returns {boolean} true إذا صالحة
 */
function isValidSession(token) {
  return getSession(token) !== null;
}

/**
 * تحديث الجلسة
 * @param {string} token - رمز الجلسة
 * @returns {Object|null} الجلسة المحدثة أو null
 */
function refreshSession(token) {
  const session = getSession(token);
  if (!session) return null;
  
  const cacheKey = CACHE_KEYS.SESSION_PREFIX + token;
  session.lastActivity = new Date().getTime();
  cachePut(cacheKey, session, SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600);
  
  return session;
}

/**
 * إنهاء جميع جلسات مستخدم
 * @param {string} employeeId - معرف الموظف
 */
function invalidateUserSessions(employeeId) {
  // في CacheService لا يمكننا البحث عن جميع المفاتيح
  // لذلك نستخدم workaround بتخزين قائمة الجلسات
  const userSessionsKey = 'user_sessions_' + employeeId;
  const sessionTokens = cacheGet(userSessionsKey) || [];
  
  for (let i = 0; i < sessionTokens.length; i++) {
    cacheRemove(CACHE_KEYS.SESSION_PREFIX + sessionTokens[i]);
  }
  
  cacheRemove(userSessionsKey);
}

/**
 * الحصول على المستخدم الحالي من الجلسة
 * @param {string} token - رمز الجلسة
 * @returns {Object|null} بيانات المستخدم أو null
 */
function getCurrentUser(token) {
  const session = getSession(token);
  if (!session) return null;
  
  return {
    id: session.employeeId,
    username: session.username,
    name: session.name,
    role: session.role,
    permissions: session.permissions
  };
}

// ============================================
// التحقق من الصلاحيات
// ============================================

/**
 * التحقق من أن المستخدم مسجل الدخول
 * @param {string} token - رمز الجلسة
 * @returns {Object} نتيجة التحقق
 */
function requireAuth(token) {
  const session = getSession(token);
  
  if (!session) {
    return {
      valid: false,
      error: ERROR_MESSAGES.SESSION_EXPIRED,
      code: 401
    };
  }
  
  return {
    valid: true,
    user: {
      id: session.employeeId,
      username: session.username,
      name: session.name,
      role: session.role,
      permissions: session.permissions
    }
  };
}

/**
 * التحقق من أن المستخدم Admin
 * @param {string} token - رمز الجلسة
 * @returns {Object} نتيجة التحقق
 */
function requireAdmin(token) {
  const auth = requireAuth(token);
  
  if (!auth.valid) {
    return auth;
  }
  
  if (auth.user.role !== 'SYSTEM_ADMIN') {
    return {
      valid: false,
      error: ERROR_MESSAGES.FORBIDDEN,
      code: 403
    };
  }
  
  return auth;
}

/**
 * التحقق من أن المستخدم يملك صلاحية معينة
 * @param {string} token - رمز الجلسة
 * @param {string} permission - الصلاحية المطلوبة
 * @returns {Object} نتيجة التحقق
 */
function requirePermission(token, permission) {
  const auth = requireAuth(token);
  
  if (!auth.valid) {
    return auth;
  }
  
  if (!hasPermission(auth.user.permissions, permission)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.FORBIDDEN,
      code: 403
    };
  }
  
  return auth;
}

/**
 * التحقق من أن المستخدم يملك أي من الصلاحيات
 * @param {string} token - رمز الجلسة
 * @param {Array} permissions - الصلاحيات المطلوبة
 * @returns {Object} نتيجة التحقق
 */
function requireAnyPermission(token, permissions) {
  const auth = requireAuth(token);
  
  if (!auth.valid) {
    return auth;
  }
  
  if (!hasAnyPermission(auth.user.permissions, permissions)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.FORBIDDEN,
      code: 403
    };
  }
  
  return auth;
}

/**
 * التحقق من أن المستخدم يملك جميع الصلاحيات
 * @param {string} token - رمز الجلسة
 * @param {Array} permissions - الصلاحيات المطلوبة
 * @returns {Object} نتيجة التحقق
 */
function requireAllPermissions(token, permissions) {
  const auth = requireAuth(token);
  
  if (!auth.valid) {
    return auth;
  }
  
  if (!hasAllPermissions(auth.user.permissions, permissions)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.FORBIDDEN,
      code: 403
    };
  }
  
  return auth;
}

/**
 * التحقق من أن المستخدم يمكنه رؤية شحنة معينة
 * @param {string} token - رمز الجلسة
 * @param {string} shipmentId - معرف الشحنة
 * @returns {Object} نتيجة التحقق
 */
function canViewShipment(token, shipmentId) {
  const auth = requireAuth(token);
  
  if (!auth.valid) {
    return auth;
  }
  
  // Admin و Team Leader يمكنهم رؤية الكل
  if (auth.user.role === 'SYSTEM_ADMIN' || auth.user.role === 'TEAM_LEADER') {
    return auth;
  }
  
  // Senior CS يمكنه رؤية الكل أيضاً
  if (hasPermission(auth.user.permissions, 'VIEW_ALL_SHIPMENTS')) {
    return auth;
  }
  
  // الموظف العادي يرى شحناته فقط
  const shipment = findById(SHEET_NAMES.SHIPMENTS, 'ID', shipmentId);
  if (!shipment) {
    return {
      valid: false,
      error: ERROR_MESSAGES.NOT_FOUND,
      code: 404
    };
  }
  
  if (shipment.AssignedEmployee !== auth.user.id) {
    return {
      valid: false,
      error: ERROR_MESSAGES.FORBIDDEN,
      code: 403
    };
  }
  
  return auth;
}

// ============================================
// تغيير كلمة المرور
// ============================================

/**
 * تغيير كلمة المرور
 * @param {string} token - رمز الجلسة
 * @param {string} currentPassword - كلمة المرور الحالية
 * @param {string} newPassword - كلمة المرور الجديدة
 * @returns {Object} نتيجة التغيير
 */
function changePassword(token, currentPassword, newPassword) {
  try {
    const auth = requireAuth(token);
    if (!auth.valid) {
      return errorResponse(auth.error);
    }
    
    // التحقق من كلمة المرور الحالية
    const employee = getEmployeeById(auth.user.id);
    if (!employee) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND);
    }
    
    const isValid = verifyPassword(currentPassword, employee.Salt, employee.PasswordHash);
    if (!isValid) {
      return errorResponse('كلمة المرور الحالية غير صحيحة');
    }
    
    // التحقق من قوة كلمة المرور الجديدة
    if (!newPassword || newPassword.length < SYSTEM_CONFIG.PASSWORD_MIN_LENGTH) {
      return errorResponse(ERROR_MESSAGES.PASSWORD_TOO_SHORT);
    }
    
    // تحديث كلمة المرور
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);
    
    employee.PasswordHash = newHash;
    employee.Salt = newSalt;
    employee.UpdatedAt = getCurrentDateTime();
    
    const result = updateRow(SHEET_NAMES.EMPLOYEES, 'ID', employee.ID, employee);
    
    if (result.success) {
      // إنهاء جميع الجلسات القديمة
      invalidateUserSessions(employee.ID);
      
      logAction(ACTION_TYPES.PASSWORD_CHANGE, auth.user.username, {
        employeeId: employee.ID
      });
      
      return successResponse(null, SUCCESS_MESSAGES.PASSWORD_CHANGED);
    }
    
    return errorResponse('فشل في تحديث كلمة المرور');
    
  } catch (e) {
    logError('Change Password Error', { error: e.message });
    return errorResponse(ERROR_MESSAGES.SERVER_ERROR);
  }
}

/**
 * إعادة تعيين كلمة المرور (Admin فقط)
 * @param {string} adminToken - رمز جلسة الـ Admin
 * @param {string} employeeId - معرف الموظف
 * @param {string} newPassword - كلمة المرور الجديدة
 * @returns {Object} نتيجة العملية
 */
function resetPassword(adminToken, employeeId, newPassword) {
  try {
    const auth = requireAdmin(adminToken);
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
// دوال مساعدة للـ Web App
// ============================================

/**
 * الحصول على Token من الطلب
 * @param {Object} e - كائن الحدث
 * @returns {string|null} الـ Token أو null
 */
function getTokenFromRequest(e) {
  // من Parameter
  if (e.parameter && e.parameter.token) {
    return e.parameter.token;
  }
  
  // من Post Data
  if (e.postData && e.postData.contents) {
    try {
      const data = JSON.parse(e.postData.contents);
      if (data.token) return data.token;
    } catch (err) {
      // ليس JSON
    }
  }
  
  return null;
}

/**
 * التحقق من صلاحية الطلب
 * @param {Object} e - كائن الحدث
 * @returns {Object} نتيجة التحقق
 */
function validateRequest(e) {
  const token = getTokenFromRequest(e);
  
  if (!token) {
    return {
      valid: false,
      error: ERROR_MESSAGES.SESSION_EXPIRED,
      code: 401
    };
  }
  
  return requireAuth(token);
}

/**
 * التحقق من صلاحية الطلب (Admin)
 * @param {Object} e - كائن الحدث
 * @returns {Object} نتيجة التحقق
 */
function validateAdminRequest(e) {
  const token = getTokenFromRequest(e);
  
  if (!token) {
    return {
      valid: false,
      error: ERROR_MESSAGES.SESSION_EXPIRED,
      code: 401
    };
  }
  
  return requireAdmin(token);
}

/**
 * الحصول على بيانات المستخدم من الطلب
 * @param {Object} e - كائن الحدث
 * @returns {Object|null} بيانات المستخدم أو null
 */
function getUserFromRequest(e) {
  const token = getTokenFromRequest(e);
  if (!token) return null;
  
  const session = getSession(token);
  if (!session) return null;
  
  return {
    id: session.employeeId,
    username: session.username,
    name: session.name,
    role: session.role,
    permissions: session.permissions
  };
}

// ============================================
// دوال حماية إضافية
// ============================================

/**
 * التحقق من محاولات الدخول الفاشلة
 * @param {string} username - اسم المستخدم
 * @returns {boolean} true إذا مسموح
 */
function checkLoginAttempts(username) {
  const cacheKey = 'login_attempts_' + username;
  const attempts = cacheGet(cacheKey) || { count: 0, lastAttempt: 0 };
  
  const now = new Date().getTime();
  const lockoutDuration = SYSTEM_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000;
  
  // إذا مر الوقت الكافي، إعادة العد
  if (now - attempts.lastAttempt > lockoutDuration) {
    cachePut(cacheKey, { count: 0, lastAttempt: now }, SYSTEM_CONFIG.LOCKOUT_DURATION_MINUTES * 60);
    return true;
  }
  
  // إذا تجاوز العدد المسموح
  if (attempts.count >= SYSTEM_CONFIG.MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  
  return true;
}

/**
 * تسجيل محاولة دخول فاشلة
 * @param {string} username - اسم المستخدم
 */
function recordFailedAttempt(username) {
  const cacheKey = 'login_attempts_' + username;
  const attempts = cacheGet(cacheKey) || { count: 0, lastAttempt: 0 };
  
  attempts.count++;
  attempts.lastAttempt = new Date().getTime();
  
  cachePut(cacheKey, attempts, SYSTEM_CONFIG.LOCKOUT_DURATION_MINUTES * 60);
}

/**
 * إعادة تعيين محاولات الدخول
 * @param {string} username - اسم المستخدم
 */
function resetLoginAttempts(username) {
  const cacheKey = 'login_attempts_' + username;
  cacheRemove(cacheKey);
}

/**
 * التحقق من أن الجلسة نشطة
 * @param {string} token - رمز الجلسة
 * @returns {Object} معلومات الجلسة
 */
function checkSessionStatus(token) {
  const session = getSession(token);
  
  if (!session) {
    return {
      active: false,
      message: ERROR_MESSAGES.SESSION_EXPIRED
    };
  }
  
  const now = new Date().getTime();
  const sessionDuration = SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600 * 1000;
  const timeLeft = sessionDuration - (now - session.loginTime);
  const hoursLeft = Math.floor(timeLeft / (3600 * 1000));
  const minutesLeft = Math.floor((timeLeft % (3600 * 1000)) / (60 * 1000));
  
  return {
    active: true,
    user: {
      id: session.employeeId,
      username: session.username,
      name: session.name,
      role: session.role
    },
    timeLeft: {
      hours: hoursLeft,
      minutes: minutesLeft,
      totalMs: timeLeft
    },
    loginTime: session.loginTime,
    lastActivity: session.lastActivity
  };
}

/**
 * تمديد الجلسة
 * @param {string} token - رمز الجلسة
 * @returns {Object} نتيجة التمديد
 */
function extendSession(token) {
  const session = getSession(token);
  
  if (!session) {
    return errorResponse(ERROR_MESSAGES.SESSION_EXPIRED);
  }
  
  // إعادة تعيين وقت بدء الجلسة
  session.loginTime = new Date().getTime();
  session.lastActivity = new Date().getTime();
  
  const cacheKey = CACHE_KEYS.SESSION_PREFIX + token;
  cachePut(cacheKey, session, SYSTEM_CONFIG.SESSION_DURATION_HOURS * 3600);
  
  return successResponse(null, 'تم تمديد الجلسة');
}
