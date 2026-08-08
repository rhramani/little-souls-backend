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
var CustomerActivityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerActivityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CustomerActivityService = CustomerActivityService_1 = class CustomerActivityService {
    prisma;
    logger = new common_1.Logger(CustomerActivityService_1.name);
    activeSessions = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    startSession(data) {
        const key = data.sessionId || data.userId;
        const now = new Date();
        const existing = this.activeSessions.get(key);
        if (existing) {
            return existing;
        }
        const session = {
            sessionId: key,
            userId: data.userId,
            customerId: data.customerId || '',
            customerCode: data.customerCode || '',
            businessName: data.businessName || '',
            customerName: data.customerName || '',
            customerEmail: data.customerEmail || '',
            customerMobile: data.customerMobile || '',
            loginTime: now,
            currentSection: 'Home',
            currentSectionStartTime: Date.now(),
            sectionDurations: {},
            activities: [
                {
                    action: 'LOGIN',
                    section: 'Portal',
                    details: 'Logged into customer portal',
                    timestamp: now.toISOString(),
                },
            ],
        };
        this.activeSessions.set(key, session);
        this.logger.log(`Started activity session for customer ${data.customerName || data.userId}`);
        return session;
    }
    recordActivity(sessionKey, activity) {
        const session = this.activeSessions.get(sessionKey);
        if (!session)
            return;
        const now = Date.now();
        if (session.currentSection) {
            const durationSec = Math.max(0, Math.round((now - session.currentSectionStartTime) / 1000));
            session.sectionDurations[session.currentSection] =
                (session.sectionDurations[session.currentSection] || 0) + durationSec;
        }
        if (activity.section && activity.section !== session.currentSection) {
            session.currentSection = activity.section;
            session.currentSectionStartTime = now;
        }
        session.activities.push({
            action: activity.action,
            section: activity.section || session.currentSection,
            path: activity.path,
            details: activity.details,
            timestamp: new Date().toISOString(),
        });
    }
    getActiveSession(sessionKey) {
        return this.activeSessions.get(sessionKey);
    }
    async endSession(sessionKey, gatewayServer) {
        const session = this.activeSessions.get(sessionKey);
        if (!session)
            return null;
        const logoutTime = new Date();
        const nowMs = Date.now();
        if (session.currentSection) {
            const durationSec = Math.max(0, Math.round((nowMs - session.currentSectionStartTime) / 1000));
            session.sectionDurations[session.currentSection] =
                (session.sectionDurations[session.currentSection] || 0) + durationSec;
        }
        session.activities.push({
            action: 'LOGOUT',
            section: 'Portal',
            details: 'Logged out of customer portal',
            timestamp: logoutTime.toISOString(),
        });
        const totalDurationSeconds = Math.max(0, Math.round((logoutTime.getTime() - session.loginTime.getTime()) / 1000));
        let targetCustomerId = session.customerId;
        let customerInfo = {
            businessName: session.businessName,
            customerCode: session.customerCode,
            name: session.customerName,
            email: session.customerEmail,
            mobile: session.customerMobile,
        };
        const user = await this.prisma.user.findUnique({
            where: { id: session.userId },
            include: { customer: true },
        });
        if (user) {
            customerInfo.name = customerInfo.name || user.name;
            customerInfo.email = customerInfo.email || user.email || '';
            customerInfo.mobile = customerInfo.mobile || user.mobile;
            if (user.customer) {
                targetCustomerId = user.customer.id;
                customerInfo.businessName = customerInfo.businessName || user.customer.businessName;
                customerInfo.customerCode = customerInfo.customerCode || user.customer.customerCode || '';
            }
        }
        if (!targetCustomerId) {
            const cust = await this.prisma.customer.findFirst();
            if (cust)
                targetCustomerId = cust.id;
        }
        const formattedDuration = this.formatDuration(totalDurationSeconds);
        const formattedSections = Object.entries(session.sectionDurations)
            .map(([sec, dur]) => `${sec}: ${this.formatDuration(dur)}`)
            .join(', ');
        const keyActions = [];
        const searches = session.activities.filter((a) => a.action === 'SEARCH');
        if (searches.length > 0) {
            const searchTerms = Array.from(new Set(searches.map((s) => s.details).filter(Boolean))).join(', ');
            keyActions.push(`Searches: ${searchTerms}`);
        }
        const productViews = session.activities.filter((a) => a.action === 'VIEW_PRODUCT_DETAILS');
        if (productViews.length > 0) {
            keyActions.push(`Viewed ${productViews.length} product(s)`);
        }
        const cartAdds = session.activities.filter((a) => a.action === 'ADD_TO_CART');
        if (cartAdds.length > 0) {
            keyActions.push(`Added ${cartAdds.length} item(s) to cart`);
        }
        const orderPlaces = session.activities.filter((a) => a.action === 'PLACE_ORDER');
        if (orderPlaces.length > 0) {
            keyActions.push(`Placed Order`);
        }
        const keyHighlightsStr = keyActions.length > 0 ? keyActions.join(' | ') : '';
        const activitySummaryLines = session.activities.map((a) => {
            const timeStr = new Date(a.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
            return `${timeStr} - [${a.section}] ${a.details || a.action}`;
        });
        let savedSession = null;
        try {
            if (targetCustomerId) {
                savedSession = await this.prisma.customerActivitySession.create({
                    data: {
                        sessionId: session.sessionId,
                        customerId: targetCustomerId,
                        userId: session.userId,
                        loginTime: session.loginTime,
                        logoutTime,
                        totalDuration: totalDurationSeconds,
                        status: 'COMPLETED',
                        sectionDurations: JSON.stringify(session.sectionDurations),
                        activities: JSON.stringify(session.activities),
                    },
                });
            }
        }
        catch (err) {
            this.logger.error(`Error saving CustomerActivitySession DB record: ${err}`);
        }
        this.activeSessions.delete(sessionKey);
        const superAdmins = await this.prisma.user.findMany({
            where: {
                OR: [{ userType: 'SUPER_ADMIN' }, { userType: 'STAFF' }],
                isActive: true,
            },
            select: { id: true },
        });
        const displayCustName = customerInfo.businessName || customerInfo.name || 'Customer';
        const displayCustCode = customerInfo.customerCode ? ` (${customerInfo.customerCode})` : '';
        const notificationMessage = `Customer ${displayCustName}${displayCustCode} (Phone: ${customerInfo.mobile || 'N/A'}) logged out after ${formattedDuration}. Visited: ${formattedSections || 'Home'}.${keyHighlightsStr ? ' Highlights: ' + keyHighlightsStr + '.' : ''} Total actions logged: ${session.activities.length}.`;
        try {
            await Promise.all(superAdmins.map((admin) => this.prisma.notification.create({
                data: {
                    userId: admin.id,
                    title: `Customer Session Summary: ${displayCustName}${displayCustCode}`,
                    message: notificationMessage,
                    notificationType: 'SYSTEM',
                    isRead: false,
                },
            })));
        }
        catch (err) {
            this.logger.error(`Error creating admin Notifications: ${err}`);
        }
        const payload = {
            id: savedSession?.id || '',
            sessionId: session.sessionId,
            userId: session.userId,
            customerId: targetCustomerId,
            customer: customerInfo,
            loginTime: session.loginTime.toISOString(),
            logoutTime: logoutTime.toISOString(),
            totalDurationSeconds,
            formattedDuration,
            sectionDurations: session.sectionDurations,
            formattedSections,
            keyHighlights: keyHighlightsStr,
            activities: session.activities,
            activitySummaryLines,
            summaryMessage: notificationMessage,
        };
        if (gatewayServer) {
            gatewayServer.to('room:super_admin').emit('customer.session_summary', payload);
            this.logger.log(`Emitted customer.session_summary for customer ${customerInfo.name} (${session.activities.length} activities logged)`);
        }
        return payload;
    }
    async getSessionHistory(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [sessions, total] = await Promise.all([
            this.prisma.customerActivitySession.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            id: true,
                            businessName: true,
                            customerCode: true,
                            mainContactNumber: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            mobile: true,
                        },
                    },
                },
            }),
            this.prisma.customerActivitySession.count(),
        ]);
        const formattedSessions = sessions.map((s) => ({
            ...s,
            totalDurationFormatted: this.formatDuration(s.totalDuration || 0),
            sectionDurationsObj: s.sectionDurations ? JSON.parse(s.sectionDurations) : {},
            activitiesList: s.activities ? JSON.parse(s.activities) : [],
        }));
        return {
            sessions: formattedSessions,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getSessionDetails(id) {
        const session = await this.prisma.customerActivitySession.findUnique({
            where: { id },
            include: {
                customer: true,
                user: true,
            },
        });
        if (!session)
            return null;
        return {
            ...session,
            totalDurationFormatted: this.formatDuration(session.totalDuration || 0),
            sectionDurationsObj: session.sectionDurations ? JSON.parse(session.sectionDurations) : {},
            activitiesList: session.activities ? JSON.parse(session.activities) : [],
        };
    }
    formatDuration(totalSeconds) {
        if (!totalSeconds || totalSeconds <= 0)
            return '0s';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (hours > 0)
            parts.push(`${hours}h`);
        if (minutes > 0)
            parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0)
            parts.push(`${seconds}s`);
        return parts.join(' ');
    }
};
exports.CustomerActivityService = CustomerActivityService;
exports.CustomerActivityService = CustomerActivityService = CustomerActivityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomerActivityService);
//# sourceMappingURL=customer-activity.service.js.map