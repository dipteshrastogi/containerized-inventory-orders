# Inventory & Order Management System

Production-ready assessment project with a React frontend, FastAPI backend API, PostgreSQL database, and Docker Compose orchestration.

## Features

- Product CRUD with unique SKU validation and non-negative stock.
- Customer create/list/detail/delete with unique email validation.
- Order create/list/detail/delete with backend-calculated totals.
- Automatic stock reduction when orders are created.
- Insufficient inventory protection.
- Responsive dashboard with totals and low-stock count.
- Dockerized frontend, backend, and PostgreSQL services.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: Python, FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- Containers: Docker, Docker Compose

## Project Structure

```text
.
|-- backend
|   |-- app
|   |   |-- config.py
|   |   |-- database.py
|   |   |-- main.py
|   |   |-- models.py
|   |   `-- schemas.py
|   |-- Dockerfile
|   `-- requirements.txt
|-- frontend
|   |-- src
|   |   |-- main.jsx
|   |   `-- styles.css
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- package.json
|-- docker-compose.yml
`-- .env.example
```

## Run Locally With Docker

1. Create a root `.env` file with these local development values:

```env
POSTGRES_DB=inventory_db
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql+psycopg2://inventory_user:change_me@db:5432/inventory_db
FRONTEND_ORIGIN=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8000
```

2. Start all services:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## API Endpoints

### Products

- `POST /products`
- `GET /products`
- `GET /products/{id}`
- `PUT /products/{id}`
- `DELETE /products/{id}`

### Customers

- `POST /customers`
- `GET /customers`
- `GET /customers/{id}`
- `DELETE /customers/{id}`

### Orders

- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `DELETE /orders/{id}`

### Dashboard

- `GET /dashboard`

## Deployment Notes

### Backend on Render or Railway

- Create a PostgreSQL database on the hosting platform.
- Deploy the `backend` directory as a Docker service.
- Set these environment variables:
  - `DATABASE_URL`
  - `FRONTEND_ORIGIN`
- After deployment, confirm `/health` and `/docs` are accessible.

### Frontend on Vercel or Netlify

- Deploy the `frontend` directory.
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_BASE_URL` to the live backend URL.

### Docker Hub Backend Image

```bash
docker build -t your-dockerhub-username/inventory-backend:latest ./backend
docker push your-dockerhub-username/inventory-backend:latest
```

## Submission Checklist

- GitHub repository link: `TODO`
- Docker Hub backend image link: `TODO`
- Live frontend deployment URL: `TODO`
- Live backend API URL: `TODO`
