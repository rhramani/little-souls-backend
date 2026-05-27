import { Controller, Get, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('proxy/image')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      return res.status(400).send('URL required');
    }
    try {
      const fetchReq = await fetch(url);
      if (!fetchReq.ok) {
        return res.status(fetchReq.status).send('Failed to fetch image');
      }
      const arrayBuffer = await fetchReq.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = fetchReq.headers.get('content-type');
      if (contentType) {
        res.set('Content-Type', contentType);
      }
      res.set('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (e: any) {
      res.status(500).send('Error fetching image: ' + e.message);
    }
  }
}
