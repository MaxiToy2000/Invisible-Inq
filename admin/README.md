# Admin Dashboard

Admin dashboard for Invisible-Inq application.

## Features

- **Authentication**: Secure admin login with JWT tokens
- **Dashboard**: Overview of system statistics and recent activities
- **User Activities**: Monitor and filter user activities
- **User Management**: View all users and their details

## Setup

### 1. Install Dependencies

```bash
cd admin
npm install
```

### 2. Configure Environment

Create a `.env` file (or use the existing one):

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Start Development Server

```bash
npm run dev
```

The admin dashboard will be available at: `http://localhost:3001`

## Default Credentials

After creating an admin user (see main project README):

- Email: `admin@example.com`
- Password: `adminadmin`

## API Endpoints Used

- `POST /api/auth/admin/login` - Admin authentication
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/activities` - User activities with filters
- `GET /api/admin/users` - All users list

## Project Structure

```
admin/
├── src/
│   ├── components/
│   │   ├── Layout.jsx          # Main layout with sidebar
│   │   └── ProtectedRoute.jsx  # Route protection
│   ├── contexts/
│   │   └── AuthContext.jsx     # Authentication context
│   ├── pages/
│   │   ├── LoginPage.jsx       # Login page
│   │   ├── DashboardPage.jsx   # Dashboard overview
│   │   ├── ActivitiesPage.jsx  # User activities
│   │   └── UsersPage.jsx       # User management
│   ├── utils/
│   │   └── api.js              # API utility functions
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── vite.config.js
└── index.html
```

## Development

The admin dashboard is built with:
- **React 19** - UI framework
- **React Router** - Routing
- **Vite** - Build tool
- **Tailwind CSS** - Styling

## Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Notes

- The admin dashboard requires the backend API to be running on port 8000
- All API requests include JWT authentication tokens
- Make sure to create an admin user before logging in (see backend setup)
