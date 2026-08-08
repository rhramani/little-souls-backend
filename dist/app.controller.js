"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    appService;
    constructor(appService) {
        this.appService = appService;
    }
    getHello() {
        return this.appService.getHello();
    }
    getHealth() {
        return this.appService.getHealth();
    }
    async proxyImage(url, res, w, h) {
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
            const width = !isNaN(parsedWidth) && parsedWidth > 0 ? parsedWidth : undefined;
            const height = !isNaN(parsedHeight) && parsedHeight > 0 ? parsedHeight : undefined;
            if (contentType.startsWith('image/') &&
                contentType !== 'image/gif' &&
                (width !== undefined || height !== undefined)) {
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
        }
        catch (e) {
            res.status(500).send('Error fetching image: ' + e.message);
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('proxy/image'),
    __param(0, (0, common_1.Query)('url')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('w')),
    __param(3, (0, common_1.Query)('h')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "proxyImage", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map