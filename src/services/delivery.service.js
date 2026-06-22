import * as deliveryRepo from '../repositories/delivery.repository.js';
import * as orderRepo from '../repositories/order.repository.js';
import * as warehouseRepo from '../repositories/warehouse.repository.js';
import AppError from '../utils/AppError.js';
import { logAudit } from '../utils/audit.js';
import prisma from '../config/db.js';

export const createDelivery = async (data, performerId, tenantId) => {
  const { items, ...deliveryData } = data;

  let order;
  if (data.orderId) {
    order = await orderRepo.findOrderById(data.orderId);
  }

  if (!order || (tenantId !== null && order.tenantId !== tenantId)) {
    // Auto-create an ad-hoc order to support "Deploy New Mission" standalone flow
    let clientIdToUse = data.clientId;
    if (!clientIdToUse) {
      const defaultClient = await prisma.client.findFirst({ where: { ...(tenantId != null && { tenantId }) } });
      if (!defaultClient) throw new AppError('No clients available to assign to ad-hoc mission', 400);
      clientIdToUse = defaultClient.id;
    }

    let adHocWarehouseId = data.warehouseId;
    if (!adHocWarehouseId) {
      const firstWarehouse = await prisma.warehouse.findFirst({ where: { ...(tenantId != null && { tenantId }) } });
      if (firstWarehouse) adHocWarehouseId = firstWarehouse.id;
    }
    if (!adHocWarehouseId) throw new AppError('No warehouse available for ad-hoc mission', 400);

    let defaultItem = await prisma.item.findFirst({ where: { ...(tenantId != null && { tenantId }) } });
    if (!defaultItem) {
      defaultItem = await prisma.item.create({
        data: {
          tenantId: tenantId || 1,
          itemCode: 'MISC-001',
          name: 'Miscellaneous Asset',
          category: 'General',
          type: 'product',
          unit: 'pcs',
          unitPrice: 0,
          inventoryStatus: 'in_stock'
        }
      });
    }

    data.warehouseId = adHocWarehouseId;
    deliveryData.warehouseId = adHocWarehouseId;

    const employee = await prisma.employee.findUnique({ where: { userId: performerId } });
    const orderCreatedById = employee ? employee.id : 1;

    order = await orderRepo.createOrder({
      clientId: clientIdToUse,
      createdById: orderCreatedById,
      status: 'approved',
      orderType: data.missionType === 'Chauffeur' ? 'Service' : 'Delivery',
      priority: 'high'
    }, items.map(it => {
      it.itemId = defaultItem.id; // Mutate the original item so the validation loop sees the correct ID
      return {
        itemId: defaultItem.id,
        quantity: it.quantity || 1,
        unitPrice: 0,
        warehouseId: adHocWarehouseId
      };
    }), tenantId);

    data.orderId = order.id;
    deliveryData.orderId = order.id;
    deliveryData.clientId = clientIdToUse;
  }

  if (!['draft', 'pending', 'approved', 'ready_for_delivery', 'planned', 'active', 'in_progress', 'Pending', 'In Progress', 'operation', 'procurement', 'inventory', 'logistics', 'concierge', 'created', 'admin_review', 'pending_review'].includes(order.status)) {
    throw new AppError(`Cannot create delivery for order in ${order.status} status`, 400);
  }

  // Resolve warehouseId if it's missing or null
  let warehouseId = data.warehouseId;
  if (!warehouseId && order.items && order.items.length > 0) {
    // Default to the warehouse of the first item in the order
    warehouseId = order.items[0].warehouseId;
  }

  if (!warehouseId) {
    // Find the first available warehouse for this tenant
    const firstWarehouse = await prisma.warehouse.findFirst({
      where: {
        ...(tenantId != null && { tenantId })
      }
    });
    if (firstWarehouse) {
      warehouseId = firstWarehouse.id;
    }
  }

  if (!warehouseId) {
    throw new AppError('Warehouse ID is required and no default warehouse could be found', 400);
  }

  // Update variables so downstream logic uses the resolved warehouseId
  data.warehouseId = warehouseId;
  deliveryData.warehouseId = warehouseId;

  const warehouse = await warehouseRepo.findWarehouseById(warehouseId);
  if (!warehouse || (tenantId !== null && warehouse.tenantId !== tenantId)) {
    throw new AppError('Warehouse not found', 404);
  }

  deliveryData.clientId = order.clientId;

  const validDeliveryItems = [];

  // Validate quantities: Delivery quantity cannot exceed (Order Quantity - Already Delivered Quantity)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const orderItemId = item.orderItemId;
    let orderItem;

    if (orderItemId) {
      orderItem = order.items?.find(oi => oi.id == orderItemId);
    } else {
      orderItem = order.items?.find(oi => oi.itemId == item.itemId);
      if (!orderItem && order.items && order.items[i]) {
        orderItem = order.items[i];
        item.itemId = orderItem.itemId;
      }
    }

    if (!orderItem) {
      // Bespoke/custom item without a corresponding order item in the DB.
      // We skip adding it to validDeliveryItems to avoid foreign key constraints.
      // The manifest data is already safely stored in the JSON remarks string.
      continue;
    }

    // Set the resolved orderItemId on the item
    if (!item.orderItemId) {
      item.orderItemId = orderItem.id;
    }
    
    if (orderItem.warehouseId && orderItem.warehouseId !== data.warehouseId) {
      // Optional: Log mismatch but don't strictly block unless required
    }

    const alreadyDelivered = await deliveryRepo.getDeliveredQuantityForOrderItem(item.orderItemId);
    const remainingToDeliver = orderItem.quantity - alreadyDelivered;

    if (item.quantity > remainingToDeliver) {
      throw new AppError(`Cannot deliver ${item.quantity} for item ${item.itemId}. Only ${remainingToDeliver} remaining.`, 400);
    }
    
    validDeliveryItems.push(item);
  }

  const newDelivery = await deliveryRepo.createDelivery(deliveryData, validDeliveryItems, tenantId);

  // If order was approved, draft or pending, mark it as ready_for_delivery automatically
  if (['draft', 'pending', 'Pending', 'approved'].includes(order.status)) {
    await orderRepo.updateOrderStatus(order.id, 'ready_for_delivery');
  }

  await logAudit({
    module: 'DELIVERIES',
    action: 'CREATE',
    description: `Created Delivery ${newDelivery.deliveryNumber} for Order ${order.orderNumber}`,
    newValue: newDelivery,
    performedBy: performerId
  });

  return newDelivery;
};

export const getDeliveries = async (tenantId, query) => {
  return await deliveryRepo.findAllDeliveries(tenantId, query);
};

export const getDeliveryById = async (id, tenantId, clientId = null) => {
  const delivery = await deliveryRepo.findDeliveryById(id);
  if (!delivery || (tenantId !== null && delivery.tenantId !== tenantId) || (clientId !== null && delivery.clientId !== clientId)) {
    throw new AppError('Delivery not found', 404);
  }
  return delivery;
};

export const cancelDelivery = async (id, tenantId, performerId, clientId = null) => {
  const delivery = await getDeliveryById(id, tenantId, clientId);

  if (['dispatched', 'in_transit', 'delivered'].includes(delivery.status)) {
    throw new AppError(`Cannot cancel delivery in ${delivery.status} status`, 400);
  }

  await prisma.$transaction(async (tx) => {
    await deliveryRepo.updateDeliveryStatus(tx, id, 'cancelled');
    
    // Auto cancel associated missions if any
    await tx.mission.updateMany({
      where: { deliveryId: id, status: { notIn: ['completed', 'cancelled'] } },
      data: { status: 'cancelled' }
    });
  });

  await logAudit({
    module: 'DELIVERIES',
    action: 'CANCEL',
    description: `Cancelled Delivery ${delivery.deliveryNumber}`,
    oldValue: delivery,
    performedBy: performerId
  });

  return true;
};

export const updateDelivery = async (id, data, tenantId, performerId, clientId = null) => {
  const delivery = await getDeliveryById(id, tenantId, clientId);

  if (['cancelled', 'delivered'].includes(delivery.status)) {
    throw new AppError(`Cannot update delivery in ${delivery.status} status`, 400);
  }

  const updatedDelivery = await deliveryRepo.updateDelivery(id, data);

  await logAudit({
    module: 'DELIVERIES',
    action: 'UPDATE',
    description: `Updated Delivery ${delivery.deliveryNumber}`,
    oldValue: delivery,
    newValue: updatedDelivery,
    performedBy: performerId
  });

  return updatedDelivery;
};
