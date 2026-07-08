import prisma from '../config/db.js';

export const createUser = async (data) => {
  return await prisma.user.create({ data });
};

export const findUserByEmailAndTenant = async (email, tenantId) => {
  return await prisma.user.findFirst({
    where: { 
      email, 
      ...(tenantId !== null && { tenantId }),
      deletedAt: null 
    },
    include: { role: true }
  });
};

export const findUserById = async (id) => {
  return await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { role: true }
  });
};

export const findAllUsersByTenant = async (tenantId, query) => {
  const { page = 1, limit = 10, search = '', roleId, roleName, status } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(tenantId !== null && { tenantId }),
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }),
    ...(roleId && { roleId: Number(roleId) }),
    ...(roleName && { role: { name: roleName } }),
    ...(status && { status })
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      select: {
        id: true,
        uuid: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        vacationBalance: true,
        birthday: true,
        nibNumber: true,
        employmentStatus: true,
        hasPassport: true,
        hasLicense: true,
        hasNIB: true,
        hasResume: true,
        bankingInfo: true,
        isSalaried: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  return { users, total, page: Number(page), totalPages: Math.ceil(total / limit) };
};

export const updateUser = async (id, data) => {
  return await prisma.user.update({
    where: { id },
    data
  });
};

export const softDeleteUser = async (id) => {
  return await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() }
  });
};
