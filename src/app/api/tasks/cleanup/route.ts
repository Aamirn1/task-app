import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Cleanup expired tasks - Called by cron or scheduled job
// In production, this would be protected by a cron secret
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret for production
    // const cronSecret = request.headers.get('x-cron-secret');
    // if (cronSecret !== process.env.CRON_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const now = new Date();
    let tasksArchived = 0;
    let notificationsDeleted = 0;

    // Find all expired tasks
    const expiredTasks = await db.task.findMany({
      where: {
        expiresAt: { lt: now },
        status: { not: 'EXPIRED' },
      },
      include: {
        media: true,
        assignments: true,
      },
    });

    // Archive and delete each expired task
    for (const task of expiredTasks) {
      // Create archive entry
      await db.taskArchive.create({
        data: {
          originalId: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          finalStatus: 'EXPIRED',
          businessId: task.businessId,
          creatorId: task.creatorId,
          createdAt: task.createdAt,
          expiresAt: task.expiresAt,
        },
      });

      // Delete task (cascade handles media, assignments, notifications)
      await db.task.delete({
        where: { id: task.id },
      });

      tasksArchived++;
    }

    // Delete old notifications (older than 14 days)
    const deletedNotifications = await db.notification.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    notificationsDeleted = deletedNotifications.count;

    // Delete old archived tasks (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await db.taskArchive.deleteMany({
      where: {
        archivedAt: { lt: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      success: true,
      tasksArchived,
      notificationsDeleted,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to check for expired tasks (for client-side polling)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    
    // Count tasks nearing expiry (within 24 hours)
    const twentyFourHoursFromNow = new Date();
    twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);

    const nearingExpiry = await db.task.count({
      where: {
        expiresAt: {
          gt: now,
          lt: twentyFourHoursFromNow,
        },
        status: { notIn: ['COMPLETED', 'EXPIRED'] },
      },
    });

    return NextResponse.json({
      nearingExpiryCount: nearingExpiry,
      lastCleanup: now.toISOString(),
    });
  } catch (error) {
    console.error('Check expiry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
