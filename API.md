## API Reference

Base URL examples:

- Local: `http://localhost:3000`

Auth model:

- Session cookie after `POST /api/login`
- Some endpoints restricted to ADMIN via session role
- Content types: `application/json` unless stated

Conventions:

- Timestamps are ISO strings unless noted
- IDs are Mongo ObjectIds when MongoDB is enabled

---

### Auth

#### POST /api/login

- Purpose: Authenticate user and start session
- Body:

```json
{ "username": "admin", "password": "secret" }
```

- Response 200:

```json
{ "success": true, "user": { "username": "admin", "role": "ADMIN" } }
```

- Errors: 400 (missing), 401 (invalid), 500

#### POST /api/logout

- Purpose: Destroy current session
- Response 200:

```json
{ "success": true }
```

#### GET /api/auth/status

- Purpose: Check if authenticated
- Response 200 (authenticated):

```json
{ "authenticated": true, "user": { "username": "admin", "role": "ADMIN" } }
```

- Response 200 (not auth): `{ "authenticated": false }`

---

### Activity Intake

#### POST /collect-activity

- Purpose: Bulk activity ingestion
- Body:

```json
{
  "events": [
    {
      "deviceId": "ABC123",
      "domain": "example.com",
      "durationMs": 1200,
      "timestamp": "2025-01-01T12:00:00.000Z",
      "reason": "active",
      "username": "john",
      "type": "window_activity",
      "data": { "title": "Docs" }
    }
  ]
}
```

- Response 200:

```json
{
  "received": 1,
  "message": "Events stored successfully",
  "timestamp": "2025-01-01T12:00:01.000Z"
}
```

- Errors: 400 (invalid payload)

#### POST /collect-tracking

- Purpose: Track UI/form events
- Body: `{ "events": [...] }`
- Response 200:

```json
{ "success": true, "count": 3 }
```

- Errors: 500

#### POST /collect-screenshot

- Purpose: Upload base64 PNG screenshot and metadata
- Body:

```json
{
  "deviceId": "ABC123",
  "domain": "example.com",
  "username": "john",
  "screenshot": "data:image/png;base64,iVBORw0KGgo..."
}
```

- Response 200:

```json
{ "saved": "1738166400000_abcd1234_john_example_com.png" }
```

- Errors: 400, 500

---

### Analytics and Activity

#### GET /api/activity

- Purpose: Recent activity with filters
- Query: `user`, `domain`, `limit`, `page`, `timeRange`
- Response 200:

```json
{
  "count": 50,
  "events": [
    {
      "username": "john",
      "domain": "example.com",
      "durationMs": 1000,
      "timestamp": "2025-01-01T12:00:00.000Z",
      "reason": "active",
      "type": "window_activity",
      "data": {}
    }
  ],
  "stats": {
    "totalEvents": 100,
    "uniqueUsers": 5,
    "uniqueDomains": 12,
    "totalDuration": 123456,
    "averageDuration": 789
  }
}
```

#### GET /api/analytics/summary

- Purpose: Totals and time-window aggregates
- Response 200:

```json
{
  "total": { "events": 1000, "users": 12, "domains": 85, "duration": 1234567 },
  "today": { "events": 120, "duration": 34567 },
  "thisWeek": { "events": 540, "duration": 456789 },
  "thisMonth": { "events": 980, "duration": 112233 }
}
```

#### GET /api/analytics/top-domains

- Purpose: Top domains by time/visits
- Query: `limit`
- Response 200:

```json
{
  "domains": [
    {
      "domain": "example.com",
      "totalTime": 123456,
      "visitCount": 42,
      "lastVisit": "2025-01-01T12:00:00.000Z",
      "totalTimeMinutes": 2058,
      "averageTimeMinutes": 49
    }
  ]
}
```

#### GET /api/analytics/users

- Purpose: Per-user aggregates
- Response 200:

```json
{
  "users": [
    {
      "username": "john",
      "events": 120,
      "domains": 15,
      "totalTime": 54321,
      "avgTime": 450
    }
  ]
}
```

---

### Screenshots

#### GET /api/screenshots

- Purpose: List screenshots
- Query: `limit`, `user`
- Response 200:

```json
{
  "count": 200,
  "files": [
    {
      "filename": "1738166400000_abcd1234_john_example_com.png",
      "url": "/screenshots/1738166400000_abcd1234_john_example_com.png",
      "mtime": 1738166401000
    }
  ]
}
```

#### DELETE /api/screenshots/:filename

- Purpose: Delete one screenshot by filename
- Response 200:

```json
{
  "success": true,
  "message": "Screenshot deleted successfully",
  "filename": "1738166400000_abcd1234_john_example_com.png"
}
```

#### DELETE /api/screenshots

- Purpose: Bulk delete screenshots
- Body:

```json
{ "filenames": ["a.png", "b.png"], "user": "john" }
```

- Response 200:

```json
{ "success": true, "message": "Deleted 2 screenshot(s)", "deletedCount": 2 }
```

#### Static /screenshots/\*

- Purpose: Serve stored PNG files

---

### Users (ADMIN)

#### GET /api/users

- Purpose: List users (no passwords)
- Response 200:

```json
{
  "users": [
    {
      "_id": "...",
      "username": "admin",
      "role": "ADMIN",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLogin": "2025-01-02T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/users

- Purpose: Create user
- Body:

```json
{ "username": "jane", "password": "secret", "role": "VIEWER" }
```

- Response 200:

```json
{ "success": true, "user": { "username": "jane", "role": "VIEWER" } }
```

#### DELETE /api/users/:id

- Purpose: Delete user by ID (prevents deleting last admin)
- Response 200: `{ "success": true }`

#### DELETE /api/admin/delete-user/:username

- Purpose: Delete all data for a user (activity + screenshots)
- Response 200:

```json
{
  "success": true,
  "message": "Successfully deleted data for user john",
  "deleted": { "activityLogs": 10, "screenshots": 5, "screenshotRecords": 5 }
}
```

---

### Departments (ADMIN)

#### GET /api/departments

- Purpose: List departments
- Response 200:

```json
{
  "departments": [
    { "id": "sales", "name": "Sales", "color": "#ff0000", "description": "" }
  ]
}
```

#### POST /api/departments

- Purpose: Create department
- Body:

```json
{ "id": "sales", "name": "Sales", "color": "#ff0000", "description": "" }
```

- Response 200: `{ "success": true, "department": { "id": "sales", "name": "Sales", "color": "#ff0000", "description": "" } }`

#### PUT /api/departments/:id

- Purpose: Update department
- Body: Partial fields
- Response 200: `{ "success": true, "department": { ... } }`

#### DELETE /api/departments/:id

- Purpose: Delete department
- Response 200: `{ "success": true }`

#### GET /api/user-departments

- Purpose: List user-to-department assignments
- Response 200: `{ "assignments": [ { "username": "john", "departmentId": "sales" } ] }`

#### POST /api/user-departments

- Purpose: Assign user
- Body:

```json
{ "username": "john", "departmentId": "sales" }
```

- Response 200: `{ "success": true }`

#### DELETE /api/user-departments

- Purpose: Unassign user
- Body:

```json
{ "username": "john", "departmentId": "sales" }
```

- Response 200: `{ "success": true }`

#### GET /api/departments/:id/users

- Purpose: Users in department
- Response 200: `{ "users": ["john", "jane"] }`

#### POST /api/departments/filter-users

- Purpose: Filter users by department
- Body:

```json
{ "users": ["john", "jane"], "departmentId": "sales" }
```

- Response 200: `{ "users": ["john"] }`

#### POST /api/departments/group-users

- Purpose: Group users by department
- Body:

```json
{ "users": ["john", "jane"] }
```

- Response 200: `{ "groups": { "sales": ["john"] } }`

#### GET /api/departments/:id/stats

- Purpose: Department stats summary
- Response 200: `{ "stats": { "events": 100, "duration": 12345 } }`

#### GET /api/departments/search

- Purpose: Search departments
- Query: `q`
- Response 200: `{ "departments": [ ... ] }`

#### GET /api/departments/export

- Purpose: Export departments as JSON file
- Response: File download

#### POST /api/departments/import

- Purpose: Import departments from JSON
- Body:

```json
{ "data": [{ "id": "sales", "name": "Sales", "color": "#ff0000" }] }
```

- Response 200: `{ "success": true, "count": 1 }`

---

### Export

#### GET /api/export/csv

- Purpose: Export activity as CSV
- Query: accepts same filters as `/api/activity`
- Response: CSV file

#### GET /api/export/json

- Purpose: Export activity as JSON
- Query: accepts same filters as `/api/activity`
- Response: JSON file

---

### System

#### GET /ping

- Purpose: Liveness check
- Response 200: `{ "message": "pong" }`

#### GET /api/health

- Purpose: Health and basic stats
- Response 200:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "dataFile": {
    "exists": true,
    "size": 12345,
    "lastModified": "2025-01-01T12:00:00.000Z"
  },
  "screenshots": { "count": 42 }
}
```
