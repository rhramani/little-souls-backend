import { AppService } from './app.service';
import type { Response } from 'express';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getHealth(): any;
    proxyImage(url: string, res: Response, w?: string, h?: string): Promise<Response<any, Record<string, any>> | undefined>;
}
