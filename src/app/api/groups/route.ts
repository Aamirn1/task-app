import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get groups
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

    const groups = await db.group.findMany({
      where: { businessId: user.businessId },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groupsWithCount = groups.map((g) => ({
      ...g,
      memberCount: g._count.members,
    }));

    return NextResponse.json({ groups: groupsWithCount });
  } catch (error) {
    console.error('Get groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create group
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

    if (!user.businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, memberIds = [] } = body;

    const group = await db.group.create({
      data: {
        name,
        description,
        businessId: user.businessId,
        members: {
          create: memberIds.map((id: string) => ({
            userId: id,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update group
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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { groupId, name, description, memberIds } = body;

    const group = await db.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Update group details
    await db.group.update({
      where: { id: groupId },
      data: { name, description },
    });

    // Update members if provided
    if (memberIds) {
      // Remove existing members
      await db.groupMember.deleteMany({
        where: { groupId },
      });

      // Add new members
      await db.groupMember.createMany({
        data: memberIds.map((id: string) => ({
          groupId,
          userId: id,
        })),
      });
    }

    return NextResponse.json({ message: 'Group updated' });
  } catch (error) {
    console.error('Update group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete group
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
    const groupId = searchParams.get('id');

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    await db.group.delete({
      where: { id: groupId },
    });

    return NextResponse.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Delete group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
