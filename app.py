import os
import json
import logging
import random
from datetime import datetime, timedelta
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for, flash
from flask_cors import CORS

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
DATA_FILE = 'C:/Users/BReddy/Downloads/2025_06_03 Fan Feedback Sample Dataset.xlsx'

# Helper function to load data from Excel file
def load_data():
    """Load data from Excel file"""
    try:
        logging.info(f"Loading data from {DATA_FILE}")
        df = pd.read_excel(DATA_FILE)
        logging.info(f"Successfully loaded data with {len(df)} records")
        
        # Add Date Submitted field if not present (mock data for demonstration)
        if 'Date Submitted' not in df.columns:
            # Create mock submission dates: random dates within the last 30 days
            today = datetime.now()
            df['Date Submitted'] = [today - timedelta(days=random.randint(0, 30), 
                                                    hours=random.randint(0, 23), 
                                                    minutes=random.randint(0, 59)) 
                                  for _ in range(len(df))]
        
        return df
    except Exception as e:
        logging.error(f"Error loading data: {str(e)}")
        raise Exception(f"Failed to load data: {str(e)}")

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
    return render_template('dashboard.html')

@app.route('/dashboard')
def dashboard():
    logging.info("Dashboard page requested")
    return render_template('dashboard.html')

@app.route('/get_dashboard_data')
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
        
        return jsonify(response)
    
    except Exception as e:
        logging.error(f"Error getting dashboard data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_feedback_summary')
def get_feedback_summary():
    """Get summary metrics for feedback"""
    try:
        # Load data
        df = load_data()
        
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

@app.route('/get_categories')
def get_categories():
    """Get a list of all categories"""
    try:
        # Load data
        df = load_data()
        
        # Get unique categories
        categories = df['Main Category'].unique().tolist() if 'Main Category' in df.columns else []
        
        return jsonify(categories)
    
    except Exception as e:
        logging.error(f"Error getting categories: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_recent_feedback')
def get_recent_feedback():
    """Get list of recent feedback with pagination"""
    try:
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 50))  # Changed default from 25 to 50
        
        # Calculate offset
        offset = (page - 1) * page_size
        
        # Load data
        df = load_data()
        
        # Add ID column if not present
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)
        
        # Add Contact User column if not present
        if 'Contact User' not in df.columns:
            import random
            # Generate random Yes/No values for Contact User
            df['Contact User'] = [random.choice(['Yes', 'No']) for _ in range(len(df))]
        
        # Add Status column if not present - only relevant when Contact User is Yes
        if 'Status' not in df.columns:
            # Generate random statuses for demonstration
            statuses = ['Not Started', 'In Progress', 'Completed']
            import random
            # Only assign status when Contact User is Yes, otherwise leave empty
            df['Status'] = [random.choice(statuses) if df.loc[i, 'Contact User'] == 'Yes' else '' 
                           for i in range(len(df))]
        
        # Sort by date if available
        if 'Date' in df.columns:
            df = df.sort_values(by='Date', ascending=False)
        
        # Calculate total records and pages
        total_records = len(df)
        total_pages = (total_records + page_size - 1) // page_size
        
        # Get paginated data
        paginated_df = df.iloc[offset:offset+page_size]
        
        # Ensure all required columns are present
        required_columns = ['ID', 'First Name', 'Last Name', 'Main Category', 'Sub Category', 'Status']
        for col in required_columns:
            if col not in paginated_df.columns:
                paginated_df[col] = '-'
        
        # Replace NaN values with None for JSON serialization
        paginated_df = paginated_df.where(pd.notna(paginated_df), None)
        
        # Convert to list of dictionaries
        feedback_list = paginated_df.to_dict('records')
        
        # Convert any datetime objects to strings for JSON serialization
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

@app.route('/get_feedback_details/<int:feedback_id>')
def get_feedback_details(feedback_id):
    """Get details for a specific feedback item"""
    try:
        # Load data
        df = load_data()
        
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
def feedback_details_page(feedback_id):
    """Render the feedback details page"""
    return render_template('feedback_details.html', feedback_id=feedback_id)

@app.route('/recent_feedback')
def recent_feedback_page():
    """Render the recent feedback page"""
    return render_template('recent-feedback.html')

@app.route('/edit_feedback/<feedback_id>')
def edit_feedback_page(feedback_id):
    """Render the edit feedback page"""
    return render_template('edit-feedback.html', feedback_id=feedback_id)

@app.route('/get_feedback_details/<feedback_id>')
def get_feedback_details_for_edit(feedback_id):
    """Get details for a specific feedback item for editing"""
    try:
        # Load data
        df = load_data()
        
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

@app.route('/update_feedback', methods=['POST'])
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
        
        # Find the feedback item by ID
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)
            
        # Convert ID to integer for comparison
        feedback_id = int(data['id'])
        index = df[df['ID'] == feedback_id].index
        
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
        
        # Save the updated data back to Excel
        try:
            df.to_excel(DATA_FILE, index=False)
            logging.info(f"Successfully updated feedback ID {feedback_id}")
            return jsonify({'success': True, 'message': 'Feedback updated successfully'})
        except Exception as e:
            logging.error(f"Error saving data to Excel: {str(e)}")
            return jsonify({'success': False, 'message': f'Error saving data: {str(e)}'}), 500
    
    except Exception as e:
        logging.error(f"Error updating feedback: {str(e)}")
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
