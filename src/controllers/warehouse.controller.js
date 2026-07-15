import * as warehouseService from '../services/warehouse.service.js';
import { sendResponse } from '../utils/response.js';
import prisma from '../config/db.js';

export const createWarehouse = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const isBusinessClient = req.user.role?.name === 'BUSINESS_CLIENT';
    const tenantIdToUse = isSuperAdmin ? (req.body.tenantId || req.user.tenantId || 1) : isBusinessClient ? 1 : (req.user.tenantId || 1);

    const payload = req.body;

    // Map only valid Prisma schema fields
    const warehouseData = {
      name: payload.name,
      location: payload.location || null,
      capacity: payload.capacity !== undefined ? Number(payload.capacity) : 0,
      status: payload.status || 'active',
      managerId: payload.managerId || payload.manager_id || null,
    };

    const warehouse = await warehouseService.createWarehouse(warehouseData, req.user.id, tenantIdToUse);
    sendResponse(res, 201, 'Warehouse created successfully', warehouse);
  } catch (error) {
    next(error);
  }
};

const checkIsClient = (user) => {
  const roleName = String(user?.role?.name || user?.role || '').toUpperCase();
  return roleName.includes('CLIENT') || roleName.includes('CUSTOMER');
};

export const getWarehouses = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const isClient = checkIsClient(req.user);
    const tenantIdToFilter = isSuperAdmin && !req.query.tenantId ? null :
                             isClient ? 1 :
                             (req.query.tenantId ? Number(req.query.tenantId) : req.user.tenantId);

    const result = await warehouseService.getWarehouses(tenantIdToFilter, req.query);
    sendResponse(res, 200, 'Warehouses fetched successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getWarehouseById = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const isClient = checkIsClient(req.user);
    const tenantIdToFilter = isSuperAdmin ? null : isClient ? 1 : (req.user.tenantId || 1);

    const warehouse = await warehouseService.getWarehouseById(Number(req.params.id), tenantIdToFilter);
    sendResponse(res, 200, 'Warehouse fetched successfully', warehouse);
  } catch (error) {
    next(error);
  }
};

export const updateWarehouse = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const isBusinessClient = req.user.role?.name === 'BUSINESS_CLIENT';
    const tenantIdToFilter = isSuperAdmin ? null : isBusinessClient ? 1 : (req.user.tenantId || 1);

    const payload = req.body;

    // Map only valid Prisma schema fields
    const warehouseData = {};
    if (payload.name !== undefined) warehouseData.name = payload.name;
    if (payload.location !== undefined) warehouseData.location = payload.location;
    if (payload.capacity !== undefined) warehouseData.capacity = Number(payload.capacity);
    if (payload.status !== undefined) warehouseData.status = payload.status;
    
    const providedManagerUserId = payload.managerId ?? payload.manager_id ?? undefined;
    if (providedManagerUserId !== undefined) {
      warehouseData.managerId = providedManagerUserId ? Number(providedManagerUserId) : null;
    }

    const updatedWarehouse = await warehouseService.updateWarehouse(Number(req.params.id), warehouseData, tenantIdToFilter, req.user.id);
    sendResponse(res, 200, 'Warehouse updated successfully', updatedWarehouse);
  } catch (error) {
    next(error);
  }
};

export const deleteWarehouse = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const isBusinessClient = req.user.role?.name === 'BUSINESS_CLIENT';
    const tenantIdToFilter = isSuperAdmin ? null : isBusinessClient ? 1 : (req.user.tenantId || 1);

    await warehouseService.deleteWarehouse(Number(req.params.id), tenantIdToFilter, req.user.id);
    sendResponse(res, 200, 'Warehouse deleted successfully');
  } catch (error) {
    next(error);
  }
};
