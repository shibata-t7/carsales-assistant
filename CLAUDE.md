# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Toyota Sales AI Assistant - a Flask-based web application that provides AI-powered sales support for Toyota car dealerships. The application integrates with the Dify AI Platform to generate vehicle recommendations, answer sales questions, and create sales conversations.

## Technology Stack

- **Backend**: Python 3.9+ with Flask 3.0.0
- **Database**: SQLite with SQLAlchemy 2.0.27 ORM
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no build process)
- **Authentication**: Flask-Login session management with role-based access control
- **External API**: Dify AI Platform integration

## Common Development Commands

### Setup and Initialization
```bash
# Install dependencies
pip install -r app/requirements.txt

# Initialize database (run from app/ directory)
cd app
python -c "from app import app, db; app.app_context().push(); db.create_all()"

# Run development server
python app.py
```

### Testing
```bash
# Test API endpoints using sample scripts
python doc/dify_recommendreq_sample.py    # Proposal generation
python doc/dify_qa_sample.py              # Q&A functionality  
python doc/dify_conversation_sample.py    # Sales conversation
```

### Production Deployment
```bash
# Create systemd service (Linux)
sudo systemctl start toyota-sales
sudo systemctl enable toyota-sales

# Check service logs
sudo journalctl -u toyota-sales -f
```

## Architecture

### Application Structure
- **app/app.py** (706 lines): Main Flask application with all routes, models, and business logic
- **app/templates/index.html**: Single-page application frontend with tabbed navigation
- **app/static/**: CSS, JavaScript, and image assets (no build process required)
- **app/instance/**: SQLite database storage

### Database Models
- **User**: Authentication with role-based access control
  - Admin user: admin/admin (can modify API settings)
  - General user: demo/demo (uses admin's API settings)
- **ApiSettings**: External API configuration (managed by admin, shared with general users)
- **History**: Sales proposals and interaction history (per user)

### Key API Endpoints
- **Authentication**: `/login`, `/logout`
- **API Management**: `/api/settings` (admin: modify, user: read-only), `/api/test-connection` (admin only)
- **AI Features**: `/api/generate-proposal`, `/api/ask-question`, `/api/generate-salestalk`
- **Data**: `/api/save-history`, `/api/get-history`, `/api/export-history`

## External Integration

The application integrates with Dify AI Platform at `http://54.92.0.96/v1` with specific API keys for:
- Vehicle proposal generation
- Sales Q&A functionality
- Role-play sales conversation generation

API keys are stored in the database and configured per user through the settings interface.

## Development Notes

### Authentication
- **Admin user**: username `admin`, password `admin` (can modify API settings)
- **General user**: username `demo`, password `demo` (uses admin's API settings)
- Passwords are stored in plain text (development only - needs hashing for production)
- Role-based access control implemented with `@admin_required` decorator

### Frontend Architecture
- Single-page application with JavaScript tab management
- Server-sent events (SSE) for streaming AI responses
- Form-based customer input with detailed vehicle recommendations
- History management with search and CSV export functionality

### Database
- SQLite auto-initializes on first run
- All database operations handled through SQLAlchemy ORM
- History table stores JSON data for complex proposal structures

### Security Considerations
- Application is in prototype/PoC state
- Production deployment requires password hashing, HTTPS, and security hardening
- API keys are visible in HTML templates and need environment variable management

## File Locations

- Main application: `app/app.py`
- Frontend template: `app/templates/index.html`
- Dependencies: `app/requirements.txt`
- Documentation: `doc/README.md` (Japanese)
- Test scripts: `doc/dify_*_sample.py`