// Database connection helper for Nuxt server API
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (pool) {
    return pool;
  }
  
  // Get database credentials from environment variables
  const dbHost = process.env.DB_HOST || '157.85.98.150:3306';
  const [host, port] = dbHost.includes(':') 
    ? dbHost.split(':') 
    : [dbHost, '3306'];
  
  const dbName = process.env.DB_NAME || 'nuxtcommerce_db';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || 'RootBeer06032534';

  pool = mysql.createPool({
    host,
    port: parseInt(port),
    user: dbUser,
    password: dbPassword,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  return pool;
}

// Helper function to fix image URLs
export function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const baseUrl = process.env.BASE_URL || 'http://localhost';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Replace localhost and 127.0.0.1 with base URL
  url = url.replace(/http:\/\/localhost\//g, `${cleanBaseUrl}/`);
  url = url.replace(/http:\/\/127\.0\.0\.1\//g, `${cleanBaseUrl}/`);
  url = url.replace(/https:\/\/localhost\//g, `${cleanBaseUrl}/`);
  url = url.replace(/https:\/\/127\.0\.0\.1\//g, `${cleanBaseUrl}/`);
  
  return url;
}
