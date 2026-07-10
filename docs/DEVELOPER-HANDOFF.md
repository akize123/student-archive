# AUCA Smart Archive — Developer Handoff Guide

This document is the continuation guide for anyone taking over **AUCA Smart Archive**.  
It explains what the system is, how it is built, how to run it, and the rules you must not break when extending it.

---

## 1. What this project is

**AUCA Smart Archive** is a role-based document archive for Adventist University of Central Africa (AUCA).

It lets staff and students:

- Browse a faculty → department → academic year → semester folder tree
- Upload and search student-related documents
- Approve / reject submissions (especially Final Year Projects)
- Manage users and privileges (Admin)
- Monitor office activity (Admin Offices view)

**Product name in UI:** AUCA Smart Archive  
**Backend package:** `com.auca.archive`  
**Default ports:**

| Layer | URL | Port |
|-------|-----|------|
| Frontend (Vite) | http://localhost:5173 | 5173 |
| Backend API | http://localhost:8081 | 8081 |

> Open the **frontend** URL in the browser. Port `8081` is API-only (JSON). Opening `/` on 8081 returns a small status payload pointing to the frontend.

---

## 2. Tech stack

### Backend
- Java **17**
- Spring Boot **3.3.1**
- Spring Web + Spring Data JPA + Validation
- PostgreSQL (`aucaarchivedb`)
- Apache PDFBox (PDF validation / scan helpers)
- Optional Elasticsearch (currently **disabled**; search falls back to DB)
- Local file storage under `backend/storage/`
- Optional file encryption (disabled by default in `application.properties`)

### Frontend
- React **18**
- Vite **5**
- Single-page app (hash routing for folders: `#/folders/{id}`)
- No React Router package — routing is hash-based in `App.jsx`
- Session stored in `localStorage` key: `auca-archive-session`

### Auth model (important)
There is **no JWT / Spring Security filter chain** for API calls yet.  
After login, the frontend stores the session and sends headers on every request:

- `X-User-Role`
- `X-User-Name`
- `X-Student-Number` (students only)

Backend services trust these headers for access control.  
**Security hardening (real auth tokens) is a recommended next step.**

---

## 3. Repository layout

```text
AkizeProject/
├── backend/                          # Spring Boot API
│   ├── pom.xml
│   ├── storage/                      # Uploaded files (gitignored ideally)
│   └── src/main/
│       ├── java/com/auca/archive/
│       │   ├── AucaArchiveApplication.java
│       │   ├── config/               # CORS, faculty catalog
│       │   ├── controller/           # REST endpoints
│       │   ├── domain/               # Enums (roles, statuses, categories)
│       │   ├── dto/                  # Request/response records
│       │   ├── exception/            # GlobalExceptionHandler
│       │   ├── model/                # JPA entities
│       │   ├── repository/           # Spring Data repos
│       │   ├── search/               # ES index mapping (optional)
│       │   └── service/              # Business logic
│       └── resources/application.properties
├── frontend/                         # React + Vite UI
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                   # Main app (dashboards, tree, explorer)
│       ├── api.js                    # All HTTP calls
│       ├── studentId.js              # Student ID formats / validation
│       ├── styles.css                # Global styles
│       ├── main.jsx
│       └── components/
│           ├── AdminDashboard.jsx
│           ├── AdminOfficeView.jsx
│           ├── StudentDashboard.jsx
│           ├── StudentFypWizard.jsx
│           ├── BrandLogo.jsx
│           └── Icons.jsx
├── docs/                             # Diagrams + this handoff
├── package.json                      # npm workspaces root
└── README.md
```

---

## 4. How to run locally

### Prerequisites
- Java 17+
- Maven 3.9+
- Node.js 18+ / npm
- PostgreSQL running locally
- Database created: `aucaarchivedb`

### 1) Configure database
Edit `backend/src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/aucaarchivedb
spring.datasource.username=postgres
spring.datasource.password=<your-password>
server.port=8081
archive.search.elasticsearch.enabled=false
```

Create DB if missing:

```sql
CREATE DATABASE aucaarchivedb;
```

### 2) Start backend

```powershell
cd backend
mvn spring-boot:run
```

On first boot, seed services create:

- Archive folder structure (faculties/departments/years/semesters)
- Demo accounts
- Sample archive data (if seed services run)

### 3) Start frontend

```powershell
# from repo root
npm install
npm run dev
```

Or:

```powershell
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173/**

### Port already in use (8081)
If backend fails with “Port 8081 was already in use”:

```powershell
Get-NetTCPConnection -LocalPort 8081 |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

Then start backend again.

---

## 5. Demo accounts (seeded)

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Registrar | `registrar` | `Registrar@123` |
| Examination Officer | `exam.officer` | `Exam@123` |
| Head of Department | `hod` | `Hod@123` |
| Librarian | `librarian` | `Library@123` |
| Student | `20251SEN001` | `Student@123` |

Seeded in `AccountSeedData.java`.

---

## 6. Roles and what each can do

| Role | Main UI | Upload categories | Notes |
|------|---------|-------------------|-------|
| **ADMIN** | System dashboard + Offices | All | User management; no sidebar archive tree; office views on the right |
| **REGISTRAR** | Registrar dashboard | Registration, Reintegration, Application | Archive tree in sidebar; cannot create folders under department |
| **EXAMINATION_OFFICER** | Examination dashboard | Exams | Exam metadata required on upload |
| **HOD** | HOD dashboard | Application | Approvals / department oversight |
| **LIBRARIAN** | Library dashboard | FYP (review focus) | Approves/rejects Final Year Projects |
| **STUDENT** | Student dashboard | Final Year Project only | 5-step FYP wizard; personal storage quota |

### Folder creation rules (staff)
- **Nobody** creates under archive root or faculty
- **Only ADMIN** can create directly under a **department**
- Registrar / Exam / HOD / Librarian create only **below** department (year / semester / user folders)
- Faculty + department folders are **protected** (no rename/move/copy/delete)

Enforced in:
- Frontend: `canStaffCreateArchiveSubfolder()` in `App.jsx`
- Backend: `FolderService.requireStaffCreateTarget()`

### Document visibility rules (FYP)
- Student FYP uploads start as `PENDING`
- Pending/rejected FYP docs are **hidden from shared staff archive**
- Only `APPROVED` FYP docs appear for other offices
- Student can always see their own submissions (Pending / Accepted / Rejected tabs)
- Librarian/Admin can see pending FYP for review

Enforced in `FolderService.isDocumentAccessible()`.

---

## 7. Archive folder structure

Seeded by `ArchiveStructureSeedService`:

```text
AUCA Archive (AUCA)
 └── Faculty (FAC-*)
      └── Department (FAC-*-DEPT-*)
           └── Academic Year (e.g. 2025-2026)
                └── Semester (e.g. 2025/1, 2025/2, 2025/3)
                     └── Student / category folders created on upload
```

Category folder codes:

| Category | Code |
|----------|------|
| Registration Forms | `SREG` |
| Reintegration Forms | `SRIN` |
| Application Documents | `SAPP` |
| Examination Documents | `SEXM` |
| Final Year Project | `SFYP` |

Student IDs:
- Modern: `20251SEN001` (year + semester + dept code + sequence)
- Legacy: 5-digit IDs still supported
- Logic: `StudentIdFormatService` + `frontend/src/studentId.js`

---

## 8. Major features (current state)

### Shared staff UX
- Collapsible **Quick Access** (chevron accordion; preference in localStorage)
- Centered **global search** under dashboard heading (outside header card)
- Search matches folders + documents and shows **full location path**
- Browse Archive via sidebar (header Browse removed for Registrar/Exam/HOD/Librarian)
- Folder explorer: open, upload, rename/move/copy/paste (where allowed), share, download ZIP

### Admin
- User CRUD + privileges (`AdminDashboard.jsx`)
- Sidebar **Offices** list (Registrar, Examination, HOD, Librarian, Student, + new roles)
- Clicking an office opens right-side `AdminOfficeView`:
  - Office accounts
  - Live activity
  - Documents for that office
  - Office-filtered archive tree
- Admin has **no** left sidebar archive tree

### Student Final Year Project (5-step wizard)
Component: `StudentFypWizard.jsx`

1. Student information / project title  
2. Cover / background photo  
3. GitHub + external links  
4. ZIP containing PDF book (max 5 MB)  
5. Review & submit → librarian approval queue  

Student dashboard tabs:
- Pending
- Accepted
- Rejected (shows `reviewNote` feedback)

### Librarian approval
- Pending tasks appear in dashboard approval queue
- Approve → document `APPROVED`, visible in shared archive
- Reject → requires feedback note → student sees it under Rejected

---

## 9. Backend API map

Base URL: `http://localhost:8081`

| Area | Methods | Path |
|------|---------|------|
| Root | GET | `/` |
| Auth | POST | `/api/auth/login` |
| Dashboard | GET | `/api/dashboard` |
| Activity | GET | `/api/activity?scope=&topic=` |
| Approvals | GET | `/api/approvals/pending` |
| Approvals | POST | `/api/approvals/{id}/decision` |
| Documents | GET | `/api/documents?q=&category=` |
| Documents | POST | `/api/documents/upload` (multipart: `metadata`, `file`, optional `coverPhoto`) |
| Documents | POST | `/api/documents/scan` |
| Documents | GET | `/api/documents/{id}` |
| Documents | GET | `/api/documents/{id}/download` |
| Documents | PATCH | `/api/documents/{id}/status` |
| Documents | GET | `/api/documents/archived` |
| Folders | GET | `/api/folders/tree` |
| Folders | GET | `/api/folders/{id}` |
| Folders | POST | `/api/folders/{parentId}/subfolders` |
| Folders | PATCH/POST | rename / move / copy / share / download |
| Students | GET | `/api/students/{studentNumber}/lookup` |
| Students | GET | `/api/students/{studentNumber}` |
| Admin | GET | `/api/admin/dashboard` |
| Admin | GET/POST/PUT | `/api/admin/users`, privileges |

Frontend wrappers live in `frontend/src/api.js`.

---

## 10. Core backend services (where logic lives)

| Service | Responsibility |
|---------|----------------|
| `ArchiveAccessService` | Role → visible folder prefixes, upload categories, activity relevance |
| `ArchiveStructureSeedService` | Seeds faculty/dept/year/semester tree |
| `ArchiveTreeService` | Resolves upload folder + storage path |
| `AcademicTermService` | Academic year / semester naming & codes |
| `FolderService` | Tree, CRUD, share, zip download, access checks |
| `DocumentService` | Upload/search/download/status/archive; FYP ZIP + cover photo |
| `ApprovalService` | Approve/reject with feedback |
| `StudentService` | Student resolve/create + archive lookup |
| `StudentIdFormatService` | Parse/validate student IDs |
| `StudentStorageService` | Student quota checks |
| `DocumentScanService` | PDF AUCA-content checks (staff PDF uploads) |
| `AdminService` | Users/privileges dashboard |
| `AccountSeedData` | Demo accounts |
| `DashboardService` | Role dashboard payload |

---

## 11. Main database entities

| Entity | Table purpose |
|--------|----------------|
| `AccountEntity` | Login accounts, role, privileges, department |
| `StudentEntity` | Student profile (number, name, faculty, department) |
| `FolderEntity` | Archive folders (`name`, `code`, `parentId`) |
| `DocumentEntity` | Files + metadata + status + FYP fields (`githubUrl`, `externalLinks`, `coverPhotoPath`, `reviewNote`) |
| `ApprovalTaskEntity` | Approval queue items |
| `ActivityEntryEntity` | Activity feed |

`spring.jpa.hibernate.ddl-auto=update` auto-updates schema on startup.

---

## 12. Frontend architecture notes

- Almost all UI orchestration is in **`App.jsx`** (large file).
- Role dashboards:
  - Admin → `AdminDashboard` / `AdminOfficeView`
  - Student → `StudentDashboard` + `StudentFypWizard`
  - Other staff → inline dashboard workspace in `App.jsx`
- Styles: single large `styles.css`
- Session helpers and API: `api.js`
- Student ID helpers: `studentId.js`

When adding features, prefer:
1. Backend service + controller first
2. Thin `api.js` wrapper
3. UI in the relevant component (avoid growing `App.jsx` further if possible)

---

## 13. Important business rules checklist

Before changing behavior, verify you still respect:

1. Protected faculty/department folders cannot be renamed/moved/copied/deleted  
2. Only Admin creates folders under department  
3. Role-based upload categories (`ArchiveAccessService.allowedUploadCategories`)  
4. Student can only upload own FYP and only within quota  
5. FYP pending/rejected not shown in shared archive  
6. Librarian rejection requires feedback  
7. CORS allows only `localhost:5173` / `127.0.0.1:5173`  
8. Header-based auth is temporary — do not assume it is production-safe  

---

## 14. Configuration reference

File: `backend/src/main/resources/application.properties`

| Key | Meaning |
|-----|---------|
| `spring.datasource.*` | PostgreSQL connection |
| `server.port` | API port (default 8081) |
| `archive.storage-root` | File storage directory |
| `archive.search.elasticsearch.enabled` | Keep `false` unless ES is running |
| `archive.student.storage-limit-bytes` | Student total quota |
| `archive.student.max-upload-size-bytes` | Per-file student limit (5 MB) |
| `archive.document-scan.enabled` | PDF content checks |
| `archive.encryption.enabled` | File encryption at rest |

Frontend API base override:

```bash
# optional
VITE_API_BASE_URL=http://localhost:8081
```

---

## 15. Diagrams / existing docs

Under `docs/`:

- `AUCA-Smart-Archive-Use-Case.drawio`
- `AUCA-Smart-Archive-Activity.drawio`
- This handoff: `DEVELOPER-HANDOFF.md`

Use these for presentations / thesis diagrams; keep them updated when flows change.

---

## 16. Suggested next work (for the next developer)

High value / unfinished hardening:

1. **Real authentication** (JWT or session cookies) instead of trusting `X-User-Role` headers  
2. Split `App.jsx` into smaller route/page components  
3. Add automated tests for FYP approval visibility rules  
4. Librarian-specific dashboard polish (dedicated FYP review UI beyond generic approval list)  
5. Move secrets out of `application.properties` into env vars / profiles  
6. Gitignore `backend/storage/` and build artifacts cleanly  
7. Optional Elasticsearch enablement for production search  
8. Student cover-photo preview/download endpoint if needed in UI  

---

## 17. Quick “I just cloned this” checklist

1. Install Java 17, Maven, Node, PostgreSQL  
2. Create DB `aucaarchivedb`  
3. Set DB password in `application.properties`  
4. `cd backend && mvn spring-boot:run`  
5. `npm install && npm run dev` (repo root)  
6. Open http://localhost:5173  
7. Login as `admin` / `Admin@123` and `20251SEN001` / `Student@123` to verify both sides  
8. Read this file + skim `ArchiveAccessService`, `FolderService`, `DocumentService`, `App.jsx`  

---

## 18. Contact / ownership context

Project: AUCA Smart Archive (AkizeProject workspace)  
Primary modules to understand first:

1. `ArchiveAccessService` — permissions  
2. `FolderService` — tree + access  
3. `DocumentService` — uploads + FYP  
4. `App.jsx` — UI behavior  
5. `StudentFypWizard.jsx` + `StudentDashboard.jsx` — student flow  
6. `AdminOfficeView.jsx` — admin office navigation  

If something “works in UI but not API”, check headers in `api.js` and role filters in services.  
If backend won’t start, check PostgreSQL + port 8081 first.
