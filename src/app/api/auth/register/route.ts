import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, role, teamName, founderName, businessType, workerCount, description, inviteCode } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    if (role === 'ADMIN') {
      // Validate admin fields
      if (!teamName || !founderName || !businessType) {
        return NextResponse.json(
          { error: 'Team name, founder name, and business type are required' },
          { status: 400 }
        );
      }
      
      // Create business and admin user
      const code = generateInviteCode();
      
      const business = await db.business.create({
        data: {
          name: teamName,
          founderName,
          businessType,
          description: description || null,
          workerCount: workerCount || 0,
          inviteCode: code,
          subscription: 'FREE',
          taskLimit: 100,
          tasksUsed: 0,
        },
      });

      const user = await db.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'ADMIN',
          businessId: business.id,
        },
      });

      const { password: _, ...userWithoutPassword } = user;
      const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      return NextResponse.json({
        user: userWithoutPassword,
        business,
        team: business, // Backward compatibility
        token,
      });
    } else {
      // Member registration with invite code
      let business = null;
      
      if (inviteCode && inviteCode.trim()) {
        // Find business by invite code
        business = await db.business.findUnique({
          where: { inviteCode: inviteCode.toUpperCase() },
        });
        
        if (!business) {
          return NextResponse.json(
            { error: 'Invalid invite code' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Invite code is required to join a team' },
          { status: 400 }
        );
      }
      
      // Create member user WITHOUT businessId (pending approval)
      const user = await db.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'MEMBER',
          businessId: null, // Not approved yet
        },
      });

      // Create a join request for admin approval
      await db.joinRequest.create({
        data: {
          userId: user.id,
          businessId: business.id,
          status: 'PENDING',
        },
      });

      // Find admin and create notification about the join request
      const admin = await db.user.findFirst({
        where: { businessId: business.id, role: 'ADMIN' },
      });
      
      if (admin) {
        await db.notification.create({
          data: {
            taskId: null,
            userId: admin.id,
            type: 'JOIN_REQUEST',
            title: 'New Join Request',
            message: `${name} wants to join your team. Review and approve in Requests.`,
            read: false,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          },
        });
      }

      const { password: _, ...userWithoutPassword } = user;
      const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      // Return user with pending status and business info (for display purposes)
      return NextResponse.json({
        user: userWithoutPassword,
        business: null, // No business access until approved
        team: null,
        pendingApproval: true,
        pendingBusinessName: business.name, // Show which team they're waiting for
        token,
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
