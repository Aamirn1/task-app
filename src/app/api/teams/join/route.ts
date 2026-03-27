import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const [userId] = Buffer.from(token, 'base64').toString().split(':');

    const body = await request.json();
    const { inviteCode } = body;

    const business = await db.business.findUnique({
      where: { inviteCode },
    });

    if (!business) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a member or has pending request
    const existingRequest = await db.joinRequest.findFirst({
      where: { userId, businessId: business.id },
    });

    if (existingRequest) {
      return NextResponse.json({ 
        error: 'You already have a pending request or are a member',
        request: existingRequest,
      }, { status: 400 });
    }

    // Create join request
    const joinRequest = await db.joinRequest.create({
      data: {
        businessId: business.id,
        userId,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      message: 'Join request submitted',
      request: joinRequest,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('Join team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
