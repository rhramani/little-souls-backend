"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const nest_winston_1 = require("nest-winston");
const winston = __importStar(require("winston"));
const prisma_client_exception_filter_1 = require("./common/filters/prisma-client-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: nest_winston_1.WinstonModule.createLogger({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.timestamp(), winston.format.ms(), nest_winston_1.utilities.format.nestLike('LittleSouls', {
                        colors: true,
                        appName: true,
                    })),
                }),
            ],
        }),
    });
    const morganMiddleware = require('morgan');
    app.use(morganMiddleware('dev'));
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new prisma_client_exception_filter_1.PrismaClientExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    const port = process.env.PORT ?? 3000;
    await app.listen(port, 'localhost');
    console.log(`[Little Souls Backend] Running successfully on port ${port} (API Prefix: /api)`);
}
bootstrap();
//# sourceMappingURL=main.js.map