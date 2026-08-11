export class HealthService {
  public static getSystemStatus() {
    return {
      service: 'Chess Online Backend API Service',
      version: '1.0.0',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
