# Peer Support Studio v2.0

**HIPAA-Compliant Multi-Tenant Peer Support Documentation Platform**

Built with Next.js 14, AWS Cognito, and Neon Database.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS Account (for Cognito)
- Neon Database account (with HIPAA add-on)

### 1. Clone and Install

```bash
cd pss-hipaa-platform
npm install
```

### 2. Set Up AWS Cognito

1. Go to AWS Cognito Console → Create User Pool
2. Configure sign-in options: Email
3. Configure password policy as needed
4. Add an App Client:
   - App type: Confidential client
   - Generate client secret: Yes
   - OAuth 2.0 settings:
     - Callback URL: `http://localhost:3000/api/auth/callback/cognito`
     - Sign-out URL: `http://localhost:3000`
     - OAuth scopes: openid, email, profile
5. Note your User Pool ID, Client ID, and Client Secret

### 3. Set Up Neon Database

1. Go to [neon.tech](https://neon.tech) → Create Project
2. Enable HIPAA compliance (Pro plan required)
3. Run `schema.sql` in Neon SQL Editor
4. Copy your connection string

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
pss-hipaa-platform/
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/[...nextauth]/ # NextAuth + Cognito
│   │   ├── organizations/      # Org CRUD
│   │   ├── participants/       # Participant CRUD (PHI)
│   │   ├── goals/              # Goals CRUD
│   │   └── session-notes/      # Session notes (PHI)
│   ├── auth/signin/            # Sign in page
│   ├── participants/           # Participant management
│   │   ├── [id]/               # Detail view
│   │   └── new/                # Create form
│   └── ...
├── components/                 # Shared components
├── lib/                        # Utilities
│   ├── auth.ts                 # Auth helpers
│   └── db.ts                   # Database helpers
├── types/                      # TypeScript types
└── schema.sql                  # Database schema
```

---

## 🗃️ Database Schema

### Core Tables

| Table | Description | Contains PHI |
|-------|-------------|--------------|
| `organizations` | Multi-tenant orgs | No |
| `users` | User profiles | No |
| `organization_members` | Membership & roles | No |
| `participants` | Individuals served | **Yes** |
| `goals` | Recovery goals | **Yes** |
| `session_notes` | Documentation | **Yes** |
| `recovery_assessments` | BARC-10 scores | **Yes** |
| `audit_log` | Activity logging | No |

### User Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access, billing, delete org |
| `admin` | Manage members, settings |
| `supervisor` | Review notes, approve services |
| `pss` | Standard peer support access |

---

## 🔐 Security Features

### HIPAA Compliance
- ✅ Data encrypted at rest (Neon)
- ✅ Data encrypted in transit (TLS)
- ✅ Audit logging for all PHI access
- ✅ Role-based access control
- ✅ 8-hour session timeout
- ✅ Secure authentication (Cognito)

### Multi-Tenant Isolation
- All queries filtered by `organization_id`
- Users can only see their org's data
- Audit log tracks org context

---

## 🛠️ API Reference

### Participants

```typescript
// List participants
GET /api/participants?organization_id=xxx&status=active

// Create participant
POST /api/participants
{ organization_id, first_name, last_name, ... }

// Update participant
PUT /api/participants
{ id, organization_id, ...updates }

// Archive participant
DELETE /api/participants?id=xxx&organization_id=xxx
```

### Goals

```typescript
// List goals
GET /api/goals?organization_id=xxx&participant_id=xxx

// Create goal
POST /api/goals
{ organization_id, participant_id, title, goal_area, desired_outcome }

// Update goal
PUT /api/goals
{ id, organization_id, status, progress, ... }
```

### Organizations

```typescript
// List user's organizations
GET /api/organizations

// Create organization
POST /api/organizations
{ name, type, city, state }
```

---

## 📊 Features

### Current (v2.0)
- [x] Multi-tenant organizations
- [x] Participant management (PHI)
- [x] Goals linked to participants
- [x] Session notes linked to participants
- [x] Recovery Capital assessments
- [x] Audit logging
- [x] Role-based access

### Planned
- [ ] AI-powered session note generation
- [ ] Goal progress tracking
- [ ] Supervisor review workflow
- [ ] Team assignment
- [ ] EHR integration
- [ ] Mobile app

---

## 💰 Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| Neon Database (Pro + HIPAA) | $20-50 |
| AWS Cognito (per MAU) | $1-5 |
| Vercel Hosting | $0-20 |
| **Total** | **$21-75/mo** |

Compare to Supabase HIPAA: $499/mo

---

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

```env
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generate-new-secret>
COGNITO_CLIENT_ID=xxx
COGNITO_CLIENT_SECRET=xxx
COGNITO_ISSUER=https://cognito-idp.region.amazonaws.com/pool-id
DATABASE_URL=postgresql://...
```

---

## 📝 License

Proprietary - Peer Support Studio / MADe180

---

## 🆘 Support

For questions or issues, contact the development team.
