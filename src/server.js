import http from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { initSocket } from './utils/socket.js';
import { execSync } from 'child_process';

dotenv.config();

const PORT = process.env.PORT || 8000;
const prisma = new PrismaClient();

async function startServer() {
  try {
    // Auto-migrate schema on server startup
    try {
      console.log('Running automatic database migrations...');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('✅ Database migration completed');
    } catch (migError) {
      console.error('⚠️ Database migration command failed, attempting connection anyway:', migError.message);
    }

    // Check DB Connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Auto-seed if database is empty
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.log('🌱 Database is empty. Running automatic seed scripts...');
        execSync('node prisma/seed.js', { stdio: 'inherit' });
        execSync('node prisma/seed_users.js', { stdio: 'inherit' });
        console.log('✅ Automatic seeding completed successfully');
      }
    } catch (seedErr) {
      console.error('⚠️ Automatic seeding failed:', seedErr.message);
    }

    // Wrap Express app with HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.io
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 ZaneZion Foundation Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to database', error);
    process.exit(1);
  }
}

startServer();
