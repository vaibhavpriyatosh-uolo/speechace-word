# Next.js Fullstack Boilerplate

A complete Next.js 14 boilerplate with integrated backend API routes, TypeScript, and a simple user management example.

## Features

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Backend API Routes** built into Next.js
- **REST API** with CRUD operations
- **Axios** for API client
- **React 18** with modern hooks
- **Responsive UI** with custom CSS
- **Environment configuration** support
- **ESLint** for code quality

## Project Structure

```
sessionDisplay/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts          # Health check endpoint
│   │   │   └── users/
│   │   │       ├── route.ts           # GET, POST /api/users
│   │   │       └── [id]/
│   │   │           └── route.ts       # GET, PUT, DELETE /api/users/:id
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   └── globals.css                # Global styles
│   ├── components/
│   │   └── UserCard.tsx               # User card component
│   ├── lib/
│   │   └── api.ts                     # API client with axios
│   └── types/
│       └── index.ts                   # TypeScript type definitions
├── .env.local                         # Environment variables (local)
├── .env.example                       # Environment variables example
├── next.config.js                     # Next.js configuration
├── tsconfig.json                      # TypeScript configuration
├── package.json                       # Dependencies and scripts
└── README.md                          # This file
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

### Installation

1. Clone or navigate to the project directory:

```bash
cd sessionDisplay
```

2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:

Copy `.env.example` to `.env.local` and update the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
DATABASE_URL=your_database_url_here
JWT_SECRET=your_jwt_secret_here
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

Build the application:

```bash
npm run build
# or
yarn build
# or
pnpm build
```

Start the production server:

```bash
npm start
# or
yarn start
# or
pnpm start
```

### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
# or
yarn type-check
# or
pnpm type-check
```

### Linting

Run ESLint:

```bash
npm run lint
# or
yarn lint
# or
pnpm lint
```

## API Endpoints

### Health Check

- **GET** `/api/health` - Check API health status

### Users

- **GET** `/api/users` - Get all users
- **POST** `/api/users` - Create a new user
  - Body: `{ "name": "string", "email": "string" }`
- **GET** `/api/users/:id` - Get a user by ID
- **PUT** `/api/users/:id` - Update a user by ID
  - Body: `{ "name": "string", "email": "string" }`
- **DELETE** `/api/users/:id` - Delete a user by ID

### Example API Requests

Using curl:

```bash
# Get all users
curl http://localhost:3000/api/users

# Create a new user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Get a specific user
curl http://localhost:3000/api/users/1

# Update a user
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com"}'

# Delete a user
curl -X DELETE http://localhost:3000/api/users/1
```

## Using the API Client

The project includes a pre-configured API client in `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// Get all users
const response = await api.users.getAll();
console.log(response.data);

// Create a user
await api.users.create({ name: 'John', email: 'john@example.com' });

// Get a user by ID
const user = await api.users.getById(1);

// Update a user
await api.users.update(1, { name: 'Jane' });

// Delete a user
await api.users.delete(1);

// Health check
const health = await api.health.check();
```

## Customization

### Adding New API Routes

1. Create a new folder in `src/app/api/`
2. Add a `route.ts` file with your handlers
3. Export functions named after HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, etc.

Example:

```typescript
// src/app/api/posts/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ posts: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, data: body });
}
```

### Adding New Pages

1. Create a new folder in `src/app/`
2. Add a `page.tsx` file

Example:

```typescript
// src/app/about/page.tsx
export default function About() {
  return <div>About Page</div>;
}
```

## Technologies Used

- **Next.js 14** - React framework with server-side rendering
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Axios** - HTTP client for API requests
- **CSS** - Custom styling

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## License

MIT
# speechace-word
