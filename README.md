# FlightLog

FlightLog is a Python Flask-based web application designed to manage and track flight history. It provides a comprehensive interface for managing cities, airports, airlines, aircraft models, and flight records, with features for automated data fetching and bulk CSV imports.

## Features

- **Flight Management**: Log details including dates, flight numbers, aircraft, airports, terminals, and times (scheduled vs. actual).
- **Database Management**: Comprehensive CRUD (Create, Read, Update, Delete) operations for:
    - Cities (with automatic Timezone and Continent resolution)
    - Airports (with auto-fetch from IATA codes)
    - Airlines
    - Aircraft Models
- **Automation**:
    - Automatic duration calculation based on timezones.
    - Fetch airport details (ICAO, Lat/Lon, City) using `airportsdata`.
    - Sync timezones and continents for cities and airports.
- **Bulk Import**: Support for CSV imports for all major entities.
- **Statistics**: Built-in logic for tracking flight stats (implied by file structure).

## Prerequisites

- Python 3.8+
- pip (Python package manager)

## Installation

1.  **Clone the repository** (or download the source code):
    ```bash
    git clone <repository-url>
    cd FlightLog
    ```

2.  **Install Dependencies**:
    It is recommended to use a virtual environment.
    ```bash
    # Create virtual environment (optional)
    python -m venv venv
    
    # Activate virtual environment
    # Windows:
    venv\Scripts\activate
    # macOS/Linux:
    source venv/bin/activate

    # Install requirements
    pip install -r requirements.txt
    ```

## Usage

1.  **Start the Application**:
    ```bash
    python app.py
    ```
    The application will automatically initialize the SQLite database (`flightlog.db`) using `schema.sql` if it doesn't exist, and run necessary migrations.

2.  **Access the Web Interface**:
    Open your browser and navigate to:
    ```
    http://127.0.0.1:5000
    ```

3.  **Utility Scripts**:
    - `sync_timezones_v2.py`: Run this script to synchronize missing timezones for cities and airports based on ICAO/IATA codes.
      ```bash
      python sync_timezones_v2.py
      ```

## Project Structure

- `app.py`: Main Flask application file containing routes, API endpoints, and business logic.
- `database.py`: Database connection and initialization handling.
- `schema.sql`: SQL schema for creating the database tables.
- `sync_timezones_v2.py`: Utility script to sync timezones and continents.
- `templates/`: HTML templates for the web interface.
- `static/`: Static assets (CSS, JS).
- `requirements.txt`: Python package dependencies.

## Technologies Used

- **Backend**: Python, Flask
- **Database**: SQLite
- **Frontend**: HTML, JavaScript (assumed)
- **External Libraries**: 
    - `airportsdata` (Airport data lookups)
    - `pytz` (Timezone handling)
    - `python-dateutil` (Date parsing)
    - `pycountry` (Country data)

## Notes

- The application uses a local SQLite database `flightlog.db`.
- API Keys: The application may contain placeholders or hardcoded keys for external services (e.g., FlightAware). Ensure you have valid keys if using those specific features.
