import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has a pending join request
    const pendingRequest = await db.joinRequest.findFirst({
      where: { 
        userId: user.id,
        status: 'PENDING',
      },
      include: { business: true },
    });

    const { password: _, business, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: { ...userWithoutPassword, businessId: user.businessId },
      business,
      team: business, // Backward compatibility
      pendingApproval: !!pendingRequest,
      pendingBusinessName: pendingRequest?.business?.name || null,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
