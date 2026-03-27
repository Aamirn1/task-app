import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Check for critical tasks that need escalation
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const [userId] = Buffer.from(token, 'base64').toString().split(':');

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find critical tasks assigned to this user that haven't been seen in 5 minutes
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const unacknowledgedCritical = await db.task.findMany({
      where: {
        priority: 'CRITICAL',
        assignments: {
          some: {
            userId: user.id,
            seenAt: null,
            createdAt: { lt: fiveMinutesAgo },
          },
        },
        expiresAt: { gt: new Date() },
      },
      include: {
        assignments: {
          where: { userId: user.id },
        },
      },
    });

    // Create escalation notifications for these tasks
    const escalationPromises = unacknowledgedCritical.map((task) =>
      db.notification.create({
        data: {
          taskId: task.id,
          userId: user.id,
          type: 'ESCALATION',
          title: '⚠️ CRITICAL TASK UNACKNOWLEDGED',
          message: `"${task.title}" - Please acknowledge this urgent task!`,
          read: false,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      })
    );

    await Promise.all(escalationPromises);

    return NextResponse.json({
      criticalTasks: unacknowledgedCritical.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        assignment: t.assignments[0],
      })),
      escalationCount: unacknowledgedCritical.length,
    });
  } catch (error) {
    console.error('Check escalation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Trigger alarm for a specific task (admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const [userId] = Buffer.from(token, 'base64').toString().split(':');

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, targetUserId } = body;

    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Create escalation notification
    await db.notification.create({
      data: {
        taskId: task.id,
        userId: targetUserId,
        type: 'CRITICAL_ALARM',
        title: `🚨 URGENT: ${task.title}`,
        message: 'Admin has escalated this critical task!',
        read: false,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ 
      message: 'Alarm triggered',
      taskId,
      targetUserId,
    });
  } catch (error) {
    console.error('Trigger alarm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
