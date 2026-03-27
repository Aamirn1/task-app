import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get team members
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

    if (!user || !user.businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 400 });
    }

    const members = await db.user.findMany({
      where: { businessId: user.businessId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get assignment stats for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const assignedTasks = await db.assignment.count({
          where: {
            userId: member.id,
            task: { expiresAt: { gt: new Date() } },
          },
        });

        const completedTasks = await db.assignment.count({
          where: {
            userId: member.id,
            status: 'COMPLETED',
          },
        });

        const pendingTasks = await db.assignment.count({
          where: {
            userId: member.id,
            status: { in: ['PENDING', 'SEEN'] },
            task: { expiresAt: { gt: new Date() } },
          },
        });

        return {
          ...member,
          stats: {
            assigned: assignedTasks,
            completed: completedTasks,
            pending: pendingTasks,
          },
        };
      })
    );

    return NextResponse.json({ members: membersWithStats });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a team member
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const [adminUserId] = Buffer.from(token, 'base64').toString().split(':');

    const adminUser = await db.user.findUnique({
      where: { id: adminUserId },
    });

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if the user to delete exists and belongs to the same business
    const userToDelete = await db.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userToDelete.businessId !== adminUser.businessId) {
      return NextResponse.json({ error: 'User is not in your team' }, { status: 403 });
    }

    if (userToDelete.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot remove admin users' }, { status: 403 });
    }

    // Create notification for the removed user
    await db.notification.create({
      data: {
        taskId: 'removed-from-team',
        userId: userId,
        type: 'REMOVED_FROM_TEAM',
        title: 'Removed from Team',
        message: `You have been removed from ${adminUser.business?.name || 'the team'}. You can create a new account and join another team.`,
        read: false,
      },
    });

    // Mark user as deleted (soft delete) - they can still login but will see the deletion message
    await db.user.update({
      where: { id: userId },
      data: {
        businessId: null,
        isDeleted: true,
        deletedFromBusinessId: adminUser.businessId,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
