import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityItem {
  action: string;
  section: string;
  path?: string;
  details?: string;
  timestamp: string;
  durationSeconds?: number;
}

export interface ActiveSessionData {
  sessionId: string;
  userId: string;
  customerId: string;
  customerCode?: string;
  businessName?: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  loginTime: Date;
  currentSection: string;
  currentSectionStartTime: number; // Date.now()
  sectionDurations: Record<string, number>; // sectionName -> totalSeconds
  activities: ActivityItem[];
}

@Injectable()
export class CustomerActivityService {
  private readonly logger = new Logger(CustomerActivityService.name);
  private activeSessions = new Map<string, ActiveSessionData>();

  constructor(private readonly prisma: PrismaService) {}

  startSession(data: {
    sessionId?: string;
    userId: string;
    customerId?: string;
    customerCode?: string;
    businessName?: string;
    customerName?: string;
    customerEmail?: string;
    customerMobile?: string;
  }): ActiveSessionData {
    const key = data.sessionId || data.userId;
    const now = new Date();

    const existing = this.activeSessions.get(key);
    if (existing) {
      return existing;
    }

    const session: ActiveSessionData = {
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
          details: 'Customer logged into the portal',
          timestamp: now.toISOString(),
        },
      ],
    };

    this.activeSessions.set(key, session);
    this.logger.log(`Started activity session for customer ${data.customerName || data.userId}`);
    return session;
  }

  recordActivity(
    sessionKey: string,
    activity: {
      action: string;
      section: string;
      path?: string;
      details?: string;
    },
  ) {
    const session = this.activeSessions.get(sessionKey);
    if (!session) return;

    const now = Date.now();
    // Update time spent on current section
    if (session.currentSection) {
      const durationSec = Math.max(0, Math.round((now - session.currentSectionStartTime) / 1000));
      session.sectionDurations[session.currentSection] =
        (session.sectionDurations[session.currentSection] || 0) + durationSec;
    }

    // Switch to new section if section changed
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

  getActiveSession(sessionKey: string): ActiveSessionData | undefined {
    return this.activeSessions.get(sessionKey);
  }

  async endSession(sessionKey: string, gatewayServer?: any) {
    const session = this.activeSessions.get(sessionKey);
    if (!session) return null;

    const logoutTime = new Date();
    const nowMs = Date.now();

    // Finalize duration for the current section
    if (session.currentSection) {
      const durationSec = Math.max(0, Math.round((nowMs - session.currentSectionStartTime) / 1000));
      session.sectionDurations[session.currentSection] =
        (session.sectionDurations[session.currentSection] || 0) + durationSec;
    }

    session.activities.push({
      action: 'LOGOUT',
      section: 'Portal',
      details: 'Customer logged out of the portal',
      timestamp: logoutTime.toISOString(),
    });

    const totalDurationSeconds = Math.max(
      0,
      Math.round((logoutTime.getTime() - session.loginTime.getTime()) / 1000),
    );

    // Fetch user and customer from DB if missing
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
      // Fallback to customer lookup if targetCustomerId is still missing
      const cust = await this.prisma.customer.findFirst();
      if (cust) targetCustomerId = cust.id;
    }

    // Format summary string
    const formattedDuration = this.formatDuration(totalDurationSeconds);
    const formattedSections = Object.entries(session.sectionDurations)
      .map(([sec, dur]) => `${sec}: ${this.formatDuration(dur)}`)
      .join(', ');

    // 1. Save Customer Activity Session to Database
    let savedSession: any = null;
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
    } catch (err) {
      this.logger.error(`Error saving CustomerActivitySession DB record: ${err}`);
    }

    // Remove from active buffer
    this.activeSessions.delete(sessionKey);

    // 2. Create in-app Notifications for Super Admins
    const superAdmins = await this.prisma.user.findMany({
      where: {
        OR: [{ userType: 'SUPER_ADMIN' }, { userType: 'STAFF' }],
        isActive: true,
      },
      select: { id: true },
    });

    const notificationMessage = `Customer ${customerInfo.businessName || customerInfo.name} (${customerInfo.customerCode || 'N/A'}) logged out. Total duration: ${formattedDuration}. Sections visited: ${formattedSections || 'Home'}.`;

    try {
      await Promise.all(
        superAdmins.map((admin) =>
          this.prisma.notification.create({
            data: {
              userId: admin.id,
              title: `Customer Session Summary: ${customerInfo.businessName || customerInfo.name}`,
              message: notificationMessage,
              notificationType: 'SYSTEM',
              isRead: false,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Error creating admin Notifications: ${err}`);
    }

    // 3. Emit Real-Time Socket.IO notification to Super Admin room
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
      activities: session.activities,
      summaryMessage: notificationMessage,
    };

    if (gatewayServer) {
      gatewayServer.to('room:super_admin').emit('customer.session_summary', payload);
      this.logger.log(`Emitted customer.session_summary for customer ${customerInfo.name}`);
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

  async getSessionDetails(id: string) {
    const session = await this.prisma.customerActivitySession.findUnique({
      where: { id },
      include: {
        customer: true,
        user: true,
      },
    });

    if (!session) return null;

    return {
      ...session,
      totalDurationFormatted: this.formatDuration(session.totalDuration || 0),
      sectionDurationsObj: session.sectionDurations ? JSON.parse(session.sectionDurations) : {},
      activitiesList: session.activities ? JSON.parse(session.activities) : [],
    };
  }

  private formatDuration(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  }
}
