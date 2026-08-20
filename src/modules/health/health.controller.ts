import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOkResponse({
    description: 'Servis ve veritabani durumu',
    schema: {
      example: { status: 'ok', database: 'connected', uptime: 12.34, timestamp: '2026-01-01T00:00:00.000Z' },
    },
  })
  check() {
    const connected = this.connection.readyState === ConnectionStates.connected;

    return {
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      uptime: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }
}
