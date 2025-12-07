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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: user,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { name, email } = body;

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    users[userIndex] = {
      ...users[userIndex],
      ...(name && { name }),
      ...(email && { email }),
    };

    return NextResponse.json({
      success: true,
      data: users[userIndex],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 }
    );
  }

  const deletedUser = users[userIndex];
  users = users.filter((u) => u.id !== id);

  return NextResponse.json({
    success: true,
    data: deletedUser,
  });
}
