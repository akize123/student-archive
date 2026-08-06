# AUCA Smart Archive

Smart document archive for Adventist University of Central Africa (AUCA).

## Quick start

### Backend (port 8081)
```powershell
cd backend
# Configure PostgreSQL in src/main/resources/application.properties
# Database name: aucaarchivedb
mvn spring-boot:run
```

### Frontend (port 5173)
```powershell
npm install
npm run dev
```

Open **http://localhost:5173/** (not port 8081).

## Demo logins

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Registrar | `registrar` | `Registrar@123` |
| Examination Officer | `exam.officer` | `Exam@123` |
| Librarian | `librarian` | `Library@123` |
| Student | `20251SEN001` | `Student@123` |
| HOD (Software Engineering) | `hod` | `Head@123` |

## Stack

- Backend: Spring Boot 3, Java 17, JPA, PostgreSQL
- Frontend: React 18 + Vite
- Storage: local `backend/storage/`
- Search: database fallback (Elasticsearch optional, currently disabled)

## Project layout

- `backend/` — Spring Boot API
- `frontend/` — React application
- `docs/DEVELOPER-HANDOFF.md` — **full handoff documentation for continuing development**
- `docs/*.drawio` — use-case / activity diagrams

## Full documentation

For architecture, roles, APIs, business rules, and how to continue the project, read:

**[docs/DEVELOPER-HANDOFF.md](docs/DEVELOPER-HANDOFF.md)**
