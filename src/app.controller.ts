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
  async proxyImage(
    @Query('url') url: string,
    @Res() res: Response,
    @Query('w') w?: string,
    @Query('h') h?: string,
  ) {
    if (!url) {
      return res.status(400).send('URL required');
    }
    try {
      const fetchReq = await fetch(url);
      if (!fetchReq.ok) {
        return res.status(fetchReq.status).send('Failed to fetch image');
      }
      const arrayBuffer = await fetchReq.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      let contentType = fetchReq.headers.get('content-type') || 'image/jpeg';

      const parsedWidth = w ? parseInt(w, 10) : NaN;
      const parsedHeight = h ? parseInt(h, 10) : NaN;
      const width =
        !isNaN(parsedWidth) && parsedWidth > 0 ? parsedWidth : undefined;
      const height =
        !isNaN(parsedHeight) && parsedHeight > 0 ? parsedHeight : undefined;

      if (
        contentType.startsWith('image/') &&
        contentType !== 'image/gif' &&
        (width !== undefined || height !== undefined)
      ) {
        const sharp = require('sharp');
        const fitType = width && height ? 'cover' : 'inside';
        buffer = await sharp(buffer)
          .resize({
            width,
            height,
            fit: fitType,
            position: 'center',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();
        contentType = 'image/webp';
      }

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (e: any) {
      res.status(500).send('Error fetching image: ' + e.message);
    }
  }
}
