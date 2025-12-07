import { NextRequest, NextResponse } from 'next/server';

interface User {
  id: number;
  name: string;
  email: string;
}

let users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: users,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const newUser: User = {
      id: users.length + 1,
      name,
      email,
    };

    users.push(newUser);

    return NextResponse.json({
      success: true,
      data: newUser,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
