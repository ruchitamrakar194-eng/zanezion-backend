import * as inventoryService from '../services/inventory.service.js';
import { sendResponse } from '../utils/response.js';

export const issueStock = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToUse = isSuperAdmin ? (req.body.tenantId || req.user.tenantId || 1) : (req.user.tenantId || 1);

    const result = await inventoryService.issueStock(req.body, req.user.id, tenantIdToUse);
    sendResponse(res, 200, 'Stock issued successfully', result);
  } catch (error) {
    next(error);
  }
};

export const recordLoss = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToUse = isSuperAdmin ? (req.body.tenantId || req.user.tenantId || 1) : (req.user.tenantId || 1);

    const result = await inventoryService.recordLoss(req.body, req.user.id, tenantIdToUse);
    sendResponse(res, 200, 'Strategic loss assessment recorded successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getLossAssessments = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role?.name === 'SUPER_ADMIN';
    const tenantIdToFilter = isSuperAdmin && !req.query.tenantId ? null : (req.query.tenantId ? Number(req.query.tenantId) : req.user.tenantId);

    const result = await inventoryService.getLossAssessments(tenantIdToFilter, req.query);
    sendResponse(res, 200, 'Strategic loss assessments fetched successfully', result);
  } catch (error) {
    next(error);
  }
};
