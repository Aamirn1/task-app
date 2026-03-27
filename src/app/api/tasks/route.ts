import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get tasks with proper filtering and read receipts
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

    let tasks;
    const now = new Date();

    if (user.role === 'ADMIN') {
      // Admin sees all tasks in their business with assignment details
      tasks = await db.task.findMany({
        where: { 
          businessId: user.businessId,
          expiresAt: { gt: now } // Only non-expired tasks
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, name: true } },
          media: true,
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
        },
        orderBy: [
          { priority: 'asc' }, // CRITICAL first, then STANDARD, then FLEXIBLE
          { createdAt: 'desc' },
        ],
      });
    } else {
      // Member sees only their assigned tasks
      tasks = await db.task.findMany({
        where: {
          businessId: user.businessId,
          assignments: { some: { userId: user.id } },
          expiresAt: { gt: now },
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, name: true } },
          media: true,
          assignments: {
            where: { userId: user.id },
          },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
      });
    }

    // Calculate read receipts for admin
    const tasksWithReceipts = tasks.map((task) => {
      const assignmentStats = {
        total: task.assignments.length,
        seen: task.assignments.filter((a) => a.seenAt).length,
        inProgress: task.assignments.filter((a) => a.status === 'IN_PROGRESS').length,
        completed: task.assignments.filter((a) => a.status === 'COMPLETED').length,
      };
      
      return {
        ...task,
        receipts: assignmentStats,
      };
    });

    return NextResponse.json({ tasks: tasksWithReceipts });
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create task with enhanced features
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
      include: { business: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!user.businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 400 });
    }

    // Check task limit
    if (user.business && user.business.tasksUsed >= user.business.taskLimit) {
      return NextResponse.json({ 
        error: 'Task limit reached. Upgrade your plan to create more tasks.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      priority = 'STANDARD', 
      deadline, 
      expiresInDays = 7,
      assigneeIds = [],
      groupId,
      mediaFiles = [], // Array of { type, url, fileName, fileSize, duration }
    } = body;

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Calculate notification expiry (14 days)
    const notificationExpiresAt = new Date();
    notificationExpiresAt.setDate(notificationExpiresAt.getDate() + 14);

    // Determine notification type based on priority
    const notificationType = priority === 'CRITICAL' 
      ? 'CRITICAL_ALARM' 
      : priority === 'STANDARD' 
        ? 'STANDARD_ALERT' 
        : 'FLEXIBLE_ALERT';

    // Create task with assignments and media
    const task = await db.task.create({
      data: {
        title,
        description,
        priority,
        status: 'PENDING',
        deadline: deadline ? new Date(deadline) : null,
        expiresAt,
        businessId: user.businessId,
        creatorId: user.id,
        groupId: groupId || null,
        media: {
          create: mediaFiles.map((m: { type: string; url: string; fileName?: string; fileSize?: number; duration?: number }) => ({
            type: m.type,
            url: m.url,
            fileName: m.fileName,
            fileSize: m.fileSize,
            duration: m.duration,
          })),
        },
        assignments: {
          create: assigneeIds.map((id: string) => ({
            userId: id,
            status: 'PENDING',
          })),
        },
      },
      include: {
        media: true,
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Create notifications for assignees
    if (assigneeIds.length > 0) {
      await db.notification.createMany({
        data: assigneeIds.map((id: string) => ({
          taskId: task.id,
          userId: id,
          type: notificationType,
          title: priority === 'CRITICAL' 
            ? `🚨 CRITICAL: ${title}`
            : `New ${priority.toLowerCase()} task`,
          message: title,
          read: false,
          expiresAt: notificationExpiresAt,
        })),
      });
    }

    // Increment tasks used
    await db.business.update({
      where: { id: user.businessId },
      data: { tasksUsed: { increment: 1 } },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update task status with read receipts
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { taskId, status, assignmentId } = body;

    if (assignmentId) {
      // Member updating their assignment
      const assignment = await db.assignment.findUnique({
        where: { id: assignmentId },
        include: { task: true },
      });

      if (!assignment || assignment.userId !== user.id) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = { status };
      if (status === 'SEEN' && !assignment.seenAt) {
        updateData.seenAt = new Date();
      }
      if (status === 'IN_PROGRESS') {
        updateData.startedAt = new Date();
      }
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }

      const updatedAssignment = await db.assignment.update({
        where: { id: assignmentId },
        data: updateData,
      });

      // If critical task acknowledged, stop alarm for this user
      if (assignment.task.priority === 'CRITICAL' && status === 'SEEN') {
        // Mark related notification as read
        await db.notification.updateMany({
          where: { 
            taskId: assignment.taskId, 
            userId: user.id,
            read: false 
          },
          data: { read: true, readAt: new Date() },
        });
      }

      return NextResponse.json({ 
        message: 'Assignment updated',
        assignment: updatedAssignment 
      });
    } else if (taskId) {
      // Admin updating task
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const task = await db.task.findUnique({
        where: { id: taskId },
      });

      if (!task || task.businessId !== user.businessId) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      await db.task.update({
        where: { id: taskId },
        data: { status },
      });

      return NextResponse.json({ message: 'Task updated' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete task and associated data
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { media: true },
    });

    if (!task || task.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Archive the task before deletion
    await db.taskArchive.create({
      data: {
        originalId: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        finalStatus: task.status,
        businessId: task.businessId,
        creatorId: task.creatorId,
        createdAt: task.createdAt,
        expiresAt: task.expiresAt,
      },
    });

    // Delete task (cascade will handle media, assignments, notifications)
    await db.task.delete({
      where: { id: taskId },
    });

    // Decrement tasks used
    await db.business.update({
      where: { id: user.businessId },
      data: { tasksUsed: { decrement: 1 } },
    });

    return NextResponse.json({ message: 'Task deleted and archived' });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
