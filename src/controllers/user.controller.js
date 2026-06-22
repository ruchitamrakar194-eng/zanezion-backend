import * as userService from '../services/user.service.js';
import { sendResponse } from '../utils/response.js';

export const createUser = async (req, res, next) => {
  try {
    const data = req.body;
    // ensure tenant isolation
    data.tenantId = req.user.tenantId || data.tenantId || 1; 

    // robust payload prep for prisma
    const payload = {
      name: data.name,
      email: data.email,
      password: data.password,
      roleId: Number(data.roleId),
      phone: data.phone || null,
      tenantId: data.tenantId,
      status: data.status || 'Active',
      vacationBalance: data.vacationBalance ? Number(data.vacationBalance) : 0,
      birthday: data.birthday ? new Date(data.birthday) : null,
      nibNumber: data.nibNumber || null,
      employmentStatus: data.employmentStatus || 'Full Time',
      hasPassport: !!data.hasPassport,
      hasLicense: !!data.hasLicense,
      hasNIB: !!data.hasNIB,
      hasResume: !!data.hasResume,
      bankingInfo: data.bankingInfo || {}
    };

    const user = await userService.createUser(
      payload, 
      req.user.id, 
      req.ip, 
      req.headers['user-agent']
    );

    sendResponse(res, 201, 'User created successfully', user);
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin ? null : (req.user.tenantId || 1);

    const result = await userService.getUsers(tenantIdToFilter, req.query);
    sendResponse(res, 200, 'Users fetched successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin ? null : (req.user.tenantId || 1);

    // A "customer" is effectively a user with role = BUSINESS_CLIENT
    // The frontend passes include_client_role=1 or roleName=BUSINESS_CLIENT. 
    // We can just reuse userService.getUsers with a hardcoded role check if needed, 
    // or just let it pass through req.query to the repo.
    const query = { ...req.query, roleName: 'BUSINESS_CLIENT' };
    
    if (['BUSINESS_CLIENT', 'INDIVIDUAL_CLIENT'].includes(req.user.role?.name)) {
      query.clientId = req.user.clientId;
    }

    const result = await userService.getUsers(tenantIdToFilter, query);
    
    sendResponse(res, 200, 'Customers fetched successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin ? null : (req.user.tenantId || 1);

    const user = await userService.getUserById(Number(req.params.id), tenantIdToFilter);
    sendResponse(res, 200, 'User fetched successfully', user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin ? null : (req.user.tenantId || 1);

    const isCustomer = ['BUSINESS_CLIENT', 'INDIVIDUAL_CLIENT', 'client', 'saas_client', 'customer'].includes(req.user.role?.name);

    if (isCustomer && Number(req.params.id) !== req.user.id) {
      return sendResponse(res, 403, 'Forbidden: You can only update your own profile');
    }

    const data = req.body;
    const payload = {};
    
    // Only admins can update these fields
    if (!isCustomer) {
      if (data.roleId !== undefined && data.roleId) payload.roleId = Number(data.roleId);
      if (data.status !== undefined) payload.status = data.status;
      if (data.vacationBalance !== undefined) payload.vacationBalance = Number(data.vacationBalance) || 0;
      if (data.employmentStatus !== undefined) payload.employmentStatus = data.employmentStatus || 'Full Time';
    }

    // Common fields
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.birthday !== undefined) payload.birthday = data.birthday ? new Date(data.birthday) : null;
    if (data.nibNumber !== undefined) payload.nibNumber = data.nibNumber || null;
    if (data.hasPassport !== undefined) payload.hasPassport = !!data.hasPassport;
    if (data.hasLicense !== undefined) payload.hasLicense = !!data.hasLicense;
    if (data.hasNIB !== undefined) payload.hasNIB = !!data.hasNIB;
    if (data.hasResume !== undefined) payload.hasResume = !!data.hasResume;
    if (data.bankingInfo !== undefined) payload.bankingInfo = data.bankingInfo || {};

    // Concierge & Membership fields
    if (data.plan !== undefined) payload.plan = data.plan;
    if (data.is_upgraded !== undefined) payload.is_upgraded = Boolean(data.is_upgraded);
    if (data.concierge_member !== undefined) payload.concierge_member = Boolean(data.concierge_member);
    if (data.concierge_membership_since !== undefined) payload.concierge_membership_since = data.concierge_membership_since;

    const updatedUser = await userService.updateUser(Number(req.params.id), payload, tenantIdToFilter, req.ip, req.headers['user-agent']);
    sendResponse(res, 200, 'User updated successfully', updatedUser);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin ? null : (req.user.tenantId || 1);

    await userService.deleteUser(Number(req.params.id), tenantIdToFilter, req.ip, req.headers['user-agent']);
    sendResponse(res, 200, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};
