import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const user = await db.user.findUnique({
      where: { email },
      include: {
        business: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user was removed from a team
    if (user.isDeleted) {
      return NextResponse.json(
        { 
          error: 'Your account was removed from the team. You can create a new account with different credentials or contact the team admin.',
          isDeleted: true,
          deletedFromBusinessId: user.deletedFromBusinessId,
        },
        { status: 403 }
      );
    }

    const hashedPassword = hashPassword(password);

    if (user.password !== hashedPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const { password: _, business, ...userWithoutPassword } = user;
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      user: { ...userWithoutPassword, businessId: user.businessId },
      business,
      team: business, // Backward compatibility
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
