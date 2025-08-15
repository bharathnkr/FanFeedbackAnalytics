// Feedback Details Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('Feedback Details page initialized');
    
    // Get feedback ID from URL
    const pathParts = window.location.pathname.split('/');
    const feedbackId = pathParts[pathParts.length - 1];
    
    if (feedbackId) {
        // Load feedback details
        loadFeedbackDetail(feedbackId);
    } else {
        showErrorState('No feedback ID provided');
    }
    
    // Set up back button
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', function() {
            window.location.href = '/recent_feedback';
        });
    }
});

// Load feedback detail
function loadFeedbackDetail(feedbackId) {
    showLoadingState();
    
    fetchWithAuth(`/get_feedback_details/${feedbackId}`)
        .then(data => {
            hideLoadingState();
            populateFeedbackDetails(data);
        })
        .catch(error => {
            hideLoadingState();
            showErrorState(error.message);
        });
}

// Populate feedback details
function populateFeedbackDetails(feedback) {
    const detailsContainer = document.getElementById('feedback-details-container');
    
    if (detailsContainer && feedback) {
        // Clear existing content
        detailsContainer.innerHTML = '';
        
        // Create header section
        const headerDiv = document.createElement('div');
        headerDiv.className = 'mb-4';
        
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = `Mets Fan Feedback #${feedback.ID}`;
        headerDiv.appendChild(headerTitle);
        
        // Add fan name if available
        if (feedback['First Name'] || feedback['Last Name']) {
            const fanName = document.createElement('h5');
            fanName.className = 'text-muted';
            fanName.textContent = `From: ${feedback['First Name'] || ''} ${feedback['Last Name'] || ''}`;
            headerDiv.appendChild(fanName);
        }
        
        detailsContainer.appendChild(headerDiv);
        
        // Create metadata section
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'card mb-4';
        
        const metadataHeader = document.createElement('div');
        metadataHeader.className = 'card-header bg-mets-blue text-white';
        metadataHeader.innerHTML = '<i class="fas fa-info-circle me-2"></i>Feedback Information';
        metadataDiv.appendChild(metadataHeader);
        
        const metadataBody = document.createElement('div');
        metadataBody.className = 'card-body';
        
        // Add date
        if (feedback['Date of Birth']) { // Using Date of Birth as proxy for feedback date
            const dateDiv = document.createElement('div');
            dateDiv.className = 'mb-3';
            dateDiv.innerHTML = `<strong>Date:</strong> ${formatDate(new Date(feedback['Date of Birth']))}`;
            metadataBody.appendChild(dateDiv);
        }
        
        // Add category
        if (feedback['Main Category']) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'mb-3';
            categoryDiv.innerHTML = `<strong>Main Category:</strong> ${feedback['Main Category']}`;
            metadataBody.appendChild(categoryDiv);
        }
        
        // Add sub-category
        if (feedback['Sub Category']) {
            const subCategoryDiv = document.createElement('div');
            subCategoryDiv.className = 'mb-3';
            subCategoryDiv.innerHTML = `<strong>Sub Category:</strong> ${feedback['Sub Category']}`;
            metadataBody.appendChild(subCategoryDiv);
        }
        
        // Add sentiment - using placeholder based on feedback length
        let sentiment = 'Neutral';
        if (feedback.Feedback) {
            sentiment = feedback.Feedback.length > 100 ? 'Positive' : (feedback.Feedback.length < 50 ? 'Negative' : 'Neutral');
        }
        const sentimentDiv = document.createElement('div');
        sentimentDiv.className = 'mb-3';
        sentimentDiv.innerHTML = `<strong>Sentiment:</strong> ${getSentimentBadge(sentiment)}`;
        metadataBody.appendChild(sentimentDiv);
        
        metadataDiv.appendChild(metadataBody);
        detailsContainer.appendChild(metadataDiv);
        
        // Create feedback content section
        const contentDiv = document.createElement('div');
        contentDiv.className = 'card mb-4';
        
        const contentHeader = document.createElement('div');
        contentHeader.className = 'card-header bg-mets-orange text-white';
        contentHeader.innerHTML = '<i class="fas fa-comment me-2"></i>Feedback Content';
        contentDiv.appendChild(contentHeader);
        
        const contentBody = document.createElement('div');
        contentBody.className = 'card-body';
        
        const contentText = document.createElement('div');
        contentText.className = 'p-3 bg-light rounded';
        contentText.textContent = feedback.Feedback || 'No feedback content available.';
        contentBody.appendChild(contentText);
        
        contentDiv.appendChild(contentBody);
        detailsContainer.appendChild(contentDiv);
        
        // Create contact information section
        const contactDiv = document.createElement('div');
        contactDiv.className = 'card mb-4';
        
        const contactHeader = document.createElement('div');
        contactHeader.className = 'card-header bg-mets-blue text-white';
        contactHeader.innerHTML = '<i class="fas fa-address-card me-2"></i>Contact Information';
        contactDiv.appendChild(contactHeader);
        
        const contactBody = document.createElement('div');
        contactBody.className = 'card-body';
        
        // Add email
        if (feedback['Email']) {
            const emailDiv = document.createElement('div');
            emailDiv.className = 'mb-3';
            emailDiv.innerHTML = `<strong>Email:</strong> ${feedback['Email']}`;
            contactBody.appendChild(emailDiv);
        }
        
        // Add phone
        if (feedback['Phone Number']) {
            const phoneDiv = document.createElement('div');
            phoneDiv.className = 'mb-3';
            phoneDiv.innerHTML = `<strong>Phone:</strong> ${feedback['Phone Number']}`;
            contactBody.appendChild(phoneDiv);
        }
        
        contactDiv.appendChild(contactBody);
        detailsContainer.appendChild(contactDiv);
    }
}

// Get sentiment badge HTML
function getSentimentBadge(sentiment) {
    let badgeClass = 'bg-secondary';
    let icon = 'fa-meh';
    
    if (sentiment === 'Positive') {
        badgeClass = 'bg-mets-orange'; // Mets orange for positive
        icon = 'fa-smile';
    } else if (sentiment === 'Negative') {
        badgeClass = 'bg-mets-blue'; // Mets blue for negative
        icon = 'fa-frown';
    } else if (sentiment === 'Neutral') {
        badgeClass = 'bg-warning text-dark';
        icon = 'fa-meh';
    }
    
    return `<span class="badge ${badgeClass}"><i class="far ${icon} me-1"></i>${sentiment}</span>`;
}

// Format date for display
function formatDate(date) {
    if (!date || isNaN(date)) return 'Invalid date';
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    
    if (errorOverlay) {
        errorOverlay.style.display = 'flex';
    }
    
    if (errorMessage) {
        errorMessage.textContent = message || 'An error occurred';
    }
}

// Hide error state
function hideErrorState() {
    const errorOverlay = document.getElementById('error-overlay');
    if (errorOverlay) {
        errorOverlay.style.display = 'none';
    }
}
