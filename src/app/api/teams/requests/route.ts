import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get all join requests for admin's business
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
      include: { business: true },
    });

    if (!user || user.role !== 'ADMIN' || !user.businessId) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const requests = await db.joinRequest.findMany({
      where: { 
        businessId: user.businessId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, createdAt: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Approve or reject a join request
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
    const { requestId, action } = body; // action: 'approve' or 'reject'

    const joinRequest = await db.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest || joinRequest.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Update user's business
      await db.user.update({
        where: { id: joinRequest.userId },
        data: { businessId: user.businessId },
      });

      // Update business worker count
      await db.business.update({
        where: { id: user.businessId },
        data: { workerCount: { increment: 1 } },
      });

      // Delete the join request
      await db.joinRequest.delete({
        where: { id: requestId },
      });

      return NextResponse.json({ message: 'Request approved' });
    } else {
      // Reject - just delete the request
      await db.joinRequest.delete({
        where: { id: requestId },
      });

      return NextResponse.json({ message: 'Request rejected' });
    }
  } catch (error) {
    console.error('Update request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
