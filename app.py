import os
import json
import logging
import random
from datetime import datetime, timedelta
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for, flash, g
from flask_cors import CORS
from functools import wraps
from google.cloud import bigquery
from google.oauth2 import service_account

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('fan_feedback.log', mode='w')  # 'w' mode to start with a fresh log file
    ]
)

# Add a separate logger for API responses
api_logger = logging.getLogger('api_responses')
api_logger.setLevel(logging.DEBUG)
api_file_handler = logging.FileHandler('api_responses.log', mode='w')
api_file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
api_logger.addHandler(api_file_handler)
api_logger.propagate = False  # Prevent duplicate logging

# Initialize Flask app
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)  # Enable CORS for all routes

# Configure Flask session
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fan-feedback-analytics-secret-key-2025')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)  # Session expires after 8 hours

# Data Configuration
# BigQuery Configuration
PROJECT_ID = 'mets-p-cc076-business-analytic'
# Fix path format for Windows - use raw string and backslashes
CREDENTIALS_PATH = r'C:\Users\breddy\AppData\Roaming\gcloud\application_default_credentials.json'
DATASET_ID = 'wheelhouse_views'
TABLE_ID = 'fanFeedback_form_responses'

# Flag to control whether to use BigQuery or Excel
USE_BIGQUERY = True  # Set to False to use Excel exclusively

# Keep Excel file path for fallback/reference
DATA_FILE = r"C:\Users\BReddy\Downloads\Microsoft.RemoteDesktop_8wekyb3d8bbwe!App\TemporaryRDStorageFiles-{86740C75-1613-445F-9C27-874E93435744}\2025_06_03 Fan Feedback Sample Dataset.xlsx"

# Initialize BigQuery client
def get_bigquery_client():
    """Initialize and return a BigQuery client using service account credentials with fallback to application default"""
    try:
        # First try with service account credentials file
        if os.path.exists(CREDENTIALS_PATH):
            logging.info(f"Attempting to use credentials file: {CREDENTIALS_PATH}")
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    CREDENTIALS_PATH,
                    scopes=["https://www.googleapis.com/auth/bigquery"],
                )
                client = bigquery.Client(credentials=credentials, project=PROJECT_ID)
                logging.info(f"Successfully initialized BigQuery client with service account for project {PROJECT_ID}")
                return client
            except Exception as cred_error:
                logging.error(f"Error using service account credentials: {str(cred_error)}")
                # Continue to fallback method
        
        # Fallback to application default credentials
        logging.info("Trying application default credentials...")
        try:
            client = bigquery.Client(project=PROJECT_ID)
            logging.info(f"Successfully initialized BigQuery client with application default credentials for project {PROJECT_ID}")
            return client
        except Exception as adc_error:
            logging.error(f"Error using application default credentials: {str(adc_error)}")
            
        # If we get here, both authentication methods failed
        logging.error("All authentication methods failed")
        return None
    except Exception as e:
        logging.error(f"Unexpected error initializing BigQuery client: {str(e)}")
        return None
        
def get_table_schema():
    """Get the schema of the BigQuery table"""
    try:
        client = get_bigquery_client()
        if not client:
            logging.error("Failed to initialize BigQuery client")
            return None
            
        table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
        table = client.get_table(table_ref)
        
        # Log the schema for debugging
        schema_fields = [field.name for field in table.schema]
        logging.info(f"Table schema fields: {schema_fields}")
        
        return table.schema
    except Exception as e:
        logging.error(f"Error getting table schema: {str(e)}")
        return None

# User authentication configuration
# For demo purposes, we'll use a simple dictionary to store users
# In a real application, this would be stored in a database with hashed passwords
USERS = {
    "admin@mets.com": {"password": "admin123", "role": "super_user", "name": "Admin User", "category": None},
    "travel@mets.com": {"password": "travel123", "role": "category_user", "name": "Travel Manager", "category": "Travel"},
    "food@mets.com": {"password": "food123", "role": "category_user", "name": "F&B Manager", "category": "Food & Beverage"},
    "merch@mets.com": {"password": "merch123", "role": "category_user", "name": "Merchandise Manager", "category": "Merchandise"},
    "tickets@mets.com": {"password": "tickets123", "role": "category_user", "name": "Ticket Manager", "category": "Tickets"},
    "game@mets.com": {"password": "game123", "role": "category_user", "name": "Game Experience Manager", "category": "Game Experience"},
    "app@mets.com": {"password": "app123", "role": "category_user", "name": "App Manager", "category": "Ballpark App"},
    "staff@mets.com": {"password": "staff123", "role": "category_user", "name": "Staff Manager", "category": "Staff & Customer Service"},
    "other@mets.com": {"password": "other123", "role": "category_user", "name": "Other Manager", "category": "Other"}
}

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_email' not in session:
            flash('Please log in to access this page', 'danger')
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# API login required decorator - returns JSON instead of redirecting
def api_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_email' not in session:
            return jsonify({'error': 'Authentication required', 'code': 'AUTH_REQUIRED'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Category access control - filter feedback data based on user role and category
def filter_by_user_access(df):
    """Filter feedback data based on user role and category"""
    if 'user_email' not in session:
        return df  # Return all data if not logged in (this shouldn't happen due to @login_required)
    
    user_email = session['user_email']
    user = USERS.get(user_email)
    
    if user['role'] == 'super_user':
        return df  # Super users can see all data
    
    # Category users can only see feedback for their category
    if user['role'] == 'category_user' and user['category']:
        # Check which column name exists in the dataframe
        if 'Category' in df.columns:
            category_column = 'Category'
        elif 'Main Category' in df.columns:
            category_column = 'Main Category'
        else:
            # If neither column exists, return empty dataframe
            logging.error("Neither 'Category' nor 'Main Category' column found in dataframe")
            return pd.DataFrame()
        
        return df[df[category_column] == user['category']].copy()
    
    return pd.DataFrame()  # Return empty dataframe if no matching access

# Cache for loaded data to avoid repeated expensive operations
_data_cache = None
_last_cache_time = None
_CACHE_EXPIRY_SECONDS = 60  # Cache expires after 1 minute

# Helper function to load data from BigQuery table or Excel fallback
def load_data(force_refresh=False):
    """Load data from BigQuery table with fallback to Excel, with caching"""
    global _data_cache, _last_cache_time
    
    # Check if we can use cached data
    current_time = datetime.now()
    if not force_refresh and _data_cache is not None and _last_cache_time is not None:
        # Use cache if it's less than the expiry time
        if (current_time - _last_cache_time).total_seconds() < _CACHE_EXPIRY_SECONDS:
            return _data_cache.copy()  # Return a copy to prevent modification of cache
    
    # Need to load fresh data
    if USE_BIGQUERY:
        try:
            # Initialize BigQuery client
            client = get_bigquery_client()
            if not client:
                logging.error("Failed to initialize BigQuery client")
                raise Exception("Failed to initialize BigQuery client")
                
            # Construct the query to fetch data from the BigQuery table
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            # Use created_date in the query, order by DESC, and apply LIMIT 1000
            query = f"SELECT * FROM `{table_ref}` ORDER BY created_date DESC LIMIT 1000"
            logging.info(f"Attempting to load data from BigQuery table: {table_ref} with ordering by created_date DESC")
            
            # Execute the query and convert results to a DataFrame
            df = client.query(query).to_dataframe()
            logging.info(f"Successfully loaded data with {len(df)} records from BigQuery")
            
            # Handle column name standardization - only map essential columns
            column_mapping = {
                'contact_user': 'Contact User',
                'status': 'Status',
                'category': 'Main Category',
                'sub_category': 'Sub Category',
                'feedback': 'Feedback',
                'customer_name': 'Customer Name',
                'created_date': 'Date Submitted'
            }
            
            # Rename columns based on the mapping - more efficient approach
            rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns and v not in df.columns}
            if rename_dict:
                df.rename(columns=rename_dict, inplace=True)
            
            # Process the DataFrame to ensure required columns exist
            df = ensure_required_columns(df)
            
            # Update cache
            _data_cache = df
            _last_cache_time = current_time
            
            return df
            
        except Exception as e:
            logging.error(f"Error loading data from BigQuery: {str(e)}")
            # Fall back to Excel
            df = load_excel_data()
            
            # Update cache
            _data_cache = df
            _last_cache_time = current_time
            
            return df
    else:
        # BigQuery is disabled, use Excel directly
        df = load_excel_data()
        
        # Update cache
        _data_cache = df
        _last_cache_time = current_time
        
        return df

# Helper function to load data from Excel
def load_excel_data():
    """Load data from Excel file"""
    try:
        logging.warning(f"Attempting to fall back to Excel file: {DATA_FILE}")
        # Check if Excel file exists
        if not os.path.exists(DATA_FILE):
            logging.error(f"Excel file not found: {DATA_FILE}")
            return create_mock_data()
            
        # Load Excel file
        df = pd.read_excel(DATA_FILE)
        logging.info(f"Successfully loaded fallback data with {len(df)} records from Excel")
        
        # Process the DataFrame to ensure required columns exist
        df = ensure_required_columns(df)
        return df
    except Exception as e:
        logging.error(f"Error loading Excel data: {str(e)}")
        return create_mock_data()

# Helper function to create mock data when all else fails
def create_mock_data():
    """Create mock data when no data source is available"""
    logging.warning("Creating mock data as fallback")
    # Create a small dataset with required columns
    data = {
        'ID': list(range(1, 11)),
        'First Name': ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah'],
        'Last Name': ['Smith', 'Doe', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'],
        'Email': ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com', 'charlie@example.com',
                 'diana@example.com', 'edward@example.com', 'fiona@example.com', 'george@example.com', 'hannah@example.com'],
        'Main Category': ['Travel', 'Food & Beverage', 'Merchandise', 'Tickets', 'Game Experience',
                         'Travel', 'Food & Beverage', 'Merchandise', 'Tickets', 'Game Experience'],
        'Sub Category': ['Parking', 'Concessions', 'Apparel', 'Season Tickets', 'Seating',
                        'Transportation', 'Food Quality', 'Souvenirs', 'Single Game', 'Staff'],
        'Feedback': ['Parking was difficult to find', 'Food was cold', 'T-shirt quality was poor', 'Easy to purchase',
                    'Seats were uncomfortable', 'Shuttle service was excellent', 'Great hot dogs', 'Overpriced items',
                    'Ticket transfer was confusing', 'Staff was very helpful'],
        'Date Submitted': [(datetime.now() - timedelta(days=i)) for i in range(10)],
        'Contact User': ['Yes', 'No', 'Yes', 'No', 'Yes', 'No', 'Yes', 'No', 'Yes', 'No'],
        'Status': ['Not Started', '', 'In Progress', '', 'Completed', '', 'Not Started', '', 'In Progress', ''],
    }
    df = pd.DataFrame(data)
    logging.info("Successfully created mock data with 10 records")
    return df

# Helper function to ensure required columns exist in the DataFrame
def ensure_required_columns(df):
    """Ensure all required columns exist in the DataFrame"""
    # Only add missing columns that are actually needed for the application
    # Skip random data generation for performance
    
    # Create a list of columns to check and add if missing
    missing_columns = {}
    
    # Ensure ID column exists (critical for record identification)
    if 'ID' not in df.columns:
        missing_columns['ID'] = range(1, len(df) + 1)
    
    # Ensure Main Category exists (needed for filtering)
    if 'Main Category' not in df.columns:
        if 'category' in df.columns:
            missing_columns['Main Category'] = df['category']
        elif 'Category' in df.columns:
            missing_columns['Main Category'] = df['Category']
        else:
            missing_columns['Main Category'] = ''
    
    # Handle customer name fields - only if Customer Name exists
    if 'Customer Name' in df.columns and 'First Name' not in df.columns and 'Last Name' not in df.columns:
        try:
            # Split names only once
            name_parts = df['Customer Name'].str.split(' ', n=1, expand=True)
            missing_columns['First Name'] = name_parts[0]
            # Handle last name if it exists
            if 1 in name_parts.columns:
                missing_columns['Last Name'] = name_parts[1].fillna('')
            else:
                missing_columns['Last Name'] = ''
        except Exception as e:
            logging.warning(f"Error splitting Customer Name: {str(e)}")
            missing_columns['First Name'] = df['Customer Name']
            missing_columns['Last Name'] = ''
    
    # Ensure date column exists with a standard name
    date_columns = ['Date Submitted', 'created_date', 'Date']
    if not any(col in df.columns for col in date_columns):
        # Add current date if no date column exists
        missing_columns['Date Submitted'] = pd.Timestamp.now()
    
    # Add minimal required columns with empty values
    for col in ['Contact User', 'Status', 'Sub Category', 'First Name', 'Last Name']:
        if col not in df.columns and col not in missing_columns:
            missing_columns[col] = ''
    
    # Add all missing columns at once (more efficient)
    if missing_columns:
        for col, value in missing_columns.items():
            df[col] = value
    
    return df

# Helper function to calculate date range based on filter
def get_date_range(date_range, start_date=None, end_date=None):
    """Get start and end dates based on the selected date range or custom dates"""
    today = datetime.now().date()
    
    if date_range == 'custom' and start_date and end_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            return start.isoformat(), end.isoformat()
        except ValueError as e:
            logging.error(f"Error parsing custom dates: {e}")
            # Fall back to last 30 days if date parsing fails
            start = today - timedelta(days=30)
            return start.isoformat(), today.isoformat()
    
    if date_range == 'today':
        return today.isoformat(), today.isoformat()
    elif date_range == 'yesterday':
        yesterday = today - timedelta(days=1)
        return yesterday.isoformat(), yesterday.isoformat()
    elif date_range == 'last7':
        start = today - timedelta(days=7)
        return start.isoformat(), today.isoformat()
    else:  # default to last 30 days
        start = today - timedelta(days=30)
        return start.isoformat(), today.isoformat()

# Set up browser configuration
def open_browser():
    import webbrowser
    edge_path = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    webbrowser.register('edge', None, webbrowser.BackgroundBrowser(edge_path))
    webbrowser.get('edge').open('http://localhost:5000')

@app.route('/')
def index():
    if 'user_email' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Check if user is already logged in
    if 'user_email' in session:
        return redirect(url_for('dashboard'))
    
    # Handle login form submission
    if request.method == 'POST':
        email = request.form.get('email', '').lower()
        password = request.form.get('password', '')
        
        # Check if email exists in users dictionary
        if email in USERS and USERS[email]['password'] == password:
            # Store user info in session
            session['user_email'] = email
            session['user_name'] = USERS[email]['name']
            session['user_role'] = USERS[email]['role']
            session['user_category'] = USERS[email]['category']
            
            # Redirect to dashboard or requested next page
            next_page = request.args.get('next')
            if next_page and next_page.startswith('/'):
                return redirect(next_page)
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password', 'danger')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    # Clear session data
    session.clear()
    flash('You have been logged out', 'success')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    logging.info("Dashboard page requested")
    # Get user info
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('user_role'),
        'category': session.get('user_category'),
        'email': session.get('user_email')
    }
    
    return render_template('dashboard.html', user=user_info)

@app.route('/api/dashboard-data')
@app.route('/get_dashboard_data')  # Adding route alias for frontend compatibility
@api_login_required
def get_dashboard_data():
    """Get data needed for the main dashboard"""
    try:
        # Get filter parameters
        date_range = request.args.get('date_range', 'last30')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        category = request.args.get('category', 'all')
        
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Apply filters
        if category != 'all':
            df = df[df['Main Category'] == category]
        
        # Get date range
        start_date_iso, end_date_iso = get_date_range(date_range, start_date, end_date)
        
        # Convert ISO format dates to datetime objects for filtering
        start_date_obj = datetime.fromisoformat(start_date_iso)
        end_date_obj = datetime.fromisoformat(end_date_iso)
        
        # Use Date Submitted for filtering if available, otherwise fall back to Date of Birth
        date_column = 'Date Submitted' if 'Date Submitted' in df.columns else 'Date of Birth'
        if date_column in df.columns:
            df['Date'] = pd.to_datetime(df[date_column])
            df = df[(df['Date'] >= start_date_obj) & (df['Date'] <= end_date_obj)]
        
        # Calculate metrics
        total_feedback = len(df)
        
        # For sentiment, we'll create a simple sentiment analysis based on feedback length
        # This is just a placeholder - in a real app, you'd use NLP for sentiment analysis
        if 'Feedback' in df.columns:
            df['Sentiment'] = df['Feedback'].apply(lambda x: 
                                                 'Positive' if len(str(x)) > 100 else 
                                                 ('Negative' if len(str(x)) < 50 else 'Neutral'))
            sentiment_counts = df['Sentiment'].value_counts().to_dict()
            
            # Calculate sentiment percentages
            sentiment_distribution = {}
            for sentiment, count in sentiment_counts.items():
                sentiment_distribution[sentiment] = {
                    'count': count,
                    'percentage': round((count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                }
        else:
            sentiment_counts = {}
            sentiment_distribution = {}
        
        # Contact User analytics
        contact_user_stats = {}
        if 'Contact User' in df.columns:
            contact_counts = df['Contact User'].value_counts().to_dict()
            contact_yes_count = contact_counts.get('Yes', 0)
            contact_no_count = contact_counts.get('No', 0)
            
            contact_user_stats = {
                'Yes': {
                    'count': contact_yes_count,
                    'percentage': round((contact_yes_count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                },
                'No': {
                    'count': contact_no_count,
                    'percentage': round((contact_no_count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                }
            }
        
        # Resolution status analytics
        resolution_stats = {}
        if 'Contact User' in df.columns and 'Status' in df.columns:
            contact_yes_df = df[df['Contact User'] == 'Yes']
            total_contact_yes = len(contact_yes_df)
            
            status_counts = contact_yes_df['Status'].value_counts().to_dict()
            for status, count in status_counts.items():
                if status:  # Skip empty status values
                    resolution_stats[status] = {
                        'count': count,
                        'percentage': round((count / total_contact_yes) * 100, 1) if total_contact_yes > 0 else 0,
                        'percentage_of_total': round((count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                    }
        
        # Category distribution
        category_counts = df['Main Category'].value_counts().to_dict() if 'Main Category' in df.columns else {}
        
        # Daily feedback count
        if 'Date' in df.columns:
            daily_counts = df.groupby(df['Date'].dt.date).size().reset_index()
            daily_counts.columns = ['Date', 'Count']
            daily_counts['Date'] = daily_counts['Date'].astype(str)
            daily_feedback = daily_counts.to_dict('records')
        else:
            daily_feedback = []
        
        # Prepare response
        response = {
            'total_feedback': total_feedback,
            'sentiment_distribution': sentiment_distribution,
            'sentiment_counts': sentiment_counts,  # Keep original format for backward compatibility
            'category_distribution': category_counts,
            'daily_feedback': daily_feedback,
            'contact_user_stats': contact_user_stats,
            'resolution_stats': resolution_stats,
            'date_range': {
                'start': start_date_iso,
                'end': end_date_iso
            }
        }
        
        # Apply user-based filtering
        df = filter_by_user_access(df)
        
        return jsonify(response)
    
    except Exception as e:
        logging.error(f"Error getting dashboard data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback-summary')
@app.route('/get_feedback_summary')  # Adding route alias for frontend compatibility
@api_login_required
def get_feedback_summary():
    """Get summary metrics for feedback"""
    try:
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Calculate metrics
        total_feedback = len(df)
        
        # Count unique categories
        category_count = df['Main Category'].nunique() if 'Main Category' in df.columns else 0
        
        # Calculate sentiment distribution
        sentiment_distribution = {}
        if 'Feedback' in df.columns:
            df['Sentiment'] = df['Feedback'].apply(lambda x: 
                                                 'Positive' if len(str(x)) > 100 else 
                                                 ('Negative' if len(str(x)) < 50 else 'Neutral'))
            sentiment_counts = df['Sentiment'].value_counts().to_dict()
            
            # Calculate sentiment percentages
            for sentiment, count in sentiment_counts.items():
                sentiment_distribution[sentiment] = {
                    'count': count,
                    'percentage': round((count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                }
        
        # Contact User analytics
        contact_user_stats = {}
        if 'Contact User' in df.columns:
            contact_counts = df['Contact User'].value_counts().to_dict()
            contact_yes_count = contact_counts.get('Yes', 0)
            contact_no_count = contact_counts.get('No', 0)
            
            contact_user_stats = {
                'Yes': {
                    'count': contact_yes_count,
                    'percentage': round((contact_yes_count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                },
                'No': {
                    'count': contact_no_count,
                    'percentage': round((contact_no_count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                }
            }
        
        # Resolution status analytics
        resolution_stats = {}
        if 'Contact User' in df.columns and 'Status' in df.columns:
            contact_yes_df = df[df['Contact User'] == 'Yes']
            total_contact_yes = len(contact_yes_df)
            
            status_counts = contact_yes_df['Status'].value_counts().to_dict()
            for status, count in status_counts.items():
                resolution_stats[status] = {
                    'count': count,
                    'percentage': round((count / total_contact_yes) * 100, 1) if total_contact_yes > 0 else 0,
                    'percentage_of_total': round((count / total_feedback) * 100, 1) if total_feedback > 0 else 0
                }
        
        # Calculate average sentiment (placeholder)
        avg_sentiment = None
        if 'Feedback' in df.columns:
            # This is a very simple placeholder for sentiment analysis
            # In a real app, you'd use NLP for proper sentiment analysis
            df['Sentiment Score'] = df['Feedback'].apply(lambda x: 
                                                      len(str(x)) / 100 if len(str(x)) > 0 else 0)
            avg_sentiment = df['Sentiment Score'].mean()
        
        # Prepare response
        response = {
            'total_feedback': total_feedback,
            'category_count': category_count,
            'avg_sentiment': avg_sentiment,
            'sentiment_distribution': sentiment_distribution,
            'contact_user_stats': contact_user_stats,
            'resolution_stats': resolution_stats
        }
        
        return jsonify(response)
    
    except Exception as e:
        logging.error(f"Error getting feedback summary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/categories')
@app.route('/get_categories')  # Adding route alias for frontend compatibility
@api_login_required
def get_categories():
    """Get a list of all categories"""
    try:
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Get unique categories
        categories = df['Main Category'].unique().tolist() if 'Main Category' in df.columns else []
        
        return jsonify(categories)
    
    except Exception as e:
        logging.error(f"Error getting categories: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recent-feedback')
@app.route('/get_recent_feedback')  # Adding route alias for frontend compatibility
@api_login_required
def get_recent_feedback():
    """Get list of recent feedback with pagination"""
    try:
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 50))
        category = request.args.get('category', 'all')
        
        # Load data - this already handles column standardization and sorting by created_date DESC
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Identify date column for later use
        date_col = next((col for col in ['Date Submitted', 'created_date', 'Date'] 
                       if col in df.columns), None)
        
        # Apply category filter if specified
        if category and category.lower() != 'all' and 'Main Category' in df.columns:
            df = df[df['Main Category'] == category]
        
        # Calculate total records and pages after filtering but before pagination
        total_records = len(df)
        total_pages = max(1, (total_records + page_size - 1) // page_size)
        
        # Ensure page is within valid range
        page = min(max(1, page), total_pages)
        
        # Calculate offset
        offset = (page - 1) * page_size
        
        # Get paginated data - create a copy to avoid SettingWithCopyWarning
        paginated_df = df.iloc[offset:offset+page_size].copy() if not df.empty else pd.DataFrame()
        
        # Ensure minimal required columns exist with default values
        # Only add columns that are actually needed
        required_columns = ['First Name', 'Last Name', 'Main Category', 'Sub Category', 'Status']
        for col in required_columns:
            if col not in paginated_df.columns:
                paginated_df[col] = '-'
        
        # Make sure date column exists
        if date_col and date_col not in paginated_df.columns:
            paginated_df[date_col] = None
        
        # Replace NaN values with None for JSON serialization
        paginated_df = paginated_df.where(pd.notna(paginated_df), None)
        
        # Convert to list of dictionaries
        feedback_list = paginated_df.to_dict('records')
        
        # Convert datetime objects to strings for JSON serialization
        for item in feedback_list:
            for key, value in item.items():
                if isinstance(value, pd.Timestamp):
                    item[key] = value.isoformat()
        
        # Prepare response
        response = {
            'feedback': feedback_list,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_records': total_records,
                'total_pages': total_pages
            }
        }
        
        return jsonify(response)
    
    except Exception as e:
        logging.error(f"Error getting recent feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback/<int:feedback_id>')
@app.route('/get_feedback_details/<int:feedback_id>')  # Adding route alias for frontend compatibility
@api_login_required
def get_feedback_details(feedback_id):
    """Get details for a specific feedback item"""
    try:
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Since our dataset doesn't have an ID column, we'll use the index
        # Add an ID column based on the index
        df['ID'] = range(1, len(df) + 1)
        feedback = df[df['ID'] == feedback_id]
        
        if len(feedback) == 0:
            return jsonify({'error': 'Feedback not found'}), 404
        
        # Get the first row as a Series
        feedback_item = feedback.iloc[0]
        
        # Replace NaN values with None for JSON serialization
        feedback_item = feedback_item.where(pd.notna(feedback_item), None)
        
        # Convert to dictionary
        feedback_dict = feedback_item.to_dict()
        
        # Convert any datetime objects to strings for JSON serialization
        for key, value in feedback_dict.items():
            if isinstance(value, pd.Timestamp):
                feedback_dict[key] = value.isoformat()
        
        return jsonify(feedback_dict)
    
    except Exception as e:
        logging.error(f"Error getting feedback details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/feedback_details/<int:feedback_id>')
@login_required
def feedback_details_page(feedback_id):
    """Render the feedback details page"""
    # Get user info
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('user_role'),
        'category': session.get('user_category'),
        'email': session.get('user_email')
    }
    
    return render_template('feedback_details.html', feedback_id=feedback_id, user=user_info)

@app.route('/recent-feedback')
@login_required
def recent_feedback_page():
    """Render the recent feedback page"""
    # Get user info
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('user_role'),
        'category': session.get('user_category'),
        'email': session.get('user_email')
    }
    
    return render_template('recent-feedback.html', user=user_info)

@app.route('/edit-feedback/<int:feedback_id>')
@login_required
def edit_feedback_page(feedback_id):
    """Render the edit feedback page"""
    # Get user info
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('user_role'),
        'category': session.get('user_category'),
        'email': session.get('user_email')
    }
    
    return render_template('edit-feedback.html', feedback_id=feedback_id, user=user_info)

@app.route('/api/feedback/<int:feedback_id>/edit')
@login_required
def get_feedback_details_for_edit(feedback_id):
    """Get details for a specific feedback item for editing"""
    try:
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        df = filter_by_user_access(df)
        
        # Find the feedback item by ID
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)
            
        # Convert ID to integer for comparison
        feedback_id = int(feedback_id)
        feedback_item = df[df['ID'] == feedback_id]
        
        if len(feedback_item) == 0:
            return jsonify({'error': 'Feedback not found'}), 404
        
        # Convert the first (and only) row to a dictionary
        feedback_dict = feedback_item.iloc[0].to_dict()
        
        # Convert any datetime objects to strings for JSON serialization
        for key, value in feedback_dict.items():
            if isinstance(value, pd.Timestamp):
                feedback_dict[key] = value.isoformat()
        
        # Check for Last Updated fields
        if 'Last Updated By' not in feedback_dict:
            feedback_dict['Last Updated By'] = None
        if 'Last Updated Time' not in feedback_dict:
            feedback_dict['Last Updated Time'] = None
            
        return jsonify(feedback_dict)
    
    except Exception as e:
        logging.error(f"Error getting feedback details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback/update', methods=['POST'])
@app.route('/update_feedback', methods=['POST'])  # Adding route alias for frontend compatibility
@api_login_required
def update_feedback():
    """Update feedback data"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Required fields
        required_fields = ['id', 'category', 'contact_user', 'status', 'sentiment', 'updated_by', 'updated_time']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        filtered_df = filter_by_user_access(df)
        
        # Find the feedback item by ID
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)
            
        # Convert ID to integer for comparison
        feedback_id = int(data['id'])
        index = df[df['ID'] == feedback_id].index
        
        # Check if the user has access to this feedback item
        filtered_index = filtered_df[filtered_df['ID'] == feedback_id].index
        if len(filtered_index) == 0:
            return jsonify({'success': False, 'message': 'Access denied or feedback not found'}), 403
            
        if len(index) == 0:
            return jsonify({'success': False, 'message': 'Feedback not found'}), 404
        
        # Update the data
        df.loc[index, 'Main Category'] = data['category']
        df.loc[index, 'Sub Category'] = data['sub_category']
        df.loc[index, 'Contact User'] = data['contact_user']
        df.loc[index, 'Status'] = data['status']
        
        # Add sentiment field if it doesn't exist
        if 'Sentiment' not in df.columns:
            df['Sentiment'] = None
        df.loc[index, 'Sentiment'] = data['sentiment']
        
        # Add Last Updated fields if they don't exist
        if 'Last Updated By' not in df.columns:
            df['Last Updated By'] = None
        if 'Last Updated Time' not in df.columns:
            df['Last Updated Time'] = None
            
        df.loc[index, 'Last Updated By'] = data['updated_by']
        df.loc[index, 'Last Updated Time'] = data['updated_time']
        
        # Save the updated data to BigQuery
        try:
            # Initialize BigQuery client
            client = get_bigquery_client()
            if not client:
                raise Exception("Failed to initialize BigQuery client")
                
            # Get the table ID
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            # Prepare the update data
            update_data = {
                'Main Category': data['category'],
                'Sub Category': data['sub_category'],
                'Contact User': data['contact_user'],
                'Status': data['status'],
                'Sentiment': data['sentiment'],
                'Last Updated By': data['updated_by'],
                'Last Updated Time': data['updated_time']
            }
            
            # Construct the SQL UPDATE statement
            update_clauses = [f"`{key}` = '{value}'" for key, value in update_data.items()]
            update_sql = f"UPDATE `{table_ref}` SET {', '.join(update_clauses)} WHERE ID = {feedback_id}"
            
            # Execute the update query
            query_job = client.query(update_sql)
            query_job.result()  # Wait for the query to complete
            
            # Also update the local DataFrame to keep it in sync
            for key, value in update_data.items():
                df.loc[index, key] = value
                
            logging.info(f"Successfully updated feedback ID {feedback_id} in BigQuery")
            return jsonify({'success': True, 'message': 'Feedback updated successfully'})
        except Exception as e:
            logging.error(f"Error updating data in BigQuery: {str(e)}")
            
            # Fallback to Excel if BigQuery update fails
            try:
                df.to_excel(DATA_FILE, index=False)
                logging.info(f"Successfully updated feedback ID {feedback_id} in Excel (BigQuery update failed)")
                return jsonify({'success': True, 'message': 'Feedback updated successfully (in Excel fallback)'})
            except Exception as excel_error:
                logging.error(f"Error saving data to Excel: {str(excel_error)}")
                return jsonify({'success': False, 'message': f'Error saving data: {str(e)} / {str(excel_error)}'}), 500
    
    except Exception as e:
        logging.error(f"Error updating feedback: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/email/track', methods=['POST'])
@login_required
def record_email_tracking():
    """Record email tracking information"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Required fields
        required_fields = ['feedback_id', 'tracking_id', 'sent_time']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Load data
        df = load_data()
        
        # Apply user-based access filtering
        filtered_df = filter_by_user_access(df)
        
        # Find the feedback item by ID
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)
            
        # Convert ID to integer for comparison
        feedback_id = int(data['feedback_id'])
        index = df[df['ID'] == feedback_id].index
        
        # Check if the user has access to this feedback item
        filtered_index = filtered_df[filtered_df['ID'] == feedback_id].index
        if len(filtered_index) == 0:
            return jsonify({'success': False, 'message': 'Access denied or feedback not found'}), 403
            
        if len(index) == 0:
            return jsonify({'success': False, 'message': 'Feedback not found'}), 404
            
        # Create or update email tracking columns
        if 'Email Tracking ID' not in df.columns:
            df['Email Tracking ID'] = None
        if 'Email Sent Time' not in df.columns:
            df['Email Sent Time'] = None
        
        # Update email tracking data
        df.loc[index, 'Email Tracking ID'] = data['tracking_id']
        df.loc[index, 'Email Sent Time'] = data['sent_time']
        
        # Save the updated data back to Excel
        try:
            df.to_excel(DATA_FILE, index=False)
            logging.info(f"Successfully recorded email tracking for feedback ID {feedback_id} with tracking ID {data['tracking_id']}")
            return jsonify({
                'success': True, 
                'message': 'Email tracking recorded successfully',
                'feedback_id': feedback_id,
                'tracking_id': data['tracking_id']
            })
        except Exception as e:
            logging.error(f"Error saving email tracking data to Excel: {str(e)}")
            return jsonify({'success': False, 'message': f'Error saving data: {str(e)}'}), 500
    
    except Exception as e:
        logging.error(f"Error recording email tracking: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    # Get server configuration from environment variables or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Log server configuration
    logging.info(f"Starting server on {host}:{port} with debug={debug}")
    
    # Open browser automatically if not in debug mode
    if not debug:
        import threading
        threading.Timer(1.5, open_browser).start()
    
    # Start the Flask application
    app.run(host=host, port=port, debug=debug)
