# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Toyota Sales AI Assistant - a Flask-based web application that helps car sales staff generate vehicle proposals, sales talk, and answer customer questions using AI. The application integrates with the Dify AI platform and supports Windows 11 voice recognition for efficient customer information input.

## Architecture

- **Backend**: Flask 3.0.0 Python web application (app/app.py)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (static/ directory)
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: Flask-Login with role-based access control
- **External API**: Dify AI Platform integration for AI features
- **Voice Input**: Windows 11 voice recognition (Win+H) integration

## Key Components

### Database Models (app/app.py:34-64)
- **User**: Authentication with role-based access (admin/user)
- **History**: Sales interaction records
- **ApiSettings**: Dify API configuration per user

### API Endpoints
- Authentication: `/login`, `/logout`
- API Configuration: `/api/settings` (GET/POST), `/api/test-connection`
- AI Features: `/api/generate-proposal`, `/api/ask-question`, `/api/generate-salestalk`, `/api/format-text`
- History: `/api/get-history`, `/api/save-history`, `/api/export-history`

### Permission System
- **Admin users**: Can configure API settings, access all features
- **Regular users**: Use admin-configured API settings, access AI features
- Permission decorator: `@admin_required` (app/app.py:67-73)

## Development Commands

### Setup and Run
```bash
# Install dependencies
pip install -r app/requirements.txt

# Initialize database
cd app
python -c "from app import app, db; app.app_context().push(); db.create_all()"

# Run development server
python app.py
```

### Default Users
- **Demo user**: username=demo, password=demo (regular user)
- **Admin user**: username=admin, password=admin (admin user)

### Testing API Integration
Use the sample scripts in `doc/` directory:
- `dify_recommendreq_sample.py` - Proposal generation API
- `dify_qa_sample.py` - Q&A API
- `dify_conversation_sample.py` - Conversation API

## File Structure

```
app/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── instance/           # SQLite database files
├── static/            # CSS, JS, images
└── templates/         # HTML templates

design/                # Frontend design prototypes
doc/                   # Documentation and API samples
```

## Important Notes

- The app runs on port 5001 by default
- API settings are shared from admin to regular users via `get_active_api_settings()` (app/app.py:76-93)
- Text formatting feature designed for Windows 11 voice input integration
- All API calls to Dify platform use streaming responses with JSON parsing
- Database uses plain text passwords (suitable for PoC only)

## Common Issues

- **API Connection Errors**: Check API endpoint URL and keys in settings
- **Database Initialization**: Ensure `instance/` directory exists and has write permissions
- **Voice Input**: Windows 11 voice recognition must be enabled for text formatting feature