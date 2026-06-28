/**
 * ============================================
 * Constants.gs - الثوابت والإعدادات العامة
 * ============================================
 * 
 * يحتوي على جميع الثوابت والإعدادات المشتركة في النظام
 * لا يحتوي على أي دوال منطقية - فقط ثوابت
 */

// ============================================
// إعدادات النظام العامة
// ============================================

const SYSTEM_CONFIG = {
  APP_NAME: 'Shipment Management System',
  APP_VERSION: '1.0.0',
  APP_LOGO: 'local_shipping',
  DEFAULT_LANGUAGE: 'ar',
  DEFAULT_THEME: 'light',
  SESSION_DURATION_HOURS: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
  PASSWORD_MIN_LENGTH: 6,
  CACHE_DURATION_SECONDS: 300, // 5 دقائق
  BATCH_SIZE: 100, // حجم الدفعة للمعالجة
  MAX_IMPORT_ROWS: 5000, // الحد الأقصى للاستيراد في عملية واحدة
  ARCHIVE_AFTER_DAYS: 30, // نقل للأرشيف بعد 30 يوم
  DATE_FORMAT: 'dd/MM/yyyy',
  DATETIME_FORMAT: 'dd/MM/yyyy HH:mm:ss',
  TIME_FORMAT: 'HH:mm:ss'
};

// ============================================
// أسماء أوراق Google Sheets
// ============================================

const SHEET_NAMES = {
  EMPLOYEES: 'Employees',
  ROLES: 'Roles',
  PERMISSIONS: 'Permissions',
  SHIPMENTS: 'Shipments',
  HISTORY: 'History',
  ASSIGNMENTS: 'Assignments',
  SETTINGS: 'Settings',
  LOGS: 'Logs',
  NOTIFICATIONS: 'Notifications',
  ARCHIVE: 'Archive'
};

// ============================================
// أعمدة كل ورقة (Headers)
// ============================================

const SHEET_HEADERS = {
  EMPLOYEES: [
    'ID', 'Username', 'PasswordHash', 'Salt', 'Name', 'Email', 'Phone',
    'Role', 'Permissions', 'IsActive', 'LastLogin', 'CreatedAt', 'UpdatedAt'
  ],
  
  ROLES: [
    'ID', 'RoleName', 'RoleKey', 'Permissions', 'Description', 'CreatedAt', 'UpdatedAt'
  ],
  
  PERMISSIONS: [
    'ID', 'PermissionKey', 'PermissionName', 'Description', 'Category', 'CreatedAt'
  ],
  
  SHIPMENTS: [
    'ID', 'TrackingNumber', 'OrderCode', 'CustomerName', 'Phone', 'SecondPhone',
    'Governorate', 'City', 'Branch', 'Address', 'ProductName', 'Quantity',
    'Price', 'CODAmount', 'Status', 'AssignedEmployee', 'AssignedBy', 'AssignedDate',
    'LastFollowUp', 'NextFollowUp', 'Notes', 'Priority', 'Tags', 'CreatedAt',
    'UpdatedAt', 'NoAnswerCount', 'IsArchived'
  ],
  
  HISTORY: [
    'ID', 'ShipmentID', 'EmployeeID', 'EmployeeName', 'OldStatus', 'NewStatus',
    'Notes', 'ActionType', 'Timestamp'
  ],
  
  ASSIGNMENTS: [
    'ID', 'ShipmentID', 'OldEmployee', 'NewEmployee', 'AssignedBy', 'AssignmentType', 'Timestamp'
  ],
  
  SETTINGS: [
    'Key', 'Value', 'UpdatedAt', 'UpdatedBy'
  ],
  
  LOGS: [
    'ID', 'Action', 'User', 'Details', 'Timestamp'
  ],
  
  NOTIFICATIONS: [
    'ID', 'Type', 'Message', 'RelatedShipment', 'IsRead', 'CreatedAt', 'ForUser'
  ],
  
  ARCHIVE: [
    'ID', 'TrackingNumber', 'OrderCode', 'CustomerName', 'Phone', 'SecondPhone',
    'Governorate', 'City', 'Branch', 'Address', 'ProductName', 'Quantity',
    'Price', 'CODAmount', 'Status', 'AssignedEmployee', 'AssignedBy', 'AssignedDate',
    'LastFollowUp', 'NextFollowUp', 'Notes', 'Priority', 'Tags', 'CreatedAt',
    'UpdatedAt', 'NoAnswerCount', 'ArchivedAt', 'ArchivedBy'
  ]
};

// ============================================
// حالات الشحنات
// ============================================

const SHIPMENT_STATUS = {
  UNASSIGNED: 'غير موزعة',
  READY_FOR_PICKUP: 'جاهز للاستلام',
  DELIVERED: 'تم التسليم',
  NO_ANSWER: 'لا يرد',
  POSTPONED: 'مؤجل',
  RETURNED: 'مرتجع',
  REJECTED_QUALITY: 'رفض بسبب الخامة',
  REJECTED_DELAY: 'رفض بسبب التأخير',
  CLOSED: 'مغلق'
};

// ============================================
// أولويات الشحنات
// ============================================

const PRIORITY = {
  LOW: 'منخفض',
  NORMAL: 'عادي',
  HIGH: 'عالي',
  URGENT: 'عاجل'
};

// ============================================
// أنواع العمليات في السجل
// ============================================

const ACTION_TYPES = {
  CREATE: 'إنشاء',
  UPDATE: 'تحديث',
  DELETE: 'حذف',
  ASSIGN: 'توزيع',
  REASSIGN: 'إعادة توزيع',
  STATUS_CHANGE: 'تغيير حالة',
  NOTE_ADDED: 'إضافة ملاحظة',
  FOLLOW_UP: 'متابعة',
  IMPORT: 'استيراد',
  EXPORT: 'تصدير',
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  SETTINGS_CHANGE: 'تغيير إعدادات',
  PASSWORD_CHANGE: 'تغيير كلمة مرور'
};

// ============================================
// أنواع التوزيع
// ============================================

const ASSIGNMENT_TYPES = {
  MANUAL: 'يدوي',
  ROUND_ROBIN: 'تساوي',
  BY_GOVERNORATE: 'حسب المحافظة',
  BY_BRANCH: 'حسب الفرع',
  BY_PRODUCT: 'حسب المنتج',
  REASSIGN: 'إعادة توزيع',
  BULK: 'دفعة'
};

// ============================================
// أنواع الإشعارات
// ============================================

const NOTIFICATION_TYPES = {
  UNASSIGNED_SHIPMENTS: 'شحنات غير موزعة',
  NO_UPDATE_24H: 'لم يتم التحديث منذ 24 ساعة',
  NO_ANSWER_3X: 'لا يرد أكثر من 3 مرات',
  POSTPONED_OVERDUE: 'مؤجل وانتهى الموعد',
  READY_FOR_PICKUP: 'جاهز للاستلام',
  RETURNED: 'مرتجع',
  NEW_ASSIGNMENT: 'تعيين جديد',
  SYSTEM: 'نظام'
};

// ============================================
// الأدوار المحددة مسبقاً
// ============================================

const DEFAULT_ROLES = [
  {
    id: 'role_system_admin',
    name: 'مدير النظام',
    key: 'SYSTEM_ADMIN',
    description: 'صلاحية كاملة على النظام'
  },
  {
    id: 'role_team_leader',
    name: 'رئيس الفريق',
    key: 'TEAM_LEADER',
    description: 'إدارة الفريق وتوزيع الشحنات'
  },
  {
    id: 'role_senior_cs',
    name: 'موظف خدمة عملاء أول',
    key: 'SENIOR_CS',
    description: 'توزيع ومراقبة الشحنات'
  },
  {
    id: 'role_employee',
    name: 'موظف خدمة عملاء',
    key: 'EMPLOYEE',
    description: 'متابعة الشحنات الخاصة به فقط'
  }
];

// ============================================
// الصلاحيات المحددة مسبقاً
// ============================================

const DEFAULT_PERMISSIONS = [
  // Dashboard
  { key: 'VIEW_DASHBOARD', name: 'عرض لوحة التحكم', category: 'لوحة التحكم' },
  
  // Shipments
  { key: 'VIEW_SHIPMENTS', name: 'عرض الشحنات', category: 'الشحنات' },
  { key: 'ADD_SHIPMENT', name: 'إضافة شحنة', category: 'الشحنات' },
  { key: 'EDIT_SHIPMENT', name: 'تعديل شحنة', category: 'الشحنات' },
  { key: 'DELETE_SHIPMENT', name: 'حذف شحنة', category: 'الشحنات' },
  { key: 'IMPORT_SHIPMENTS', name: 'استيراد شحنات', category: 'الشحنات' },
  { key: 'VIEW_ALL_SHIPMENTS', name: 'عرض جميع الشحنات', category: 'الشحنات' },
  
  // Assignments
  { key: 'ASSIGN_SHIPMENT', name: 'توزيع شحنة', category: 'التوزيع' },
  { key: 'REASSIGN_SHIPMENT', name: 'إعادة توزيع', category: 'التوزيع' },
  { key: 'BULK_ASSIGN', name: 'توزيع دفعة', category: 'التوزيع' },
  
  // Employees
  { key: 'VIEW_EMPLOYEES', name: 'عرض الموظفين', category: 'الموظفين' },
  { key: 'ADD_EMPLOYEE', name: 'إضافة موظف', category: 'الموظفين' },
  { key: 'EDIT_EMPLOYEE', name: 'تعديل موظف', category: 'الموظفين' },
  { key: 'DELETE_EMPLOYEE', name: 'حذف موظف', category: 'الموظفين' },
  { key: 'MANAGE_ROLES', name: 'إدارة الأدوار', category: 'الموظفين' },
  
  // Reports
  { key: 'VIEW_REPORTS', name: 'عرض التقارير', category: 'التقارير' },
  { key: 'EXPORT_REPORTS', name: 'تصدير التقارير', category: 'التقارير' },
  
  // Settings
  { key: 'VIEW_SETTINGS', name: 'عرض الإعدادات', category: 'الإعدادات' },
  { key: 'MANAGE_SETTINGS', name: 'تعديل الإعدادات', category: 'الإعدادات' },
  
  // History
  { key: 'VIEW_HISTORY', name: 'عرض السجل', category: 'السجل' },
  
  // Notifications
  { key: 'VIEW_NOTIFICATIONS', name: 'عرض الإشعارات', category: 'الإشعارات' },
  { key: 'MANAGE_NOTIFICATIONS', name: 'إدارة الإشعارات', category: 'الإشعارات' }
];

// ============================================
// تعيين الصلاحيات الافتراضية لكل دور
// ============================================

const DEFAULT_ROLE_PERMISSIONS = {
  SYSTEM_ADMIN: [
    'VIEW_DASHBOARD', 'VIEW_SHIPMENTS', 'ADD_SHIPMENT', 'EDIT_SHIPMENT', 
    'DELETE_SHIPMENT', 'IMPORT_SHIPMENTS', 'VIEW_ALL_SHIPMENTS',
    'ASSIGN_SHIPMENT', 'REASSIGN_SHIPMENT', 'BULK_ASSIGN',
    'VIEW_EMPLOYEES', 'ADD_EMPLOYEE', 'EDIT_EMPLOYEE', 'DELETE_EMPLOYEE', 'MANAGE_ROLES',
    'VIEW_REPORTS', 'EXPORT_REPORTS',
    'VIEW_SETTINGS', 'MANAGE_SETTINGS',
    'VIEW_HISTORY', 'VIEW_NOTIFICATIONS', 'MANAGE_NOTIFICATIONS'
  ],
  TEAM_LEADER: [
    'VIEW_DASHBOARD', 'VIEW_SHIPMENTS', 'ADD_SHIPMENT', 'EDIT_SHIPMENT',
    'VIEW_ALL_SHIPMENTS', 'ASSIGN_SHIPMENT', 'REASSIGN_SHIPMENT', 'BULK_ASSIGN',
    'VIEW_EMPLOYEES', 'VIEW_REPORTS', 'EXPORT_REPORTS',
    'VIEW_HISTORY', 'VIEW_NOTIFICATIONS'
  ],
  SENIOR_CS: [
    'VIEW_DASHBOARD', 'VIEW_SHIPMENTS', 'ADD_SHIPMENT', 'EDIT_SHIPMENT',
    'VIEW_ALL_SHIPMENTS', 'ASSIGN_SHIPMENT', 'REASSIGN_SHIPMENT',
    'VIEW_EMPLOYEES', 'VIEW_REPORTS', 'VIEW_HISTORY', 'VIEW_NOTIFICATIONS'
  ],
  EMPLOYEE: [
    'VIEW_DASHBOARD', 'VIEW_SHIPMENTS', 'EDIT_SHIPMENT', 'VIEW_NOTIFICATIONS'
  ]
};

// ============================================
// إعدادات النظام الافتراضية
// ============================================

const DEFAULT_SETTINGS = {
  'SYSTEM_NAME': 'نظام إدارة الشحنات',
  'SYSTEM_LOGO': '',
  'DEFAULT_GOVERNORATE': '',
  'DEFAULT_BRANCH': '',
  'NOTIFICATION_ENABLED': 'true',
  'AUTO_ARCHIVE_ENABLED': 'true',
  'ARCHIVE_AFTER_DAYS': '30',
  'NO_ANSWER_THRESHOLD': '3',
  'FOLLOW_UP_REMINDER_HOURS': '24',
  'POSTPONED_REMINDER_HOURS': '48',
  'THEME': 'light',
  'DATE_FORMAT': 'dd/MM/yyyy',
  'CURRENCY': 'EGP',
  'COMPANY_NAME': '',
  'COMPANY_PHONE': '',
  'COMPANY_ADDRESS': ''
};

// ============================================
// ألوان حالات الشحنات (للـ UI)
// ============================================

const STATUS_COLORS = {
  'غير موزعة': '#9E9E9E',
  'جاهز للاستلام': '#2196F3',
  'تم التسليم': '#4CAF50',
  'لا يرد': '#FF9800',
  'مؤجل': '#9C27B0',
  'مرتجع': '#F44336',
  'رفض بسبب الخامة': '#795548',
  'رفض بسبب التأخير': '#607D8B',
  'مغلق': '#000000'
};

// ============================================
// ألوان الأولويات
// ============================================

const PRIORITY_COLORS = {
  'منخفض': '#8BC34A',
  'عادي': '#2196F3',
  'عالي': '#FF9800',
  'عاجل': '#F44336'
};

// ============================================
// محافظات مصر (يمكن تعديلها حسب الدولة)
// ============================================

const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر',
  'البحيرة', 'الفيوم', 'الغربية', 'الإسماعيلية', 'المنوفية',
  'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس', 'اسوان',
  'اسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقية',
  'جنوب سيناء', 'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا',
  'شمال سيناء', 'سوهاج'
];

// ============================================
// رسائل الخطأ
// ============================================

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  SESSION_EXPIRED: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى',
  UNAUTHORIZED: 'غير مصرح بالوصول',
  FORBIDDEN: 'ليس لديك صلاحية لهذا الإجراء',
  NOT_FOUND: 'لم يتم العثور على البيانات المطلوبة',
  VALIDATION_ERROR: 'بيانات غير صحيحة',
  SERVER_ERROR: 'حدث خطأ في النظام',
  DUPLICATE_ENTRY: 'هذا السجل موجود مسبقاً',
  IMPORT_ERROR: 'خطأ في الاستيراد',
  EXPORT_ERROR: 'خطأ في التصدير',
  LOCKED_ACCOUNT: 'الحساب مقفل، يرجى المحاولة لاحقاً',
  PASSWORD_MISMATCH: 'كلمات المرور غير متطابقة',
  PASSWORD_TOO_SHORT: 'كلمة المرور قصيرة جداً',
  INVALID_EMAIL: 'بريد إلكتروني غير صحيح',
  REQUIRED_FIELD: 'هذا الحقل مطلوب',
  SESSION_INVALID: 'الجلسة غير صالحة'
};

// ============================================
// رسائل النجاح
// ============================================

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'تم تسجيل الدخول بنجاح',
  LOGOUT_SUCCESS: 'تم تسجيل الخروج بنجاح',
  CREATED: 'تم الإنشاء بنجاح',
  UPDATED: 'تم التحديث بنجاح',
  DELETED: 'تم الحذف بنجاح',
  ASSIGNED: 'تم التوزيع بنجاح',
  IMPORTED: 'تم الاستيراد بنجاح',
  EXPORTED: 'تم التصدير بنجاح',
  PASSWORD_CHANGED: 'تم تغيير كلمة المرور بنجاح',
  SETTINGS_SAVED: 'تم حفظ الإعدادات'
};

// ============================================
// أسماء مفاتيح الـ Cache
// ============================================

const CACHE_KEYS = {
  SESSION_PREFIX: 'session_',
  USER_PREFIX: 'user_',
  DASHBOARD_DATA: 'dashboard_data',
  EMPLOYEES_LIST: 'employees_list',
  SETTINGS: 'system_settings',
  PERMISSIONS: 'permissions_list',
  ROLES: 'roles_list'
};

// ============================================
// أسماء مفاتيح PropertiesService
// ============================================

const PROPERTIES_KEYS = {
  SYSTEM_INITIALIZED: 'system_initialized',
  ADMIN_CREATED: 'admin_created',
  LAST_BACKUP: 'last_backup',
  SESSION_SECRET: 'session_secret'
};

// Object.freeze لمنع التعديل العرضي
Object.freeze(SYSTEM_CONFIG);
Object.freeze(SHEET_NAMES);
Object.freeze(SHEET_HEADERS);
Object.freeze(SHIPMENT_STATUS);
Object.freeze(PRIORITY);
Object.freeze(ACTION_TYPES);
Object.freeze(ASSIGNMENT_TYPES);
Object.freeze(NOTIFICATION_TYPES);
Object.freeze(DEFAULT_ROLES);
Object.freeze(DEFAULT_PERMISSIONS);
Object.freeze(DEFAULT_ROLE_PERMISSIONS);
Object.freeze(DEFAULT_SETTINGS);
Object.freeze(STATUS_COLORS);
Object.freeze(PRIORITY_COLORS);
Object.freeze(GOVERNORATES);
Object.freeze(ERROR_MESSAGES);
Object.freeze(SUCCESS_MESSAGES);
Object.freeze(CACHE_KEYS);
Object.freeze(PROPERTIES_KEYS);
