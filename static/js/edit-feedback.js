// Edit Feedback Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('Edit Feedback page initialized');
    
    // Get feedback ID from the hidden input
    const feedbackId = document.getElementById('feedback-id').value;
    
    // Load categories for dropdown
    loadCategories();
    
    // Load feedback data
    loadFeedbackData(feedbackId);
    
    // Set up form submission handler
    setupFormHandler();
    
    // Set current date and time for the updated time field
    const now = new Date();
    document.getElementById('updated-time').value = formatDateTime(now);
});

// Load categories from API
function loadCategories() {
    showLoadingState();
    
    fetch('/get_categories')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(categories => {
            updateCategoryDropdown(categories);
            hideLoadingState();
        })
        .catch(error => {
            console.error('Error loading categories:', error);
            showErrorState(`Error loading categories: ${error.message}`);
            hideLoadingState();
        });
}

// Update category dropdown with names
function updateCategoryDropdown(categories) {
    const categorySelect = document.getElementById('category');
    
    if (categorySelect) {
        // Clear existing options
        categorySelect.innerHTML = '';
        
        // Add categories to dropdown
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }
}

// Load feedback data for editing
function loadFeedbackData(feedbackId) {
    showLoadingState();
    
    fetch(`/get_feedback_details/${feedbackId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(feedback => {
            populateForm(feedback);
            hideLoadingState();
        })
        .catch(error => {
            console.error('Error loading feedback data:', error);
            showErrorState(`Error loading feedback data: ${error.message}`);
            hideLoadingState();
        });
}

// Populate form with feedback data
function populateForm(feedback) {
    // Basic information
    document.getElementById('first-name').value = feedback['First Name'] || '';
    document.getElementById('last-name').value = feedback['Last Name'] || '';
    
    // Editable fields
    const categorySelect = document.getElementById('category');
    if (categorySelect && feedback['Main Category']) {
        // Find and select the matching option
        for (let i = 0; i < categorySelect.options.length; i++) {
            if (categorySelect.options[i].value === feedback['Main Category']) {
                categorySelect.selectedIndex = i;
                break;
            }
        }
    }
    
    document.getElementById('sub-category').value = feedback['Sub Category'] || '';
    
    const contactUserSelect = document.getElementById('contact-user');
    if (contactUserSelect && feedback['Contact User']) {
        contactUserSelect.value = feedback['Contact User'];
    }
    
    const statusSelect = document.getElementById('status');
    if (statusSelect && feedback['Status']) {
        statusSelect.value = feedback['Status'];
    }
    
    // For sentiment, we need to determine it from the feedback text
    // This is a placeholder - in a real app, you'd use the actual sentiment value
    let sentiment = 'Neutral';
    if (feedback['Feedback']) {
        sentiment = feedback['Feedback'].length > 100 ? 'Positive' : 
                  (feedback['Feedback'].length < 50 ? 'Negative' : 'Neutral');
    }
    
    const sentimentSelect = document.getElementById('sentiment');
    if (sentimentSelect) {
        sentimentSelect.value = sentiment;
    }
    
    // Feedback text (readonly)
    document.getElementById('feedback-text').value = feedback['Feedback'] || '';
    
    // Last updated info
    if (feedback['Last Updated By']) {
        document.getElementById('updated-by').value = feedback['Last Updated By'];
    }
    
    if (feedback['Last Updated Time']) {
        document.getElementById('updated-time').value = feedback['Last Updated Time'];
    }
}

// Set up form submission handler
function setupFormHandler() {
    const form = document.getElementById('edit-feedback-form');
    
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Get form data
            const feedbackId = document.getElementById('feedback-id').value;
            const category = document.getElementById('category').value;
            const subCategory = document.getElementById('sub-category').value;
            const contactUser = document.getElementById('contact-user').value;
            const status = document.getElementById('status').value;
            const sentiment = document.getElementById('sentiment').value;
            const updatedBy = document.getElementById('updated-by').value;
            const updatedTime = document.getElementById('updated-time').value;
            
            // Create data object
            const data = {
                id: feedbackId,
                category: category,
                sub_category: subCategory,
                contact_user: contactUser,
                status: status,
                sentiment: sentiment,
                updated_by: updatedBy,
                updated_time: updatedTime
            };
            
            // Submit form data
            submitFormData(data);
        });
    }
}

// Submit form data to server
function submitFormData(data) {
    showLoadingState();
    
    fetch('/update_feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        if (result.success) {
            // Show success message
            const successAlert = document.getElementById('edit-success');
            if (successAlert) {
                successAlert.style.display = 'block';
                
                // Redirect back to recent feedback page after a delay
                setTimeout(() => {
                    window.location.href = '/recent_feedback';
                }, 2000);
            }
        } else {
            throw new Error(result.message || 'Unknown error occurred');
        }
        hideLoadingState();
    })
    .catch(error => {
        console.error('Error updating feedback:', error);
        showErrorState(`Error updating feedback: ${error.message}`);
        hideLoadingState();
    });
}

// Format date and time for display
function formatDateTime(date) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// Show loading state
function showLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Show error state
function showErrorState(message) {
    const errorAlert = document.getElementById('edit-error');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
    }
}

// Hide error state
function hideErrorState() {
    const errorAlert = document.getElementById('edit-error');
    if (errorAlert) {
        errorAlert.style.display = 'none';
    }
}
