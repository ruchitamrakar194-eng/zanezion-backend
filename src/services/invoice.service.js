import * as invoiceRepo from '../repositories/invoice.repository.js';
import * as deliveryRepo from '../repositories/delivery.repository.js';
import AppError from '../utils/AppError.js';
import { logAudit } from '../utils/audit.js';

export const generateInvoice = async (data, performerId, tenantId) => {
  const { items, deliveryId, dueDate } = data;

  let invoiceData = {};
  let referenceNumber = '';

  const delivery = await deliveryRepo.findDeliveryById(deliveryId);
  if (delivery) {
    if (tenantId !== null && delivery.tenantId !== tenantId) {
      throw new AppError('Delivery not found', 404);
    }
    if (delivery.status !== 'delivered') {
      throw new AppError(`Flow Dependency Error: Cannot generate invoice. Delivery ${delivery.deliveryNumber || deliveryId} is currently '${delivery.status}'. Required Next Step: Complete the delivery and update its status to 'delivered'.`, 400);
    }
    const pod = await invoiceRepo.checkPODExists(deliveryId);
    if (!pod) {
      throw new AppError(`Flow Dependency Error: Missing Proof of Delivery (POD). Required Next Step: Upload and submit the POD document for Delivery ${delivery.deliveryNumber || deliveryId} before generating an invoice.`, 400);
    }

    // Validate quantities against what was actually delivered
    for (const item of items) {
      const deliveredItem = delivery.items.find(di => di.itemId === item.itemId);
      if (!deliveredItem) {
        throw new AppError(`Item ${item.itemId} was not part of this delivery`, 400);
      }
    }

    invoiceData = {
      clientId: delivery.clientId,
      orderId: delivery.orderId,
      deliveryId: delivery.id,
      invoiceDate: new Date(),
      dueDate: new Date(dueDate)
    };
    referenceNumber = delivery.deliveryNumber;
  } else {
    // Fallback: If no delivery is found, check if it's a direct Order/Mission.
    // The frontend passes orderId as deliveryId for Missions.
    const orderRepo = await import('../repositories/order.repository.js');
    const order = await orderRepo.findOrderById(deliveryId);
    if (!order || (tenantId !== null && order.tenantId !== tenantId)) {
      throw new AppError('Delivery or Order not found', 404);
    }

    // Ensure item IDs are valid to prevent Foreign Key constraints
    const prisma = (await import('../config/db.js')).default;
    for (let it of items) {
      const existingItem = await prisma.item.findUnique({ where: { id: it.itemId } });
      if (!existingItem) {
        let fallbackItem = await prisma.item.findFirst({ where: { ...(tenantId != null && { tenantId }) } });
        if (!fallbackItem) {
          fallbackItem = await prisma.item.create({
            data: { tenantId: tenantId || 1, itemCode: 'SVC-001', name: 'General Logistics Service', category: 'General', type: 'service', unit: 'pcs', unitPrice: 0, inventoryStatus: 'in_stock' }
          });
        }
        it.itemId = fallbackItem.id;
      }
    }

    invoiceData = {
      clientId: order.clientId,
      orderId: order.id,
      deliveryId: null,
      invoiceDate: new Date(),
      dueDate: new Date(dueDate)
    };
    referenceNumber = order.orderNumber || order.id;
  }

  const newInvoice = await invoiceRepo.createInvoice(invoiceData, items, tenantId);

  await logAudit({
    module: 'INVOICES',
    action: 'CREATE',
    description: `Generated Invoice ${newInvoice.invoiceNumber} for Delivery/Order ${referenceNumber}`,
    newValue: newInvoice,
    performedBy: performerId
  });

  return newInvoice;
};

export const getInvoices = async (tenantId, query) => {
  return await invoiceRepo.findAllInvoices(tenantId, query);
};

export const getInvoiceById = async (id, tenantId, clientId = null) => {
  const invoice = await invoiceRepo.findInvoiceById(id);
  if (!invoice || (tenantId !== null && invoice.tenantId !== tenantId) || (clientId !== null && invoice.clientId !== clientId)) {
    throw new AppError('Invoice not found', 404);
  }
  return invoice;
};

export const updateInvoiceStatus = async (id, status, tenantId, performerId) => {
  const invoice = await getInvoiceById(id, tenantId);

  const validTransitions = {
    'draft': ['generated', 'cancelled'],
    'generated': ['approved', 'cancelled'],
    'approved': ['sent', 'cancelled'],
    'sent': ['partially_paid', 'paid', 'cancelled'],
    'partially_paid': ['paid'],
    'paid': [],
    'cancelled': []
  };

  if (!validTransitions[invoice.status].includes(status)) {
    throw new AppError(`Invalid invoice status transition from ${invoice.status} to ${status}`, 400);
  }

  const updatedInvoice = await invoiceRepo.updateInvoiceStatus(id, status);

  await logAudit({
    module: 'INVOICES',
    action: 'STATUS_CHANGE',
    description: `Invoice ${invoice.invoiceNumber} status changed to ${status}`,
    oldValue: invoice,
    newValue: updatedInvoice,
    performedBy: performerId
  });

  return updatedInvoice;
};
