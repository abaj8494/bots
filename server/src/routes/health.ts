import express, { Router, Request, Response } from 'express';
import { getStorageStats } from '../utils/persistentEmbeddings';
import db from '../config/db';

const router: Router = express.Router();

// @route   GET /health
// @desc    Health check endpoint for deployment monitoring
// @access  Public
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-optimized',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      services: {
        database: 'unknown',
        storage: 'unknown',
        embeddings: 'unknown'
      }
    };

    // Test database connection
    try {
      await db.query('SELECT 1');
      healthCheck.services.database = 'healthy';
    } catch (error) {
      healthCheck.services.database = 'unhealthy';
    }

    // Test storage access
    try {
      const stats = await getStorageStats();
      healthCheck.services.storage = 'healthy';
      healthCheck.services.embeddings = `${stats.totalBooksOnDisk} books cached`;
    } catch (error) {
      healthCheck.services.storage = 'unhealthy';
      healthCheck.services.embeddings = 'unavailable';
    }

    // Determine overall status
    const isHealthy = Object.values(healthCheck.services).every(
      service => service !== 'unhealthy'
    );
    
    if (!isHealthy) {
      healthCheck.status = 'degraded';
    }

    res.status(isHealthy ? 200 : 503).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// @route   GET /health/detailed
// @desc    Detailed health information for monitoring
// @access  Public
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-optimized',
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        },
        cpu: process.cpuUsage()
      },
      services: {
        database: { status: 'unknown', details: null },
        storage: { status: 'unknown', details: null },
        embeddings: { status: 'unknown', details: null }
      }
    };

    // Test database with more details
    try {
      const dbStart = Date.now();
      const result = await db.query('SELECT version() as version, current_database() as database');
      const dbTime = Date.now() - dbStart;
      
      detailedHealth.services.database = {
        status: 'healthy',
        details: {
          version: result.rows[0]?.version?.split(' ')[0] || 'unknown',
          database: result.rows[0]?.database || 'unknown',
          responseTime: `${dbTime}ms`
        }
      };
    } catch (error) {
      detailedHealth.services.database = {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }

    // Test storage with more details
    try {
      const storageStart = Date.now();
      const stats = await getStorageStats();
      const storageTime = Date.now() - storageStart;
      
      detailedHealth.services.storage = {
        status: 'healthy',
        details: {
          totalBooksOnDisk: stats.totalBooksOnDisk,
          totalDiskUsage: `${Math.round(stats.totalDiskUsage / 1024 / 1024)}MB`,
          cacheSize: stats.cacheSize,
          responseTime: `${storageTime}ms`
        }
      };
      
      detailedHealth.services.embeddings = {
        status: 'healthy',
        details: {
          booksInCache: stats.cacheSize,
          booksOnDisk: stats.totalBooksOnDisk,
          diskUsage: stats.totalDiskUsage
        }
      };
    } catch (error) {
      detailedHealth.services.storage = {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
      detailedHealth.services.embeddings = {
        status: 'unavailable',
        details: { error: 'Storage service unavailable' }
      };
    }

    // Determine overall status
    const isHealthy = Object.values(detailedHealth.services).every(
      service => service.status !== 'unhealthy'
    );
    
    if (!isHealthy) {
      detailedHealth.status = 'degraded';
    }

    res.status(isHealthy ? 200 : 503).json(detailedHealth);
  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
