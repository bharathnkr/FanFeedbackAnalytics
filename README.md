# Fan Feedback Analytics Dashboard

A web-based analytics dashboard for visualizing and exploring fan feedback data. This application provides insights into fan feedback categories, sentiment analysis, and trends over time.

## Features

- **Dashboard Overview**: Visualize key metrics and trends in fan feedback
- **Interactive Charts**: Category distribution, sentiment analysis, and daily feedback volume
- **Filtering Capabilities**: Filter by category and date range
- **Recent Feedback**: Browse and search through recent feedback entries
- **Feedback Details**: View detailed information about individual feedback items

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: Bootstrap 5, Chart.js
- **Data Source**: Excel file with fan feedback data

## Project Structure

```
FanFeedbackAnalytics/
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── static/                 # Static assets
│   ├── css/
│   │   └── style.css       # Custom CSS styles
│   ├── js/
│   │   ├── dashboard.js    # Dashboard page functionality
│   │   └── recent-feedback.js # Recent feedback page functionality
│   └── img/                # Image assets
└── templates/              # HTML templates
    ├── dashboard.html      # Main dashboard page
    ├── recent-feedback.html # Recent feedback listing page
    └── feedback-details.html # Individual feedback details page
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Ensure the Excel data file is available at the path specified in app.py

## Usage

1. Run the application:
   ```
   python app.py
   ```
2. Open a web browser and navigate to `http://localhost:5000`

## Data Source

The application uses an Excel file located at `C:/Users/BReddy/Downloads/2025_06_03 Fan Feedback Sample Dataset.xlsx`. Make sure this file exists or update the path in app.py.

## Customization

- **Color Theme**: The primary color theme is orange (#FF4500) and can be modified in the CSS and JavaScript files
- **Data Source**: To change the data source, update the file path in app.py
- **Chart Types**: Chart configurations can be modified in dashboard.js

## License

This project is for internal use only.
